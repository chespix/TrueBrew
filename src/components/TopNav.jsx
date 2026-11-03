import { X, Plus, ShieldAlert, LogOut, Sun, Moon, User } from 'lucide-react';

// Top bar: brand, theme toggle, admin pending badge, add button and session.
export default function TopNav({ lightMode, setLightMode, user, pendingShops, setShowModerationModal, fetchPendingShops, isAddMode, setIsAddMode, isPanelOpen, closePanel, handleLogout, setShowLoginModal }) {
  return (
    <nav className="top-nav" style={{ gap: '8px' }}>
      <div className="brand-title">
        <div className="brand-dot live-pulse"></div> TrueBrew
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', zIndex: 1000 }}>
        {/* Light/Dark toggle */}
        <button
          id="theme-toggle"
          onClick={() => setLightMode(m => !m)}
          title={lightMode ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          {lightMode ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        {user ? (
          <>
            {user.role === 'admin' && pendingShops.length > 0 && (
              <button onClick={() => { setShowModerationModal(true); fetchPendingShops(); }}
                style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid var(--accent-fake)', color: 'white', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                <ShieldAlert size={14} /> <span className="btn-text-responsive">Pendientes</span> <span style={{ background: 'var(--accent-fake)', padding: '2px 6px', borderRadius: '12px', fontSize: '0.7rem' }}>{pendingShops.length}</span>
              </button>
            )}
            <button onClick={() => { setIsAddMode(!isAddMode); if (isPanelOpen) closePanel(); }}
              style={{ background: isAddMode ? 'white' : 'var(--accent-specialty)', border: 'none', color: isAddMode ? 'black' : 'white', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              {isAddMode ? <X size={14} /> : <Plus size={14} />} <span className="btn-text-responsive">{isAddMode ? 'Cancelar' : 'Agregar'}</span>
            </button>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--border-color)', 
              border: '1px solid var(--border-color)',
              overflow: 'hidden' 
            }}>
              {user.picture ? (
                <img src={user.picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={16} color="var(--accent-brand)" />
              )}
            </div>
            <button onClick={handleLogout} title="Cerrar Sesión" style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
  );
}
