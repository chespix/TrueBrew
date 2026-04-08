import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Coffee, AlertTriangle, ChevronDown, Check, X, Plus, MapPin, ThumbsUp, ThumbsDown, Trash2, LocateFixed, LogOut, Edit3, ShieldAlert, Download, Search, RefreshCw } from 'lucide-react';
import { API_BASE } from './config';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { Toast } from '@capacitor/toast';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Dialog } from '@capacitor/dialog';
import { GoogleLogin } from '@react-oauth/google';
import 'leaflet/dist/leaflet.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'fallback-client-id';

const notify = async (msg) => {
  if (Capacitor.isNativePlatform()) {
    await Toast.show({ text: msg });
  } else {
    alert(msg);
  }
};

// ── Helpers ──

const countVotes = (votes = {}) => ({
  upvotes: Object.values(votes).filter(v => v === 'up').length,
  downvotes: Object.values(votes).filter(v => v === 'down').length
});

const getDerivedStatus = (votes) => {
  const { upvotes, downvotes } = countVotes(votes);
  if (upvotes > downvotes) return 'specialty';
  if (downvotes > upvotes) return 'fake';
  return 'unverified';
};

const createIcon = (status) => {
  let iconClass = 'marker-unverified';
  let innerHtml = '<div style="color:white; display:flex; align-items:center; justify-content:center; height:100%;">';
  if (status === 'specialty') {
    iconClass = 'marker-specialty';
    innerHtml += '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/></svg>';
  } else if (status === 'fake') {
    iconClass = 'marker-fake';
    innerHtml += '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  } else {
    innerHtml += '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
  }
  innerHtml += '</div>';
  return L.divIcon({ className: `custom-marker ${iconClass}`, html: innerHtml, iconSize: [32, 32], iconAnchor: [16, 16] });
};

const createClusterCustomIcon = (cluster) => {
  const childCount = cluster.getChildCount();
  const markers = cluster.getAllChildMarkers();
  
  let specialty = 0;
  let fake = 0;
  let unverified = 0;

  markers.forEach(m => {
    const className = m.options.icon?.options?.className || '';
    if (className.includes('marker-specialty')) specialty++;
    else if (className.includes('marker-fake')) fake++;
    else unverified++;
  });

  // Default color is unverified/yellow
  let dominantClass = 'marker-cluster-unverified';
  
  // If the majority of the nodes inside are specialty
  if (specialty > fake && specialty >= unverified) {
    dominantClass = 'marker-cluster-specialty';
  } 
  // If the majority are fake
  else if (fake > specialty && fake > unverified) {
    dominantClass = 'marker-cluster-fake';
  }

  return L.divIcon({
    html: `<div><span>${childCount}</span></div>`,
    className: `marker-cluster ${dominantClass}`,
    iconSize: L.point(40, 40)
  });
};

// ── Map Sub-Components ──

function MapEventsHandler({ isAddMode, onMapClick }) {
  useMapEvents({ click(e) { if (isAddMode) onMapClick(e.latlng); } });
  return null;
}

function LocateControl({ setUserLocation }) {
  const map = useMapEvents({});
  const handleLocate = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        let permissions = await Geolocation.checkPermissions();
        if (permissions.location !== 'granted') {
          permissions = await Geolocation.requestPermissions();
          if (permissions.location !== 'granted') return notify("Permiso de ubicación denegado.");
        }
        
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(latlng);
        map.flyTo(latlng, 15);
      } else {
        if (!navigator.geolocation) return notify("La geolocalización no está soportada en tu navegador.");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserLocation(latlng);
            map.flyTo(latlng, 15);
          },
          (err) => notify("Permiso de ubicación denegado o error de red.")
        );
      }
    } catch (e) {
      notify("No se pudo obtener la ubicación o permiso denegado.");
    }
  };
  return (
    <button onClick={handleLocate} title="Mi Ubicación" style={{ position: 'absolute', top: '80px', right: '10px', zIndex: 1000, backgroundColor: 'var(--panel-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', color: 'white' }}>
      <LocateFixed size={18} />
    </button>
  );
}

// ── Main App ──

