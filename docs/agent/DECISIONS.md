# Decisions

## 2026-09-12 — Single-file game, static nginx container
- The whole game is one `index.html` (canvas + WebAudio, no build step). Keeping it single-file makes it trivially hostable anywhere and publishable as an artifact.
- Production is a static `nginx:alpine` image built from the repo `Dockerfile`; it exposes port 80 inside the container only and is reached through the host's edge network / tunnel. No secrets, no runtime config.
- HTML is served with `Cache-Control: no-cache` so game updates propagate through the CDN immediately.

## 2026-09-12 — High scores: Node + node:sqlite, no dependencies
- Replaced the nginx image with `node:24-alpine` running `server.js`: serves `index.html` and `/api/scores` (GET top 20, POST one score). Uses Node's built-in `node:sqlite`, so there is no `package.json`, no npm install, no native build.
- The database lives on a host volume (`./data:/data`, `DB_PATH=/data/scores.db`) so rebuilds keep scores.
- Input is sanitized server-side (name → A-Z0-9 space _ . -, max 12; numeric fields clamped); one POST per IP per 10 s. No auth — it's an arcade board, not a bank.
- The client degrades: if the API is unreachable (artifact copy, file://), the board shows "offline" and the run still ends normally.

## 2026-09-12 — Analytics and status
- First-party analytics via the house Umami instance (website `anvil.sardistic.com`, id 19f258b6-2f38-473f-8edc-cbdb82181854), tracker limited to that domain so local/artifact copies never report. Two custom events: `upload_complete` (run finished; rank, score, secs) and `score_saved`.
- CSP extended to allow the analytics script and its beacon; the game still loads nothing else off-origin.
- The site is registered on status.sardistic.com as a "Public apps" card bound to compose project `anvil`, checkout `/srv/anvil/repo`, and this repo; page views come from the domain-keyed Umami aggregation there.
