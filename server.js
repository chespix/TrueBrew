import crypto from 'crypto';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import rateLimit from 'express-rate-limit';
import {
  initDatabase, getAllShops, getPendingShops, createShop,
  updateShop, approveShop, deleteShop, upsertVote,
  findOrCreateUser, seedFromMockShops, pingDb
} from './database.js';

const app = express();

// Render (and most hosts) put the app behind a proxy. Without this, every
// request looks like it comes from the proxy's IP, so all users would share
// a single rate-limit bucket. TRUST_PROXY is the number of proxy hops.
app.set('trust proxy', parseInt(process.env.TRUST_PROXY || '1', 10));
const PORT = process.env.PORT || 3001;
// The old hardcoded fallback secret let anyone sign their own admin token.
// If JWT_SECRET is missing we now derive one from DATABASE_URL, which already
// contains the DB password, so it is secret and stable across restarts.
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Faltan JWT_SECRET y DATABASE_URL.');
    process.exit(1);
  }
  JWT_SECRET = crypto.createHash('sha256').update(`truebrew-jwt:${process.env.DATABASE_URL}`).digest('hex');
  console.warn('⚠️  JWT_SECRET no configurado: usando uno derivado de DATABASE_URL. Configuralo en Render.');
}
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json());

// ── Rate Limiting ──
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' }
});

app.use('/api/', apiLimiter);

// ── Auth Middleware ──

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "No autenticado." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido o expirado." });
    req.user = user;
    next();
  });
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err) req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Se requiere cuenta de Admin." });
  }
  next();
}

// ── Validation helpers ──

// Logs the real error and sends a generic message, so DB details never reach clients.
function serverError(res, e) {
  console.error(e);
  res.status(500).json({ error: "Error interno del servidor." });
}

function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID inválido." });
    return null;
  }
  return id;
}

// Optional text field: undefined stays undefined (means "don't change"),
// otherwise it must be a string up to maxLen characters.
function optionalText(value, maxLen) {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value !== 'string') return { ok: false };
  const trimmed = value.trim();
  if (trimmed.length > maxLen) return { ok: false };
  return { ok: true, value: trimmed };
}

const LIMITS = { name: 100, address: 200, details: 1000 };

// Generous box around Buenos Aires (CABA + conurbano).
const BOUNDS = { minLat: -35.2, maxLat: -34.2, minLng: -59.2, maxLng: -57.8 };

function validateShopInput(body, { requireAll }) {
  const out = {};
  for (const field of ['name', 'address', 'details']) {
    const r = optionalText(body[field], LIMITS[field]);
    if (!r.ok) return { error: `Campo "${field}" inválido (máx. ${LIMITS[field]} caracteres).` };
    out[field] = r.value;
  }
  if (requireAll) {
    if (!out.name) return { error: "El nombre es obligatorio." };
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (body.lat === null || body.lng === null || !Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat < BOUNDS.minLat || lat > BOUNDS.maxLat || lng < BOUNDS.minLng || lng > BOUNDS.maxLng) {
      return { error: "Ubicación inválida o fuera de Buenos Aires." };
    }
    out.lat = lat;
    out.lng = lng;
  } else if (out.name === '') {
    return { error: "El nombre no puede quedar vacío." };
  }
  return { value: out };
}

// Stricter limit for creating shops, to slow down spam of pending entries.
const createShopLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { error: 'Agregaste muchos locales seguidos. Probá de nuevo en un rato.' }
});

// ── Routes ──

// ── Keepalive / Health check (no auth required) ──
// Use this to keep the Render PostgreSQL DB from sleeping:
//   curl https://your-app.onrender.com/api/ping
app.get('/api/ping', async (req, res) => {
  try {
    const dbMs = await pingDb();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db_response_ms: dbMs
    });
  } catch (e) {
    console.error('Ping error:', e);
    res.status(500).json({ status: 'error' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const credential = req.body?.credential;
    if (typeof credential !== 'string' || !credential) return res.status(400).json({ error: "Falta la credencial." });
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    const user = await findOrCreateUser(googleId, email, name, picture, ADMIN_EMAILS);
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, picture: user.picture, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, picture: user.picture, role: user.role } });
  } catch (e) {
    console.error('Google auth error:', e);
    res.status(401).json({ error: "Autenticación de Google fallida." });
  }
});

// Shops
app.get('/api/shops', optionalAuth, async (req, res) => {
  try {
    const shops = await getAllShops(req.user?.id);
    res.json(shops);
  } catch (e) {
    serverError(res, e);
  }
});

app.post('/api/shops', authenticateToken, createShopLimiter, async (req, res) => {
  const { value, error } = validateShopInput(req.body || {}, { requireAll: true });
  if (error) return res.status(400).json({ error });
  try {
    const isAdmin = req.user.role === 'admin';
    const shop = await createShop({
      ...value,
      approved: isAdmin,
      createdBy: req.user.id
    });
    res.status(201).json(shop);
  } catch (e) {
    serverError(res, e);
  }
});

