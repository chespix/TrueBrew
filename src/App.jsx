import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { MapPin } from 'lucide-react';
import { API_BASE } from './config';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Dialog } from '@capacitor/dialog';
import 'leaflet/dist/leaflet.css';
import { notify } from './lib/notify';
import { getDerivedStatus } from './lib/shopStatus';
import { createIcon, createClusterCustomIcon } from './map/icons';
import { MapEventsHandler, LocateControl } from './map/MapControls';
import TopNav from './components/TopNav';
import ModerationModal from './components/ModerationModal';
import LoginModal from './components/LoginModal';
import SearchBar from './components/SearchBar';
import NewLocationForm from './components/NewLocationForm';
import ShopDetails from './components/ShopDetails';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '646062898063-it6q6muu8aaju4m6rluktnvhvfsmbjvt.apps.googleusercontent.com';

// ── Main App ──

function App() {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // Light/Dark mode — persisted
  const [lightMode, setLightMode] = useState(() => localStorage.getItem('tb_theme') !== 'dark');

  useEffect(() => {
    const root = document.documentElement;
    if (lightMode) {
      root.setAttribute('data-theme', 'light');
      localStorage.setItem('tb_theme', 'light');
    } else {
      root.removeAttribute('data-theme');
      localStorage.setItem('tb_theme', 'dark');
    }
  }, [lightMode]);

  // Auth
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('tb_user') || 'null'));
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Moderation
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [pendingShops, setPendingShops] = useState([]);

  // Add Location
  const [isAddMode, setIsAddMode] = useState(false);
  const [newLocationDraft, setNewLocationDraft] = useState(null);
  const [newFormDetails, setNewFormDetails] = useState({ name: '', address: '', details: '' });

  // Edit
  const [isEditingShop, setIsEditingShop] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', address: '', details: '' });

  const [searchQuery, setSearchQuery] = useState('');
  const [overtureResults, setOvertureResults] = useState([]);
  const [overtureLoading, setOvertureLoading] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState([]);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [showOvertureDrop, setShowOvertureDrop] = useState(false);
  const overtureDebounce = useRef(null);
  const mapRef = useRef(null);

  const defaultCenter = [-34.588, -58.430];

  // ── API Helpers ──

  const authHeaders = useCallback(() => {
    const t = localStorage.getItem('tb_token');
    return t ? { 'Authorization': `Bearer ${t}` } : {};
  }, []);

  const fetchShops = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/shops`, { headers: authHeaders() });
      const data = await res.json();
      setShops(data);
      setSelectedShop(prev => prev ? (data.find(s => s.id === prev.id) || null) : null);
    } catch (e) { console.error(e); }
  }, [authHeaders]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  // ── Debounced Search for Cafes & Addresses ──
  useEffect(() => {
    if (!user || searchQuery.length < 3) {
      setOvertureResults([]);
      setGeocodeResults([]);
      setShowOvertureDrop(false);
      return;
    }
    clearTimeout(overtureDebounce.current);
    overtureDebounce.current = setTimeout(async () => {
      setOvertureLoading(true);
      setGeocodeLoading(true);

      const fetchOverture = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/search/overture?q=${encodeURIComponent(searchQuery)}`, {
            headers: authHeaders()
          });
          if (!res.ok) return [];
          const data = await res.json();
          const R = 0.001; // ~100m in degrees
          return data.filter(ot =>
            !shops.some(s => Math.abs(s.lat - ot.lat) < R && Math.abs(s.lng - ot.lng) < R)
          );
        } catch (e) {
          console.error('Overture fetch error:', e);
          return [];
        }
      };

      const fetchGeocode = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/search/geocode?q=${encodeURIComponent(searchQuery)}`, {
            headers: authHeaders()
          });
          if (!res.ok) return [];
          return await res.json();
        } catch (e) {
          console.error('Geocode fetch error:', e);
          return [];
        }
      };

      try {
        const [otData, geoData] = await Promise.all([fetchOverture(), fetchGeocode()]);
        setOvertureResults(otData);
        setGeocodeResults(geoData);
        setShowOvertureDrop(otData.length > 0 || geoData.length > 0);
      } catch {
        setOvertureResults([]);
        setGeocodeResults([]);
        setShowOvertureDrop(false);
      } finally {
        setOvertureLoading(false);
        setGeocodeLoading(false);
      }
    }, 500);
    return () => clearTimeout(overtureDebounce.current);
  }, [searchQuery, user, shops, authHeaders]);

  // ── Capacitor UX Polishes ──
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(() => {});
    }
  }, []);

  // Update native status bar to match light/dark theme
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (lightMode) {
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#f0ece4' }).catch(() => {});
    } else {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#0f1115' }).catch(() => {});
    }
  }, [lightMode]);

  useEffect(() => {
    const attachListener = async () => {
      if (!Capacitor.isNativePlatform()) return null;
      return await CapacitorApp.addListener('backButton', () => {
        if (showModerationModal) setShowModerationModal(false);
        else if (showLoginModal) setShowLoginModal(false);
        else if (isAddMode) setIsAddMode(false);
        else if (selectedShop) { setSelectedShop(null); setIsEditingShop(false); }
        else CapacitorApp.exitApp();
      });
    };
    const listenerPromise = attachListener();
    return () => {
      listenerPromise.then(l => l && l.remove());
    };
  }, [showModerationModal, isAddMode, selectedShop, showLoginModal]);

  // ── Auth Handlers ──

  // Native Android login. On the web, @react-oauth/google's <GoogleLogin> is used instead.
  // webClientId must be the *Web* OAuth client id (the backend verifies the token against it).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    SocialLogin.initialize({
      google: { webClientId: GOOGLE_CLIENT_ID, mode: 'online' },
    }).catch(e => console.error('SocialLogin init error:', e));
  }, []);

  const handleNativeGoogleLogin = async () => {
    try {
      const res = await SocialLogin.login({ provider: 'google', options: {} });
      const idToken = res?.result?.idToken;
      if (!idToken) throw new Error('Google no devolvió un idToken.');
      await executeBackendLogin(idToken);
    } catch (e) {
      console.error(e);
      notify("Error al iniciar sesión con Google: " + (e.message || JSON.stringify(e)));
    }
  };

  const handleWebGoogleLoginSuccess = async (credentialResponse) => {
    try {
      await executeBackendLogin(credentialResponse.credential);
    } catch (e) {
      notify("Error en la validación web: " + e.message);
    }
  };

  const executeBackendLogin = async (idToken) => {
    const res = await fetch(`${API_BASE}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: idToken })
    });
    const data = await res.json();
    if (data.token) {
      setUser(data.user);
      localStorage.setItem('tb_token', data.token);
      localStorage.setItem('tb_user', JSON.stringify(data.user));
      setShowLoginModal(false);
      fetchShops(); // Re-fetch to include user's pending shops
    } else {
      notify(data.error || "Login fallido");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('tb_token');
    localStorage.removeItem('tb_user');
    setIsAddMode(false);
  };

  // ── Shop Handlers ──

  const handleMarkerClick = (shop) => {
    if (isAddMode) return;
    setSelectedShop(shop);
    setIsEditingShop(false);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setIsEditingShop(false);
    setTimeout(() => setSelectedShop(null), 300);
  };

  const handleVote = async (id, type) => {
    if (!user) return setShowLoginModal(true);
    try {
      const res = await fetch(`${API_BASE}/api/shops/${id}/vote`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ type })
      });
      if (!res.ok) throw new Error();
      const updatedShop = await res.json();
      setShops(prev => prev.map(s => s.id === id ? updatedShop : s));
      setSelectedShop(updatedShop);
    } catch { notify("Error al guardar voto"); }
  };

  const handleDeleteShop = async (id) => {
    let confirmDel = false;
    if (Capacitor.isNativePlatform()) {
      const { value } = await Dialog.confirm({
        title: 'Confirmar Eliminación',
        message: '¿Seguro que quieres eliminar este local permanentemente?',
      });
      confirmDel = value;
    } else {
      confirmDel = window.confirm("¿Seguro que quieres eliminar este local permanentemente?");
    }

    if (confirmDel) {
      try {
        await fetch(`${API_BASE}/api/shops/${id}`, { method: 'DELETE', headers: authHeaders() });
        setShops(prev => prev.filter(s => s.id !== id));
        closePanel();
      } catch { notify("Error al eliminar."); }
    }
  };

  const handleMapClick = (latlng) => setNewLocationDraft({ lat: latlng.lat, lng: latlng.lng });

  const handleOvertureSelect = (place) => {
    setShowOvertureDrop(false);
    setSearchQuery('');
    setIsAddMode(true);
    setNewLocationDraft({ lat: place.lat, lng: place.lng });
    setNewFormDetails({ name: place.name, address: place.address, details: '' });
    if (mapRef.current) mapRef.current.flyTo([place.lat, place.lng], 17);
  };

  const handleGeocodeSelect = (place) => {
    setShowOvertureDrop(false);
    setSearchQuery('');
    setIsAddMode(true);
    setNewLocationDraft({ lat: place.lat, lng: place.lng });
    setNewFormDetails({ name: '', address: place.name, details: '' });
    if (mapRef.current) mapRef.current.flyTo([place.lat, place.lng], 17);
  };

  const cancelAddLocation = () => {
    setIsAddMode(false);
    setNewLocationDraft(null);
    setNewFormDetails({ name: '', address: '', details: '' });
  };

  const submitNewLocation = async () => {
    if (!newFormDetails.name.trim()) return notify("Por favor ingresa un nombre.");
    try {
      const res = await fetch(`${API_BASE}/api/shops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ...newFormDetails, lat: newLocationDraft.lat, lng: newLocationDraft.lng })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setShops(prev => [...prev, data]);
      cancelAddLocation();
    } catch (e) { notify(e.message || "Error al guardar local."); }
  };

  const startEditing = () => {
    setEditForm({ name: selectedShop.name, address: selectedShop.address, details: selectedShop.details });
    setIsEditingShop(true);
  };

  const saveEdit = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/shops/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setShops(prev => prev.map(s => s.id === id ? updated : s));
      setSelectedShop(updated);
      setIsEditingShop(false);
    } catch { notify("Error al editar."); }
  };

  // ── Moderation ──

  const fetchPendingShops = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/pending`, { headers: authHeaders() });
      if (res.ok) setPendingShops(await res.json());
    } catch (e) { console.error(e); }
  }, [user, authHeaders]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchPendingShops();
    }
  }, [user, fetchPendingShops]);

  const handleApproveShop = async (id) => {
    try {
      await fetch(`${API_BASE}/api/shops/${id}/approve`, { method: 'PATCH', headers: authHeaders() });
      fetchPendingShops();
      fetchShops();
    } catch { notify("Error al aprobar."); }
  };

  const handleRejectShop = async (id) => {
    try {
      await fetch(`${API_BASE}/api/shops/${id}`, { method: 'DELETE', headers: authHeaders() });
      fetchPendingShops();
    } catch { notify("Error al rechazar."); }
  };

  // ── Render ──

  return (
    <>
      <div className="app-container">
        {/* Navbar */}
        <TopNav
          lightMode={lightMode} setLightMode={setLightMode} user={user}
          pendingShops={pendingShops} setShowModerationModal={setShowModerationModal} fetchPendingShops={fetchPendingShops}
          isAddMode={isAddMode} setIsAddMode={setIsAddMode} isPanelOpen={isPanelOpen} closePanel={closePanel}
          handleLogout={handleLogout} setShowLoginModal={setShowLoginModal}
        />

        {/* Moderation Modal */}
        {showModerationModal && (
          <ModerationModal
            pendingShops={pendingShops} setShowModerationModal={setShowModerationModal}
            handleRejectShop={handleRejectShop} handleApproveShop={handleApproveShop}
          />
        )}

        {/* Login Modal */}
        {showLoginModal && (
          <LoginModal
            handleNativeGoogleLogin={handleNativeGoogleLogin}
            handleWebGoogleLoginSuccess={handleWebGoogleLoginSuccess}
            setShowLoginModal={setShowLoginModal}
          />
        )}

        {/* Floating Search Bar and Refresh (hidden in Add Mode) */}
        {!isAddMode && (
          <SearchBar
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            overtureResults={overtureResults} geocodeResults={geocodeResults}
            overtureLoading={overtureLoading} geocodeLoading={geocodeLoading}
            showOvertureDrop={showOvertureDrop} setShowOvertureDrop={setShowOvertureDrop}
            handleOvertureSelect={handleOvertureSelect} handleGeocodeSelect={handleGeocodeSelect}
            onRefresh={() => { fetchShops(); if (user?.role === 'admin') fetchPendingShops(); notify("Actualizado"); }}
          />
        )}

        {/* Add Mode Banner */}
        {isAddMode && !newLocationDraft && (
          <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 20px) + 80px)', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--accent-specialty)', color: 'white', padding: '10px 20px', borderRadius: '24px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', width: 'max-content', maxWidth: '80%' }}>
            <MapPin size={18} style={{ flexShrink: 0 }} /> <span>Toca en el mapa para ubicar el local</span>
          </div>
        )}

        {/* Map */}
        <main className="map-container" style={{ cursor: isAddMode ? 'crosshair' : 'grab' }}>
          <MapContainer ref={mapRef} center={defaultCenter} zoom={13} style={{ height: "100%", width: "100%", zIndex: 1 }} zoomControl={false}>
            {/* OpenStreetMap tiles: free, no API key. Dark mode is done with a CSS filter (see index.css). */}
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <ZoomControl position="topright" />
            <LocateControl setUserLocation={setUserLocation} />
            <MapEventsHandler isAddMode={isAddMode} onMapClick={handleMapClick} />

            <MarkerClusterGroup chunkedLoading maxClusterRadius={45} showCoverageOnHover={false} iconCreateFunction={createClusterCustomIcon}>
              {shops.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.address?.toLowerCase().includes(searchQuery.toLowerCase())).map(shop => (
                <Marker key={shop.id} position={[shop.lat, shop.lng]} icon={createIcon(getDerivedStatus(shop))} eventHandlers={{ click: () => handleMarkerClick(shop) }} />
              ))}
            </MarkerClusterGroup>

            {userLocation && (
              <Marker position={[userLocation.lat, userLocation.lng]} icon={L.divIcon({ className: 'user-location-marker', iconSize: [16, 16], iconAnchor: [8, 8] })} />
            )}

            {newLocationDraft && (
              <Marker position={[newLocationDraft.lat, newLocationDraft.lng]} icon={createIcon('unverified')} />
            )}
          </MapContainer>
        </main>

        {/* New Location Form */}
        {newLocationDraft && (
          <NewLocationForm
            newFormDetails={newFormDetails} setNewFormDetails={setNewFormDetails} user={user}
            cancelAddLocation={cancelAddLocation} submitNewLocation={submitNewLocation}
          />
        )}

        {/* Details Panel */}
        <div className={`details-panel ${isPanelOpen && !isAddMode ? 'open' : ''}`}>
          <div className="panel-handle" onClick={closePanel}></div>
          {selectedShop && (
            <ShopDetails
              selectedShop={selectedShop} user={user}
              isEditingShop={isEditingShop} setIsEditingShop={setIsEditingShop}
              editForm={editForm} setEditForm={setEditForm}
              closePanel={closePanel} handleVote={handleVote} setShowLoginModal={setShowLoginModal}
              startEditing={startEditing} saveEdit={saveEdit} handleDeleteShop={handleDeleteShop}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default App;
