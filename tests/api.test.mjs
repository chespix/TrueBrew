// API smoke tests. Needs a throwaway Postgres in DATABASE_URL (tables are dropped!).
// Run: DATABASE_URL=postgres://... npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const SECRET = 'test-secret';
const sign = (payload) => jwt.sign(payload, SECRET);
const USER = sign({ id: 'user-1', email: 'u1@test.com', role: 'user' });
const USER2 = sign({ id: 'user-2', email: 'u2@test.com', role: 'user' });
const ADMIN = sign({ id: 'admin-1', email: 'admin@test.com', role: 'admin' });

let server;

async function api(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

before(async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false } });
  await client.connect();
  await client.query('DROP TABLE IF EXISTS votes, shops, users');
  await client.end();

  server = spawn('node', ['server.js', '--seed'], {
    env: { ...process.env, PORT: String(PORT), JWT_SECRET: SECRET, NODE_ENV: 'test', ADMIN_EMAILS: 'admin@test.com' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => { if (d.toString().includes('en puerto')) resolve(); });
    server.on('exit', (code) => reject(new Error(`server exited with ${code}`)));
  });
});

after(() => server?.kill());

test('ping', async () => {
  const r = await api('GET', '/api/ping');
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'ok');
});

test('shops list does not expose voter or creator ids', async () => {
  const { body: shops } = await api('GET', '/api/shops');
  assert.ok(shops.length > 0, 'seed should load shops');
  const id = shops[0].id;
  await api('PUT', `/api/shops/${id}/vote`, { token: USER, body: { type: 'up' } });
  await api('PUT', `/api/shops/${id}/vote`, { token: USER2, body: { type: 'down' } });

  const { body: anon } = await api('GET', '/api/shops');
  const shop = anon.find(s => s.id === id);
  assert.equal(shop.upvotes, 1);
  assert.equal(shop.downvotes, 1);
  assert.equal(shop.myVote, null);
  assert.equal(shop.created_by, undefined);
  const raw = JSON.stringify(anon);
  assert.ok(!raw.includes('user-1') && !raw.includes('user-2'));

  const { body: mine } = await api('GET', '/api/shops', { token: USER });
  assert.equal(mine.find(s => s.id === id).myVote, 'up');
});

test('voting the same way twice removes the vote', async () => {
  const { body: shops } = await api('GET', '/api/shops');
  const id = shops[1].id;
  const first = await api('PUT', `/api/shops/${id}/vote`, { token: USER, body: { type: 'up' } });
  assert.equal(first.body.upvotes, 1);
  const second = await api('PUT', `/api/shops/${id}/vote`, { token: USER, body: { type: 'up' } });
  assert.equal(second.body.upvotes, 0);
  assert.equal(second.body.myVote, null);
});

test('vote input is validated', async () => {
  const { body: shops } = await api('GET', '/api/shops');
  const id = shops[0].id;
  assert.equal((await api('PUT', `/api/shops/${id}/vote`, { body: { type: 'up' } })).status, 401);
  assert.equal((await api('PUT', `/api/shops/${id}/vote`, { token: USER, body: { type: 'meh' } })).status, 400);
  assert.equal((await api('PUT', '/api/shops/abc/vote', { token: USER, body: { type: 'up' } })).status, 400);
  assert.equal((await api('PUT', '/api/shops/123/vote', { token: USER, body: { type: 'up' } })).status, 404);
});

test('creating a shop validates input and leaves it pending', async () => {
  const bad = [
    { lat: -34.6, lng: -58.4 },
    { name: 'x', lat: 10, lng: -58.4 },
    { name: 'x', lat: null, lng: -58.4 },
    { name: 'a'.repeat(101), lat: -34.6, lng: -58.4 },
    { name: 42, lat: -34.6, lng: -58.4 },
  ];
  for (const body of bad) {
    assert.equal((await api('POST', '/api/shops', { token: USER, body })).status, 400, JSON.stringify(body));
  }
  const ok = await api('POST', '/api/shops', { token: USER, body: { name: ' Café Test ', lat: -34.6, lng: -58.4 } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.name, 'Café Test');
  assert.equal(ok.body.approved, false);
  assert.equal(ok.body.mine, true);

  const anon = await api('GET', '/api/shops');
  assert.ok(!anon.body.some(s => s.id === ok.body.id), 'pending shop hidden from others');

  const pending = await api('GET', '/api/admin/pending', { token: ADMIN });
  assert.ok(pending.body.some(s => s.id === ok.body.id));
  assert.equal((await api('GET', '/api/admin/pending', { token: USER })).status, 403);

  const approved = await api('PATCH', `/api/shops/${ok.body.id}/approve`, { token: ADMIN });
  assert.equal(approved.body.approved, true);
});

test('admin edits are validated', async () => {
  const { body: shops } = await api('GET', '/api/shops');
  const id = shops[0].id;
  assert.equal((await api('PATCH', `/api/shops/${id}`, { token: USER, body: { details: 'x' } })).status, 403);
  assert.equal((await api('PATCH', `/api/shops/${id}`, { token: ADMIN, body: { name: '' } })).status, 400);
  const r = await api('PATCH', `/api/shops/${id}`, { token: ADMIN, body: { details: 'nuevo' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.details, 'nuevo');
  assert.equal(r.body.name, shops[0].name);
});

test('forged tokens are rejected', async () => {
  const forged = jwt.sign({ id: 'x', role: 'admin' }, 'truebrew-fallback-secret');
  assert.equal((await api('GET', '/api/admin/pending', { token: forged })).status, 403);
});
