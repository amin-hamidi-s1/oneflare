# OneFlare — Troubleshooting Guide

Common problems attendees and operators hit, grouped by where they show up. If
something isn't here, check [`docs/admin-guide.md`](admin-guide.md) for the
underlying config, or the relevant source: [`lab-ui/backend/main.py`](../lab-ui/backend/main.py)
(WebSocket run + campaign REST endpoints), [`lab-ui/backend/campaign_engine.py`](../lab-ui/backend/campaign_engine.py)
(the ThreatOps drip engine), [`attack-scripts/config.py`](../attack-scripts/config.py)
(env vars the scripts actually read).

---

## Console / connectivity

### "ERROR: WebSocket connection failed. Is the backend running?"
The frontend couldn't open `ws(s)://<host>/ws/run/{scenario_id}`.
- Local Docker: confirm `docker compose ps` shows `backend` up on `:8000` and
  `frontend` up on `:3000`/`:80`. `docker compose logs backend` for a crash.
- The frontend proxies `/api/*` and `/ws/*` to the backend at build/serve time via
  nginx (Docker) — if you're running the Vite dev server directly instead of
  Docker, make sure its proxy/`vite.config.js` target still points at the backend.
- Reference/shared instance down: nothing you can fix client-side; tell your
  facilitator/operator.

### Run button stays disabled, red "Configure your Cloudflare domain in Settings" banner
`isConfigured` in the frontend is false, meaning **no** domain came from either your
browser's Settings *or* the server's `GET /api/config` response. Either:
- Set a Domain in Settings yourself, or
- The instance genuinely has no server default configured — that's an operator-side
  fix (`LAB_CF_DOMAIN` env var; see the admin guide).

### Run completes but with a non-zero exit code / errors in the terminal
The subprocess itself failed — read the streamed output, it's the actual Python
traceback/error from the scenario script. Common causes: target domain unreachable
(DNS doesn't resolve, or the Cloudflare Worker isn't deployed there), or a
misconfigured URL override in Settings pointing at a dead host.

---

## Docker build issues