function App() {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // Auth
  const [token, setToken] = useState(localStorage.getItem('tb_token') || null);
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

  // ── Capacitor UX Polishes ──
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#0f1115' }).catch(() => {});
      SplashScreen.hide().catch(() => {});
    }
  }, []);

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

  useEffect(() => {
    GoogleAuth.initialize({
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['profile', 'email'],
      grantOfflineAccess: true,
    });
  }, []);

  const handleNativeGoogleLogin = async () => {
    try {
      const googleUser = await GoogleAuth.signIn();
      await executeBackendLogin(googleUser.authentication.idToken);
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
      setToken(data.token);
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
    setToken(null);
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
    } catch (e) { notify("Error al guardar voto"); }
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
      } catch (e) { notify("Error al eliminar."); }
    }
  };

  const handleMapClick = (latlng) => setNewLocationDraft({ lat: latlng.lat, lng: latlng.lng });

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
      if (!res.ok) throw new Error();
      const created = await res.json();
      setShops(prev => [...prev, created]);
      cancelAddLocation();
    } catch (e) { notify("Error al guardar local."); }
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
    } catch (e) { notify("Error al editar."); }
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
    } catch (e) { notify("Error al aprobar."); }
  };

  const handleRejectShop = async (id) => {
    try {
      await fetch(`${API_BASE}/api/shops/${id}`, { method: 'DELETE', headers: authHeaders() });
      fetchPendingShops();
    } catch (e) { notify("Error al rechazar."); }
  };

  // ── Render ──

  return (
    <>
      <div className="app-container">
        {/* Navbar */}
        <nav className="top-nav" style={{ gap: '8px' }}>
          <div className="brand-title">
            <div className="brand-dot live-pulse"></div> TrueBrew
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', zIndex: 1000 }}>
            {user ? (
              <>
                {user.role === 'admin' && pendingShops.length > 0 && (
                  <button onClick={() => { setShowModerationModal(true); fetchPendingShops(); }}
                    style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid var(--accent-fake)', color: 'white', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    <ShieldAlert size={14} /> Pendientes <span style={{ background: 'var(--accent-fake)', padding: '2px 6px', borderRadius: '12px', fontSize: '0.7rem' }}>{pendingShops.length}</span>
                  </button>
                )}
                <button onClick={() => { setIsAddMode(!isAddMode); if (isPanelOpen) closePanel(); }}
                  style={{ background: isAddMode ? 'white' : 'var(--accent-specialty)', border: 'none', color: isAddMode ? 'black' : 'white', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  {isAddMode ? <X size={14} /> : <Plus size={14} />} {isAddMode ? 'Cancelar' : 'Agregar'}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '16px', fontSize: '0.75rem', color: 'var(--accent-brand)' }}>
                  {user.picture && <img src={user.picture} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />}
                  {user.name?.split(' ')[0]}
                </div>
                <button onClick={handleLogout} title="Cerrar Sesión" style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <button onClick={() => setShowLoginModal(true)} style={{ background: 'var(--accent-specialty)', border: 'none', color: 'white', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                Inicia Sesión
              </button>
            )}
          </div>
        </nav>

        {/* Moderation Modal */}
        {showModerationModal && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '500px', maxHeight: '80dvh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldAlert size={20} color="var(--accent-fake)" /> Moderación</h2>
                <button className="btn-icon" onClick={() => setShowModerationModal(false)}><X size={24} /></button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {pendingShops.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No hay solicitudes pendientes.</p>
                ) : pendingShops.map(shop => (
                  <div key={shop.id} style={{ backgroundColor: 'var(--bg-color)', padding: '16px', borderRadius: '12px', marginBottom: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ marginBottom: '4px' }}>{shop.name}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{shop.address}</p>
                    <p style={{ fontSize: '0.9rem', marginBottom: '16px' }}>{shop.details}</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleRejectShop(shop.id)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--accent-fake)', background: 'transparent', color: 'var(--accent-fake)', cursor: 'pointer' }}>Rechazar</button>
                      <button onClick={() => handleApproveShop(shop.id)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: 'var(--accent-specialty)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Aprobar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Login Modal */}
        {showLoginModal && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '350px', textAlign: 'center' }}>
              <h2 style={{ marginBottom: '8px' }}>Bienvenido a TrueBrew</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Inicia sesión con tu cuenta de Google para votar, agregar locales y más.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                {Capacitor.isNativePlatform() ? (
                  <button onClick={handleNativeGoogleLogin} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'white', color: 'black', padding: '12px 24px', borderRadius: '24px', border: 'none', fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '240px', fontSize: '0.95rem' }}>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="G" style={{ width: 18, height: 18 }} />
                    Continuar con Google
                  </button>
                ) : (
                  <GoogleLogin
                    onSuccess={handleWebGoogleLoginSuccess}
                    onError={() => notify("La conexión con Google falló.")}
                    useOneTap
                    shape="pill"
                  />
                )}
              </div>
              <button onClick={() => setShowLoginModal(false)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Floating Search Bar and Refresh (hidden in Add Mode) */}
        {!isAddMode && (
          <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 20px) + 80px)', left: '10px', right: '54px', zIndex: 1000, display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, backgroundColor: 'var(--panel-bg)', borderRadius: '8px', display: 'flex', alignItems: 'center', padding: '0 10px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <Search size={16} color="var(--text-secondary)" />
              <input type="text" placeholder="Buscar cafetería..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', padding: '10px', outline: 'none' }} />
              {searchQuery && <X size={16} color="var(--text-secondary)" style={{cursor:'pointer'}} onClick={() => setSearchQuery('')} />}
            </div>
            <button onClick={() => { fetchShops(); if(user?.role === 'admin') fetchPendingShops(); notify("Actualizado"); }} 
              style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'white', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <RefreshCw size={18} />
            </button>
          </div>
        )}

        {/* Add Mode Banner */}
        {isAddMode && !newLocationDraft && (
          <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 20px) + 80px)', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--accent-specialty)', color: 'white', padding: '10px 20px', borderRadius: '24px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', width: 'max-content', maxWidth: '80%' }}>
            <MapPin size={18} style={{ flexShrink: 0 }} /> <span>Toca en el mapa para ubicar el local</span>
          </div>
        )}

        {/* Map */}
        <main className="map-container" style={{ cursor: isAddMode ? 'crosshair' : 'grab' }}>
          <MapContainer center={defaultCenter} zoom={13} style={{ height: "100%", width: "100%", zIndex: 1 }} zoomControl={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <ZoomControl position="topright" />
            <LocateControl setUserLocation={setUserLocation} />
            <MapEventsHandler isAddMode={isAddMode} onMapClick={handleMapClick} />

            <MarkerClusterGroup chunkedLoading maxClusterRadius={45} showCoverageOnHover={false} iconCreateFunction={createClusterCustomIcon}>
              {shops.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.address?.toLowerCase().includes(searchQuery.toLowerCase())).map(shop => (
                <Marker key={shop.id} position={[shop.lat, shop.lng]} icon={createIcon(getDerivedStatus(shop.votes))} eventHandlers={{ click: () => handleMarkerClick(shop) }} />
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
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '400px' }}>
              <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Plus size={18} /> Nuevo Local</h3>
              <input type="text" placeholder="Nombre del Local *" value={newFormDetails.name} onChange={e => setNewFormDetails({ ...newFormDetails, name: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', background: 'var(--bg-color)', color: 'white', border: '1px solid var(--border-color)' }} autoFocus />
              <input type="text" placeholder="Dirección (opcional)" value={newFormDetails.address} onChange={e => setNewFormDetails({ ...newFormDetails, address: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', background: 'var(--bg-color)', color: 'white', border: '1px solid var(--border-color)' }} />
              <textarea placeholder="Descripción breve (opcional)" value={newFormDetails.details} onChange={e => setNewFormDetails({ ...newFormDetails, details: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '8px', background: 'var(--bg-color)', color: 'white', border: '1px solid var(--border-color)', resize: 'vertical', minHeight: '80px' }} />
              {user?.role !== 'admin' && (
                <p style={{ fontSize: '0.8rem', color: 'var(--accent-unverified)', marginBottom: '16px' }}>📌 Tu local quedará pendiente de aprobación por un administrador.</p>
              )}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={cancelAddLocation} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'white', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={submitNewLocation} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--accent-specialty)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Guardar</button>
              </div>
            </div>
          </div>
        )}

        {/* Details Panel */}
        <div className={`details-panel ${isPanelOpen && !isAddMode ? 'open' : ''}`}>
          <div className="panel-handle" onClick={closePanel}></div>
          {selectedShop ? (() => {
            const { upvotes, downvotes } = countVotes(selectedShop.votes);
            const status = getDerivedStatus(selectedShop.votes);
            const myVote = user ? selectedShop.votes?.[user.id] : null;

            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  {isEditingShop ? (
                    <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ width: '80%', padding: '8px', marginBottom: '8px', backgroundColor: 'var(--bg-color)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold' }} />
                  ) : (
                    <h2 className="shop-title">{selectedShop.name}</h2>
                  )}
                  <button className="btn-icon" onClick={closePanel}><ChevronDown size={24} /></button>
                </div>

                {isEditingShop ? (
                  <input type="text" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '16px', backgroundColor: 'var(--bg-color)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                ) : (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>{selectedShop.address}</p>
                )}

                {selectedShop.approved === false && (
                  <div style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: 'var(--accent-unverified)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', border: '1px dashed var(--accent-unverified)' }}>
                    <strong>📌 Pendiente de Aprobación.</strong> Sólo tú puedes ver este local hasta que un administrador lo apruebe.
                  </div>
                )}

                <div className={`status-badge ${status}`}>
                  {status === 'specialty' && <><Check size={16} /> Café de Especialidad</>}
                  {status === 'fake' && <><AlertTriangle size={16} /> Evitar (Falso Especialidad)</>}
                  {status === 'unverified' && <><Coffee size={16} /> En proceso de votación</>}
                </div>

                {isEditingShop ? (
                  <textarea value={editForm.details} onChange={e => setEditForm({ ...editForm, details: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '16px', backgroundColor: 'var(--bg-color)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', minHeight: '80px', resize: 'vertical' }} />
                ) : (
                  <p style={{ lineHeight: '1.6', marginBottom: '16px' }}>{selectedShop.details}</p>
                )}

                {/* Vote Bar */}
                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', display: 'flex', marginBottom: '8px' }}>
                  {(upvotes + downvotes) > 0 ? (
                    <>
                      <div style={{ height: '100%', backgroundColor: 'var(--accent-specialty)', width: `${(upvotes / (upvotes + downvotes)) * 100}%` }}></div>
                      <div style={{ height: '100%', backgroundColor: 'var(--accent-fake)', width: `${(downvotes / (upvotes + downvotes)) * 100}%` }}></div>
                    </>
                  ) : <div style={{ height: '100%', backgroundColor: 'var(--accent-unverified)', width: '100%' }}></div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: myVote === 'up' ? 'bold' : 'normal', color: myVote === 'up' ? 'var(--accent-specialty)' : '' }}>Verdadero: {upvotes}</span>
                  <span style={{ fontWeight: myVote === 'down' ? 'bold' : 'normal', color: myVote === 'down' ? 'var(--accent-fake)' : '' }}>Falso: {downvotes}</span>
                </div>

                {/* Vote Buttons */}
                {user ? (
                  <div className="admin-actions">
                    <button className="btn btn-verify" onClick={() => handleVote(selectedShop.id, 'up')}
                      style={{ backgroundColor: myVote === 'up' ? '#059669' : 'transparent', color: myVote === 'up' ? 'white' : '#10b981', border: '1px solid #10b981' }}>
                      <ThumbsUp size={16} fill={myVote === 'up' ? 'white' : 'transparent'} /> Votar a favor
                    </button>
                    <button className="btn btn-mark-fake" onClick={() => handleVote(selectedShop.id, 'down')}
                      style={{ backgroundColor: myVote === 'down' ? 'rgba(239,68,68,0.2)' : 'transparent', color: '#ef4444', border: '1px solid #ef4444' }}>
                      <ThumbsDown size={16} fill={myVote === 'down' ? '#ef4444' : 'transparent'} /> Votar en contra
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <button onClick={() => setShowLoginModal(true)} style={{ background: 'var(--border-color)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', width: '100%' }}>
                      Inicia sesión para votar
                    </button>
                  </div>
                )}

                {/* Admin Actions */}
                {user?.role === 'admin' && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    {isEditingShop ? (
                      <>
                        <button onClick={() => setIsEditingShop(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={() => saveEdit(selectedShop.id)} style={{ flex: 1, background: 'var(--accent-specialty)', border: 'none', color: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar</button>
                      </>
                    ) : (
                      <>
                        <button onClick={startEditing} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <Edit3 size={16} /> Editar
                        </button>
                        <button onClick={() => handleDeleteShop(selectedShop.id)} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--accent-fake)', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <Trash2 size={16} /> Eliminar
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            );
          })() : null}
        </div>
      </div>
    </>
  );
}

export default App;
