import { Plus } from 'lucide-react';

// Form shown after picking a spot on the map in add mode.
export default function NewLocationForm({ newFormDetails, setNewFormDetails, user, cancelAddLocation, submitNewLocation }) {
  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '400px' }}>
        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Plus size={18} /> Nuevo Local</h3>
        <input type="text" placeholder="Nombre del Local *" value={newFormDetails.name} onChange={e => setNewFormDetails({ ...newFormDetails, name: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} autoFocus />
        <input type="text" placeholder="Dirección (opcional)" value={newFormDetails.address} onChange={e => setNewFormDetails({ ...newFormDetails, address: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '8px', background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
        <textarea placeholder="Descripción breve (opcional)" value={newFormDetails.details} onChange={e => setNewFormDetails({ ...newFormDetails, details: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '8px', background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', resize: 'vertical', minHeight: '80px' }} />
        {user?.role !== 'admin' && (
          <p style={{ fontSize: '0.8rem', color: 'var(--accent-unverified)', marginBottom: '16px' }}>📌 Tu local quedará pendiente de aprobación por un administrador.</p>
        )}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={cancelAddLocation} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={submitNewLocation} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--accent-specialty)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
