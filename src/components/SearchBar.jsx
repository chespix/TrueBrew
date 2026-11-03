import { Search, X, RefreshCw } from 'lucide-react';

// Floating search: Overture cafés to add, and addresses to place a new shop.
export default function SearchBar({ searchQuery, setSearchQuery, overtureResults, geocodeResults, overtureLoading, geocodeLoading, showOvertureDrop, setShowOvertureDrop, handleOvertureSelect, handleGeocodeSelect, onRefresh }) {
  return (
    <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 20px) + 80px)', left: '10px', right: '54px', zIndex: 1000, display: 'flex', gap: '8px' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '8px', display: 'flex', alignItems: 'center', padding: '0 10px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <Search size={16} color="var(--text-secondary)" />
          <input id="search-bar" type="text" placeholder="Buscar cafetería o dirección..." value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); }}
            onBlur={() => setTimeout(() => setShowOvertureDrop(false), 200)}
            onFocus={() => (overtureResults.length > 0 || geocodeResults.length > 0) && setShowOvertureDrop(true)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '10px', outline: 'none' }} />
          {(overtureLoading || geocodeLoading) && <div style={{ width: 14, height: 14, border: '2px solid var(--accent-specialty)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
          {searchQuery && !(overtureLoading || geocodeLoading) && <X size={16} color="var(--text-secondary)" style={{cursor:'pointer', flexShrink: 0}} onClick={() => { setSearchQuery(''); setShowOvertureDrop(false); }} />}
        </div>
    
        {/* Suggestions Dropdown */}
        {showOvertureDrop && (overtureResults.length > 0 || geocodeResults.length > 0) && (
          <div className="overture-dropdown" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {/* Overture Cafes */}
            {overtureResults.length > 0 && (
              <>
                <div style={{ padding: '8px 12px 4px', fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Cafés en Overture Maps</div>
                {overtureResults.map(place => (
                  <div key={place.overtureId} className="overture-item" onMouseDown={() => handleOvertureSelect(place)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</div>
                      {place.address && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.address}</div>}
                    </div>
                    <span className="overture-badge">+ Agregar</span>
                  </div>
                ))}
              </>
            )}

            {/* Address Geocoding */}
            {geocodeResults.length > 0 && (
              <>
                <div style={{ padding: '8px 12px 4px', fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', borderTop: overtureResults.length > 0 ? '1px solid var(--border-color)' : 'none', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>📍 Agregar en dirección</div>
                {geocodeResults.map((place, idx) => (
                  <div key={`geo-${idx}`} className="overture-item" onMouseDown={() => handleGeocodeSelect(place)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Buenos Aires, CABA</div>
                    </div>
                    <span className="overture-badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.4)' }}>+ Ubicar</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      <button onClick={onRefresh}
        style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', flexShrink: 0 }}>
        <RefreshCw size={18} />
      </button>
    </div>
  );
}
