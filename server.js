import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import rateLimit from 'express-rate-limit';
import {
  initDatabase, getAllShops, getPendingShops, createShop,
  updateShop, approveShop, deleteShop, upsertVote,
  findOrCreateUser, seedFromMockShops
} from './database.js';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'truebrew-fallback-secret';
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

// ── Routes ──

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
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
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

app.post('/api/shops', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const shop = await createShop({
      name: req.body.name,
      lat: req.body.lat,
      lng: req.body.lng,
      address: req.body.address,
      details: req.body.details,
      approved: isAdmin,
      createdBy: req.user.id
    });
    res.status(201).json(shop);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/shops/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const shop = await updateShop(id, req.body);
    if (!shop) return res.status(404).json({ error: "Local no encontrado" });
    res.json(shop);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/shops/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await deleteShop(parseInt(req.params.id, 10));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Voting
app.put('/api/shops/:id/vote', authenticateToken, async (req, res) => {
  try {
    const shopId = parseInt(req.params.id, 10);
    const shop = await upsertVote(shopId, req.user.id, req.body.type);
    if (!shop) return res.status(404).json({ error: "Local no encontrado" });
    res.json(shop);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Moderation
app.get('/api/admin/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const shops = await getPendingShops();
    res.json(shops);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/shops/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const shop = await approveShop(parseInt(req.params.id, 10));
    if (!shop) return res.status(404).json({ error: "Local no encontrado" });
    res.json(shop);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
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
