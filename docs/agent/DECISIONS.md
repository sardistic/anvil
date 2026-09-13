# Decisions

## 2026-09-12 — Single-file game, static nginx container
- The whole game is one `index.html` (canvas + WebAudio, no build step). Keeping it single-file makes it trivially hostable anywhere and publishable as an artifact.
- Production is a static `nginx:alpine` image built from the repo `Dockerfile`; it exposes port 80 inside the container only and is reached through the host's edge network / tunnel. No secrets, no runtime config.
- HTML is served with `Cache-Control: no-cache` so game updates propagate through the CDN immediately.
