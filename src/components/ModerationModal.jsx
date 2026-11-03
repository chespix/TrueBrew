import { X, ShieldAlert } from 'lucide-react';

// Admin list of shops waiting for approval.
export default function ModerationModal({ pendingShops, setShowModerationModal, handleRejectShop, handleApproveShop }) {
  return (
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
  );
}
