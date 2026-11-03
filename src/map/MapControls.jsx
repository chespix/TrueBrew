import { useMapEvents } from 'react-leaflet';
import { LocateFixed } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { notify } from '../lib/notify';

export function MapEventsHandler({ isAddMode, onMapClick }) {
  useMapEvents({ click(e) { if (isAddMode) onMapClick(e.latlng); } });
  return null;
}

export function LocateControl({ setUserLocation }) {
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
          () => notify("Permiso de ubicación denegado o error de red.")
        );
      }
    } catch {
      notify("No se pudo obtener la ubicación o permiso denegado.");
    }
  };
  return (
    <button onClick={handleLocate} title="Mi Ubicación" style={{ position: 'absolute', top: '80px', right: '10px', zIndex: 1000, backgroundColor: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', color: 'var(--text-primary)' }}>
      <LocateFixed size={18} />
    </button>
  );
}
