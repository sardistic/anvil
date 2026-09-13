// ANVIL server: serves the game and a tiny high-score API on SQLite (node:sqlite, no dependencies).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 80);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'scores.db');
const INDEX = path.join(__dirname, 'index.html');
const FAVICON = path.join(__dirname, 'favicon.svg');
const MAX_NAME = 12, TOP_N = 20, MAX_BODY = 2048, POST_INTERVAL_MS = 10000;

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  rank TEXT,
  secs INTEGER,
  fragments INTEGER,
  stomps INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
); CREATE INDEX IF NOT EXISTS scores_by_score ON scores(score DESC, id ASC);`);
const qTop = db.prepare('SELECT id, name, score, rank, secs, fragments, stomps FROM scores ORDER BY score DESC, id ASC LIMIT ?');
const qInsert = db.prepare('INSERT INTO scores (name, score, rank, secs, fragments, stomps) VALUES (?, ?, ?, ?, ?, ?)');
const qPosition = db.prepare('SELECT COUNT(*) AS n FROM scores WHERE score > ? OR (score = ? AND id < ?)');

// one submission per IP per 10 s; the map is pruned so it cannot grow without bound
const lastPost = new Map();
function clientIp(req) { return req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?'; }
function prunePosts(now) { if (lastPost.size < 5000) return; for (const [ip, t] of lastPost) if (now - t > POST_INTERVAL_MS) lastPost.delete(ip); }

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // the game is one inline script + inline styles; it only talks to its own origin
  'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
};
function send(res, code, headers, body) { res.writeHead(code, Object.assign({}, SECURITY_HEADERS, headers)); res.end(body); }
function json(res, code, body) { send(res, code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, JSON.stringify(body)); }
function cleanName(s) {
  return (typeof s === 'string' ? s : '').toUpperCase().replace(/[^A-Z0-9 _.\-]/g, '').trim().slice(0, MAX_NAME) || 'ANON';
}
function int(v, lo, hi) { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; }

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) { req.destroy(); return reject(new Error('too large')); }
    let body = '', size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { req.destroy(); reject(new Error('too large')); return; } body += c; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
function sendFile(req, res, file, type, cache) {
  const st = fs.statSync(file);
  res.writeHead(200, Object.assign({}, SECURITY_HEADERS, { 'Content-Type': type, 'Cache-Control': cache, 'Content-Length': st.size }));
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

async function handle(req, res) {
  let url; try { url = new URL(req.url, 'http://x'); } catch { return json(res, 400, { error: 'bad url' }); }
  const p = url.pathname, m = req.method, read = m === 'GET' || m === 'HEAD';

  if (p === '/api/scores' && read) return json(res, 200, { scores: qTop.all(TOP_N) });
  if (p === '/api/scores' && m === 'POST') {
    const ip = clientIp(req), now = Date.now(); prunePosts(now);
    if (now - (lastPost.get(ip) || 0) < POST_INTERVAL_MS) return json(res, 429, { error: 'slow down' });
    let body; try { body = await readBody(req, MAX_BODY); } catch { if (!res.destroyed) json(res, 413, { error: 'too large' }); return; }
    let d; try { d = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); }
    if (!d || typeof d !== 'object' || Array.isArray(d)) return json(res, 400, { error: 'bad body' });
    const name = cleanName(d.name), score = int(d.score, 0, 200000);
    const rank = ['S', 'A', 'B', 'C'].includes(d.rank) ? d.rank : null;
    const r = qInsert.run(name, score, rank, int(d.secs, 0, 86400), int(d.fragments, 0, 999), int(d.stomps, 0, 99));
    lastPost.set(ip, now);
    const id = Number(r.lastInsertRowid);
    const position = qPosition.get(score, score, id).n + 1;
    return json(res, 201, { id, position, scores: qTop.all(TOP_N) });
  }
  if (p === '/healthz' && read) return json(res, 200, { ok: true });
  if (read && (p === '/favicon.svg' || p === '/favicon.ico')) return sendFile(req, res, FAVICON, 'image/svg+xml', 'public, max-age=86400');
  if (read && (p === '/' || p === '/index.html')) return sendFile(req, res, INDEX, 'text/html; charset=utf-8', 'no-cache');
  if (['/api/scores', '/', '/index.html', '/favicon.svg', '/favicon.ico', '/healthz'].includes(p)) {
    return send(res, 405, { 'Content-Type': 'text/plain', Allow: p === '/api/scores' ? 'GET, HEAD, POST' : 'GET, HEAD' }, 'method not allowed');
  }
  return send(res, 404, { 'Content-Type': 'text/plain' }, 'not found');
}

const server = http.createServer((req, res) => {
  // nothing a client sends may take the process down
  handle(req, res).catch(err => {
    console.error('request error', req.method, req.url, err && err.message);
    if (!res.headersSent) json(res, 500, { error: 'internal' }); else res.destroy();
  });
});
server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.keepAliveTimeout = 5000;
server.maxHeadersCount = 64;
process.on('uncaughtException', err => console.error('uncaught', err));
process.on('unhandledRejection', err => console.error('unhandled', err));
server.listen(PORT, () => console.log('anvil listening on ' + PORT + ', db ' + DB_PATH));
