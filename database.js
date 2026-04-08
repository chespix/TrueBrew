import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      picture TEXT,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shops (
      id BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      address TEXT DEFAULT '',
      details TEXT DEFAULT '',
      approved INTEGER DEFAULT 1,
      created_by TEXT DEFAULT 'system',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      shop_id BIGINT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('up', 'down')),
      PRIMARY KEY (shop_id, user_id),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    )
  `);
  
  console.log('✅ Base de datos PostgreSQL conectada e inicializada.');
  return pool;
}

// ── User Operations ──

export async function findOrCreateUser(googleId, email, name, picture, adminEmails) {
  const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [googleId]);
  const role = adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';

  if (rows.length > 0) {
    await pool.query(`UPDATE users SET role = $1, name = $2, picture = $3 WHERE id = $4`, [role, name, picture, googleId]);
  } else {
    await pool.query(`INSERT INTO users (id, email, name, picture, role) VALUES ($1, $2, $3, $4, $5)`,
      [googleId, email, name, picture, role]);
  }

  const result = await pool.query(`SELECT id, email, name, picture, role FROM users WHERE id = $1`, [googleId]);
  return result.rows[0];
}

// ── Shop Operations ──

async function attachVotes(shops) {
  if (shops.length === 0) return shops;
  const shopIds = shops.map(s => s.id);
  const { rows } = await pool.query(`SELECT shop_id, user_id, type FROM votes WHERE shop_id = ANY($1)`, [shopIds]);
  
  const voteMap = {};
  rows.forEach(r => {
    if (!voteMap[r.shop_id]) voteMap[r.shop_id] = {};
    voteMap[r.shop_id][r.user_id] = r.type;
  });

  return shops.map(shop => {
    shop.approved = !!shop.approved;
    shop.id = Number(shop.id);
    return { ...shop, votes: voteMap[shop.id] || {} };
  });
}

export async function getAllShops(userId) {
  let result;
  if (userId) {
    result = await pool.query(`SELECT * FROM shops WHERE approved = 1 OR created_by = $1`, [userId]);
  } else {
    result = await pool.query(`SELECT * FROM shops WHERE approved = 1`);
  }
  return await attachVotes(result.rows);
}

export async function getPendingShops() {
  const result = await pool.query(`SELECT * FROM shops WHERE approved = 0`);
  return await attachVotes(result.rows);
}

export async function createShop({ name, lat, lng, address, details, approved, createdBy }) {
  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  await pool.query(
    `INSERT INTO shops (id, name, lat, lng, address, details, approved, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, name, lat, lng, address || '', details || '', approved ? 1 : 0, createdBy]
  );
  const result = await pool.query(`SELECT * FROM shops WHERE id = $1`, [id]);
  const shops = await attachVotes(result.rows);
  return shops[0];
}

export async function updateShop(id, { name, address, details }) {
  await pool.query(
    `UPDATE shops SET name = COALESCE($1, name), address = COALESCE($2, address), details = COALESCE($3, details) WHERE id = $4`,
    [name, address, details, id]
  );
  const result = await pool.query(`SELECT * FROM shops WHERE id = $1`, [id]);
  const shops = await attachVotes(result.rows);
  return shops[0];
}

export async function approveShop(id) {
  await pool.query(`UPDATE shops SET approved = 1 WHERE id = $1`, [id]);
  const result = await pool.query(`SELECT * FROM shops WHERE id = $1`, [id]);
  const shops = await attachVotes(result.rows);
  return shops[0];
}

export async function deleteShop(id) {
  await pool.query(`DELETE FROM votes WHERE shop_id = $1`, [id]);
  await pool.query(`DELETE FROM shops WHERE id = $1`, [id]);
}

// ── Vote Operations ──

export async function upsertVote(shopId, userId, type) {
  const existing = await pool.query(`SELECT type FROM votes WHERE shop_id = $1 AND user_id = $2`, [shopId, userId]);
  
  if (existing.rows.length > 0) {
    if (existing.rows[0].type === type) {
      await pool.query(`DELETE FROM votes WHERE shop_id = $1 AND user_id = $2`, [shopId, userId]);
    } else {
      await pool.query(`UPDATE votes SET type = $1 WHERE shop_id = $2 AND user_id = $3`, [type, shopId, userId]);
    }
  } else {
    await pool.query(`INSERT INTO votes (shop_id, user_id, type) VALUES ($1, $2, $3)`, [shopId, userId, type]);
  }

  const result = await pool.query(`SELECT * FROM shops WHERE id = $1`, [shopId]);
  const shops = await attachVotes(result.rows);
  return shops[0];
}

// ── Seed ──

export async function seedFromMockShops(mockShops) {
  const countRes = await pool.query(`SELECT COUNT(*) as c FROM shops`);
  if (parseInt(countRes.rows[0].c, 10) > 0) {
    console.log('⚠️  Base de datos ya tiene datos. Saltando seed.');
    return;
  }

  for (const shop of mockShops) {
    await pool.query(
      `INSERT INTO shops (id, name, lat, lng, address, details, approved, created_by) VALUES ($1, $2, $3, $4, $5, $6, 1, 'system') ON CONFLICT (id) DO NOTHING`,
      [shop.id, shop.name, shop.lat, shop.lng, shop.address || '', shop.details || '']
    );
  }
  console.log(`✅ Seed completo: ${mockShops.length} cafés importados en PostgreSQL.`);
}