### Build hangs or fails with `ECONNRESET` / TLS errors, especially on a corporate laptop
This is almost always **Zscaler (or similar TLS-inspecting proxy) breaking npm's TLS
handshake** during the frontend's `npm install`. Known fixes, in order of preference:
1. Already applied in [`lab-ui/frontend/Dockerfile.dev`](../lab-ui/frontend/Dockerfile.dev):
   `node:22-slim` base, `--maxsockets=1` (serializes downloads to one connection so
   the flaky proxy connection doesn't get hammered by parallel fetches), and a
   `--mount=type=cache,target=/root/.npm` BuildKit cache mount so a retry resumes
   from whatever already downloaded instead of starting over.
2. If it still fails: temporarily disable Zscaler / connect to a non-inspected
   network for the `docker compose up --build` step, then re-enable it — the built
   image doesn't need the proxy again afterward.
3. Confirm BuildKit is actually enabled (`DOCKER_BUILDKIT=1`, or Docker Desktop's
   "Use containerd/BuildKit" setting) — the cache mount silently no-ops without it,
   so failed installs won't resume.

### Build is extremely slow on Apple Silicon (M-series Mac)
You're hitting QEMU x86_64 emulation. Use
[`lab-ui/docker-compose.override.yml`](../lab-ui/docker-compose.override.yml) (already
gitignored, meant to exist locally) — it pins `platform: linux/arm64` so both
services build natively instead of emulating. It also repoints the backend build
context to the repo root (needed since the backend Dockerfile `COPY`s the sibling
`attack-scripts/` directory) and swaps the frontend to `Dockerfile.dev` so the whole
stack builds with just Docker installed, no host Node required.

### Backend image builds but crashes / `ModuleNotFoundError` for `campaigns` or `scenarios`
`PYTHONPATH=/app/attack-scripts` must be set (docker-compose.yml sets it) **and** the
`attack-scripts/` directory must actually be present at that path — via the read-only
bind mount in local dev, or baked in via `COPY attack-scripts/ /app/attack-scripts/`
in the production Dockerfile. If you rearranged the repo layout or run the backend
outside Docker, set `PYTHONPATH` yourself before starting uvicorn.

---

## Campaign / ThreatOps engine

### `POST /api/campaign/launch` → 400 "A campaign is already running"
Only one drip-flow campaign can run at a time (module-level state in
`campaign_engine.py`). Call `POST /api/campaign/stop` (or hit Stop in the ThreatOps
UI) before launching another — including after a page refresh, since the engine
keeps running server-side even if you navigate away.

### `GET /api/campaigns` (or any `/api/campaign/*` call) → 503 "Campaign engine unavailable"
`campaign_engine.py` failed to import the `campaigns` package at backend startup
(caught non-fatally so the rest of the API stays up). Check the backend logs for the
actual `ImportError` — usually a missing `PYTHONPATH` (see above) or a genuinely
broken import in `attack-scripts/campaigns/`.

### SoleDrop shop status page stuck showing an incident banner after a CTF run
`campaign_engine.py`'s `_signal_shop_incident` posts to the shop's own
`/api/incident` and is normally cleared automatically when the campaign stops (or the
CTF campaign specifically stops). If it's stuck:
- Call `POST /api/campaign/clear-incident` — idempotent, safe to call anytime.
- If that silently no-ops, `INCIDENT_KEY` isn't set (or doesn't match the SoleDrop
  worker's own `INCIDENT_KEY` secret) on the lab-ui backend — the call fails closed
  and does nothing rather than erroring. This is an operator-side config check.

---

## Detection / SentinelOne side

### Ran a scenario, WAF didn't visibly block anything
Some scenarios are **intentionally allowed through** so the detection has data to
correlate on (the story-map explains which get blocked vs logged per scenario) — a
pass-through isn't necessarily a bug. Check the scenario's "How It Works" tab for what
should happen at the edge.

### Traffic isn't showing up in SentinelOne at all
- **Logpush lag** — allow ~60 seconds for delivery before assuming it's broken.
- Confirm the relevant Logpush job (HTTP Requests / Firewall Events / Gateway DNS /
  Access Requests, depending on the scenario) is actually configured and pointed at
  your SentinelOne HEC URL + token for **the zone the traffic actually hit** — easy
  to configure the wrong zone if you have more than one.
- Confirm the OCSF parser is deployed on that SDL instance — unparsed Logpush JSON
  won't populate the OCSF fields the detections query.

### DNS tunneling scenario runs fine but nothing shows up in Cloudflare Gateway logs
Almost always the **Gateway DoH URL** is wrong. It must be the **hex-subdomain**
endpoint from `one.dash.cloudflare.com → Networks → Resolvers & Proxies → DNS
locations → [your location] → DNS over HTTPS`
(`https://<hex-id>.cloudflare-gateway.com/dns-query`) — the `<team>.cloudflareaccess.com`
team URL will happily resolve DNS but does **not** log queries to Gateway activity or
Logpush, so you get a working scenario and silent detection gap. See
`attack-scripts/config.py`'s `_normalize_doh_url` docstring for the exact requirement.

### Score-based detections (`WAFAttackScore`, `BotScore`/JA4, `FirewallForAIInjectionScore`) never fire
These fields only populate with the matching **Enterprise entitlement** enabled on
the zone (WAF ML, Bot Management, Firewall for AI respectively). The
behavioral/regex/volume-based detection arms fire regardless of tier — check the
scenario's SIEM Detection tab for the non-score fallback logic.

### CTF subdomain (`<name>.lab.soledrop.co`) traffic not appearing when filtering by hostname
- Confirm the wildcard DNS record and STAR detection rules actually cover your
  specific subdomain (they're written to match on `contains
  '.lab.soledrop.co'`, not an exact host, so a typo'd subdomain won't match a
  hardcoded exact-match rule elsewhere).
- Confirm you actually ran the attack against `<name>.lab.soledrop.co` and not the
  base `shop.soledrop.co` default (check Settings → Target URL Overrides was set
  before you ran).

---

## Docs page

### Docs page only shows the attendee doc set, even for an operator
Expected on a plain local/Docker instance — Cloudflare Access only sits in front of
a console deployed behind a Cloudflare-proxied route, so there's no identity to
check locally and the backend fails closed to the `attendee` role. On a
Cloudflare-deployed instance: confirm `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set
on the backend and match the actual Access Application, and that your email is in
`DOCS_ADMIN_EMAILS` (comma-separated, case-insensitive). See
[`docs/admin-guide.md`](admin-guide.md) §6.

### `GET /api/docs/{id}` returns 404 for a doc you expect to see
Either the id doesn't exist, or it exists but isn't visible at your resolved role —
both cases return 404 (not 403) on purpose, so the manifest of admin-only docs isn't
enumerable from the attendee role. If you're expecting admin access, see the item
above.

### Docs page loads the list but content pane errors / "Couldn't load"
The backend's `DOCS_ROOT` (default `/app/docs-root`) doesn't have the file — check
that `docker-compose.yml`'s bind mounts for `README.md`/`ARCHITECTURE.md`/`docs/`
are present (local dev) or that the production image was rebuilt after adding a new
doc to `docs_registry.py`'s manifest (the Dockerfile `COPY`s `docs/` in at build
time, so a new file needs a rebuild, not just a container restart).

## Settings / history

### Settings or run history "disappeared"
localStorage is **per-browser, per-origin** — switching browsers, using a private
window, or clearing site data all reset it. There's no server-side account system.
Use Export/Import in Settings to move settings between browsers; run history isn't
exportable (only viewable/copyable per-entry).

### Imported a settings JSON and tokens didn't come back
By design — `exportSettings()` strips `cf_api_token` and `s1_api_token` before
export, so an exported file never contains a secret. Re-enter tokens manually after
import.
