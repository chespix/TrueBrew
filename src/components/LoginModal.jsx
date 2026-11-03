import { Capacitor } from '@capacitor/core';
import { GoogleLogin } from '@react-oauth/google';
import { notify } from '../lib/notify';

// Google sign-in: native button on Android, Google Identity button on the web.
export default function LoginModal({ handleNativeGoogleLogin, handleWebGoogleLoginSuccess, setShowLoginModal }) {
  return (
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
  );
}
