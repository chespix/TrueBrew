// API Base URL configuration
// In development (Vite proxy): empty string means relative paths work via proxy
// In production/Capacitor: set VITE_API_URL to the full Render URL
export const API_BASE = import.meta.env.VITE_API_URL || '';
