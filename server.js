// ANVIL server: serves the game and a tiny high-score API on SQLite (node:sqlite, no dependencies).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 80);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'scores.db');
const INDEX = path.join(__dirname, 'index.html');
const FAVICON = path.join(__dirname, 'favicon.svg');
const MAX_NAME = 12, TOP_N = 20;

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

// one submission per IP per 10 s
const lastPost = new Map();
function clientIp(req) { return req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress; }

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function cleanName(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9 _.\-]/g, '').trim().slice(0, MAX_NAME) || 'ANON';
}
function int(v, lo, hi) { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; }

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/scores' && req.method === 'GET') {
    return json(res, 200, { scores: qTop.all(TOP_N) });
  }
  if (url.pathname === '/api/scores' && req.method === 'POST') {
    const ip = clientIp(req), now = Date.now();
    if (now - (lastPost.get(ip) || 0) < 10000) return json(res, 429, { error: 'slow down' });
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2048) req.destroy(); });
    req.on('end', () => {
      let d; try { d = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); }
      if (!d || typeof d !== 'object' || Array.isArray(d)) return json(res, 400, { error: 'bad json' });
      const name = cleanName(d.name), score = int(d.score, 0, 200000);
      const rank = ['S', 'A', 'B', 'C'].includes(d.rank) ? d.rank : null;
      const r = qInsert.run(name, score, rank, int(d.secs, 0, 86400), int(d.fragments, 0, 999), int(d.stomps, 0, 99));
      lastPost.set(ip, now);
      const id = Number(r.lastInsertRowid);
      const position = qPosition.get(score, score, id).n + 1;
      return json(res, 201, { id, position, scores: qTop.all(TOP_N) });
    });
    return;
  }
  if (url.pathname === '/healthz') return json(res, 200, { ok: true });
  if (req.method === 'GET' && (url.pathname === '/favicon.svg' || url.pathname === '/favicon.ico')) {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
    return fs.createReadStream(FAVICON).pipe(res);
  }
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    return fs.createReadStream(INDEX).pipe(res);
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found');
});
server.listen(PORT, () => console.log('anvil listening on ' + PORT + ', db ' + DB_PATH));
