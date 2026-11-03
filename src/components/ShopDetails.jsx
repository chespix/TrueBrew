import { Coffee, AlertTriangle, ChevronDown, Check, ThumbsUp, ThumbsDown, Trash2, Edit3 } from 'lucide-react';
import { countVotes, getDerivedStatus } from '../lib/shopStatus';

// Bottom sheet content for the selected shop: status, votes and admin actions.
export default function ShopDetails({ selectedShop, user, isEditingShop, setIsEditingShop, editForm, setEditForm, closePanel, handleVote, setShowLoginModal, startEditing, saveEdit, handleDeleteShop }) {
  const { upvotes, downvotes } = countVotes(selectedShop);
  const status = getDerivedStatus(selectedShop);
  const myVote = user ? selectedShop.myVote : null;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {isEditingShop ? (
          <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ width: '80%', padding: '8px', marginBottom: '8px', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold' }} />
        ) : (
          <h2 className="shop-title">{selectedShop.name}</h2>
        )}
        <button className="btn-icon" onClick={closePanel}><ChevronDown size={24} /></button>
      </div>

      {isEditingShop ? (
        <input type="text" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '16px', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
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
        <textarea value={editForm.details} onChange={e => setEditForm({ ...editForm, details: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '16px', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', minHeight: '80px', resize: 'vertical' }} />
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
          <button onClick={() => setShowLoginModal(true)} style={{ background: 'var(--border-color)', border: 'none', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', width: '100%' }}>
            Inicia sesión para votar
          </button>
        </div>
      )}

      {/* Admin Actions */}
      {user?.role === 'admin' && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          {isEditingShop ? (
            <>
              <button onClick={() => setIsEditingShop(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => saveEdit(selectedShop.id)} style={{ flex: 1, background: 'var(--accent-specialty)', border: 'none', color: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar</button>
            </>
          ) : (
            <>
              <button onClick={startEditing} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <Edit3 size={16} /> Editar
              </button>
              <button onClick={() => handleDeleteShop(selectedShop.id)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--accent-fake)', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <Trash2 size={16} /> Eliminar
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