app.patch('/api/shops/:id', authenticateToken, requireAdmin, async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  const { value, error } = validateShopInput(req.body || {}, { requireAll: false });
  if (error) return res.status(400).json({ error });
  try {
    const shop = await updateShop(id, value, req.user.id);
    if (!shop) return res.status(404).json({ error: "Local no encontrado" });
    res.json(shop);
  } catch (e) {
    serverError(res, e);
  }
});

app.delete('/api/shops/:id', authenticateToken, requireAdmin, async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  try {
    await deleteShop(id);
    res.json({ success: true });
  } catch (e) {
    serverError(res, e);
  }
});

// Voting
app.put('/api/shops/:id/vote', authenticateToken, async (req, res) => {
  const shopId = parseId(req, res);
  if (shopId === null) return;
  const type = req.body?.type;
  if (type !== 'up' && type !== 'down') return res.status(400).json({ error: "Voto inválido." });
  try {
    const shop = await upsertVote(shopId, req.user.id, type);
    if (!shop) return res.status(404).json({ error: "Local no encontrado" });
    res.json(shop);
  } catch (e) {
    serverError(res, e);
  }
});

// Moderation
app.get('/api/admin/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const shops = await getPendingShops();
    res.json(shops);
  } catch (e) {
    serverError(res, e);
  }
});

app.patch('/api/shops/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  try {
    const shop = await approveShop(id, req.user.id);
    if (!shop) return res.status(404).json({ error: "Local no encontrado" });
    res.json(shop);
  } catch (e) {
    serverError(res, e);
  }
});

// Reset / Seed
app.post('/api/reset', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const module = await import('./src/data/mockShops.js');
    await seedFromMockShops(module.mockShops);
    const shops = await getAllShops();
    res.json({ success: true, count: shops.length });
  } catch (e) {
    serverError(res, e);
  }
});

// ── Overture Maps Search Proxy ──
const OVERTURE_API_KEY = process.env.OVERTURE_API_KEY || 'DEMO-API-KEY';
// Center of CABA with 15km radius to cover the whole city
const CABA_LAT = -34.6037;
const CABA_LON = -58.3816;
const CABA_RADIUS = 15000;

// The request to Overture is always the same (every coffee shop in CABA, up
// to 1500), only the local filter changes. So the list is downloaded once and
// kept in memory for a few hours instead of on every keystroke.
const OVERTURE_CACHE_MS = 6 * 60 * 60 * 1000;
let overtureCache = { places: null, fetchedAt: 0 };
let overtureInflight = null;

// Lowercase and strip accents, so "cafe" matches "Café".
const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

async function fetchOverturePlaces() {
  const url = new URL('https://api.overturemapsapi.com/places');
  url.searchParams.set('lat', CABA_LAT);
  url.searchParams.set('lng', CABA_LON);
  url.searchParams.set('radius', CABA_RADIUS);
  url.searchParams.set('categories', 'coffee_shop');
  url.searchParams.set('country', 'AR');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1500');

  const response = await fetch(url.toString(), {
    headers: { 'x-api-key': OVERTURE_API_KEY },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    throw new Error(`Overture API ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const raw = Array.isArray(data) ? data : (data.places || data.features || []);
  return raw
    .map(p => {
      const coords = p?.geometry?.coordinates || [];
      const props = p?.properties || {};
      const name = props?.names?.primary || props?.ext_name || props?.name || '';
      const addr = props?.addresses;
      const address = (Array.isArray(addr) ? addr[0]?.freeform : addr?.freeform) || '';
      return { overtureId: p.id, name, search: normalize(name), address, lat: coords[1] ?? null, lng: coords[0] ?? null };
    })
    .filter(p => p.name && p.lat !== null && p.lng !== null);
}

async function getOverturePlaces() {
  const fresh = overtureCache.places && Date.now() - overtureCache.fetchedAt < OVERTURE_CACHE_MS;
  if (fresh) return overtureCache.places;
  if (!overtureInflight) {
    overtureInflight = fetchOverturePlaces()
      .then(places => {
        if (places.length > 0) overtureCache = { places, fetchedAt: Date.now() };
        return places;
      })
      .finally(() => { overtureInflight = null; });
  }
  try {
    return await overtureInflight;
  } catch (e) {
    // If the refresh fails, keep serving the old list rather than nothing.
    if (overtureCache.places) return overtureCache.places;
    throw e;
  }
}

app.get('/api/search/overture', optionalAuth, async (req, res) => {
  const q = normalize((req.query.q || '').toString().trim()).slice(0, 100);
  if (q.length < 3) return res.json([]);

  try {
    const places = await getOverturePlaces();
    // Names that start with the query come first.
    const results = places
      .filter(p => p.search.includes(q))
      .sort((a, b) => Number(!a.search.startsWith(q)) - Number(!b.search.startsWith(q)))
      .slice(0, 10)
      .map(({ overtureId, name, address, lat, lng }) => ({ overtureId, name, address, lat, lng }));

    res.json(results);
  } catch (e) {
    console.error('Overture search error:', e);
    res.json([]); // Fail gracefully — never crash the app
  }
});

// ── Geocoding Search Proxy ──
// Nominatim's usage policy asks for an identifying User-Agent with real
// contact info, at most 1 request per second, and caching of results.
const NOMINATIM_USER_AGENT = `TrueBrew/1.0 (+https://github.com/chespix/TrueBrew${process.env.CONTACT_EMAIL ? `; ${process.env.CONTACT_EMAIL}` : ''})`;
const GEOCODE_CACHE_MS = 24 * 60 * 60 * 1000;
const GEOCODE_CACHE_MAX = 500;
const geocodeCache = new Map(); // query -> { results, at }
let lastNominatimCall = 0;

app.get('/api/search/geocode', optionalAuth, async (req, res) => {
  const q = (req.query.q || '').toString().trim().slice(0, 200);
  if (q.length < 3) return res.json([]);

  const cacheKey = q.toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < GEOCODE_CACHE_MS) return res.json(cached.results);

  // Stay under 1 request per second across all users.
  const wait = lastNominatimCall + 1000 - Date.now();
  if (wait > 5000) return res.json([]); // too busy, skip rather than queue forever
  lastNominatimCall = Math.max(Date.now(), lastNominatimCall + 1000);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'ar');
    // Bound search to CABA (Buenos Aires city)
    url.searchParams.set('viewbox', '-58.5318,-34.7056,-58.3351,-34.5265');
    url.searchParams.set('bounded', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.error('Nominatim API error:', response.status, await response.text());
      return res.json([]);
    }

    const data = await response.json();
    if (!Array.isArray(data)) return res.json([]);

    const cleanAddress = (displayName) => {
      const parts = displayName.split(',').map(p => p.trim());
      if (parts.length === 0) return displayName;
      
      // If first part is numeric (house number) and second part is street name, combine them
      if (parts.length > 1 && /^\d+$/.test(parts[0])) {
        parts[1] = `${parts[1]} ${parts[0]}`;
        parts.shift();
      }
      
      const cleanParts = parts.filter(p => {
        const lower = p.toLowerCase();
        if (lower === 'argentina') return false;
        if (lower.includes('ciudad autónoma de buenos aires')) return false;
        if (lower === 'buenos aires') return false;
        if (lower.startsWith('comuna ')) return false;
        if (/^[a-z]?\d{4}[a-z]{3}$/i.test(p)) return false; // C1425BGV
        if (/^\d{4}$/.test(p)) return false; // 1425
        return true;
      });
      
      return cleanParts.slice(0, 2).join(', ');
    };

    const results = data.map(item => ({
      name: cleanAddress(item.display_name),
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    })).filter(item => !isNaN(item.lat) && !isNaN(item.lng));

    if (geocodeCache.size >= GEOCODE_CACHE_MAX) {
      geocodeCache.delete(geocodeCache.keys().next().value); // drop the oldest
    }
    geocodeCache.set(cacheKey, { results, at: Date.now() });
    res.json(results);
  } catch (e) {
    console.error('Geocoding search error:', e);
    res.json([]); // Fail gracefully
  }
});

// ── Production: Serve static frontend ──
if (process.env.NODE_ENV === 'production') {
  import('path').then(pathModule => {
    import('url').then(urlModule => {
      const __dirname = pathModule.dirname(urlModule.fileURLToPath(import.meta.url));
      app.use(express.static(pathModule.join(__dirname, 'dist')));
      app.use((req, res, next) => {
        if (req.method !== 'GET') return next();
        res.sendFile(pathModule.join(__dirname, 'dist', 'index.html'));
      });
    });
  });
}

// ── Start ──
async function start() {
  await initDatabase();

  if (process.argv.includes('--seed')) {
    try {
      const module = await import('./src/data/mockShops.js');
      await seedFromMockShops(module.mockShops);
    } catch (e) {
      console.error('❌ Error seeding:', e);
    }
  }

  app.listen(PORT, () => {
    console.log(`✅ TrueBrew API v6 (PostgreSQL) en puerto ${PORT}`);
    console.log(`   Google Client ID: ${GOOGLE_CLIENT_ID ? '✔ configurado' : '✗ FALTA'}`);
    console.log(`   Admins: ${ADMIN_EMAILS.join(', ')}`);
  });
}

start();
