# OneFlare — Admin / Operator Guide

For whoever stands up and runs a OneFlare instance — locally, for a workshop, or as a
shared reference deployment. Assumes you've already provisioned the Cloudflare side
(`cloudflare/setup.sh`, per [`README.md`](../README.md)); this covers running and
configuring the **console** (`lab-ui/`).

---

## 1. Running the stack

```bash
cd lab-ui
docker compose up --build
```

- `frontend` — Vite build served by nginx on `:3000` (mapped from container `:80`).
- `backend` — FastAPI/Uvicorn on `:8000`.
- The backend bind-mounts `../attack-scripts` **read-only**, plus a named volume
  (`attack_logs`) overlaid on its `logs/` subdirectory so scripts can write log files
  without hitting a read-only-filesystem error.

### Local dev override (Apple Silicon / no host Node)

[`lab-ui/docker-compose.override.yml`](../lab-ui/docker-compose.override.yml) is
gitignored and meant to exist locally, not be committed. It:
1. Pins `platform: linux/arm64` on both services so Apple Silicon builds natively
   instead of emulating x86_64 under QEMU.
2. Repoints the backend build context to the repo root, since its Dockerfile needs
   to `COPY` the sibling `attack-scripts/` directory.
3. Swaps the frontend build to `Dockerfile.dev`, which compiles the Vite SPA **inside
   Docker** (multi-stage: `node:22-slim` build stage → `nginx:alpine` runtime), so the
   whole stack builds with only Docker installed — no host Node/npm needed.

Docker-compose auto-merges `docker-compose.yml` + `docker-compose.override.yml` if
both are present, so `docker compose up --build` picks this up with no extra flags.

### Known build gotcha — Zscaler / TLS-inspecting proxies

Corporate TLS inspection (Zscaler and similar) commonly breaks `npm install`'s TLS
handshake mid-build with `ECONNRESET` / "Exit handler never called" errors. Already
mitigated in `Dockerfile.dev`:
- `--maxsockets=1` serializes npm's downloads to one connection.
- A `--mount=type=cache,target=/root/.npm` BuildKit cache mount persists `/root/.npm`
  across build attempts so a retry resumes rather than restarting.

If it still fails: temporarily disconnect from the inspecting proxy/network for the
build step (the resulting image doesn't need it again afterward), and confirm
BuildKit is actually active (`DOCKER_BUILDKIT=1` or Docker Desktop's BuildKit/containerd
setting) — the cache mount is a silent no-op without it.

### Production / non-Docker-Compose deploy

`lab-ui/backend/Dockerfile` is the production image — it `COPY`s both
`lab-ui/backend/` and the sibling `attack-scripts/` in at build time (no bind mounts),
so it's self-contained for platforms without volume support (e.g. Cloudflare
Containers, per `wrangler.jsonc`'s `image_build_context = ".."`). The frontend's
plain `Dockerfile` (non-`.dev`) expects a **host-built** `./dist` — run `npm install
&& npm run build` locally first if you're not using `Dockerfile.dev`.

---

## 2. Environment variables

Two distinct layers read env vars — don't conflate them:

### A. Server-side defaults (`lab-ui/backend/main.py` → `SERVER_CONFIG`)
Read once at backend startup, served non-sensitively via `GET /api/config` so every
browser gets a pre-configured console with zero setup. **Never put tokens here** —
this response is unauthenticated and world-readable by design.

| Variable | Effect | Default |
|---|---|---|
| `LAB_CF_DOMAIN` | Base domain for shop/portal/api URLs | `one-flare.com` |
| `LAB_SHOP_URL` / `LAB_PORTAL_URL` / `LAB_API_URL` | Override individual target URLs instead of deriving from `LAB_CF_DOMAIN` | derived from domain |
| `LAB_GATEWAY_DOH_URL` | Default Gateway DoH endpoint for the DNS tunnel scenario | empty |
| `LAB_ATTACK_DELAY` / `LAB_ATTACK_JITTER` | Default request pacing | `0.5` / `0.3` |
| `LAB_S1_CONSOLE_URL` | Display-only S1 console link shown in the UI (non-secret) | empty |

### B. Per-run subprocess env (set by the `/ws/run/{scenario_id}` handler, consumed by `attack-scripts/config.py`)
Effective value = whatever the browser sent in its WebSocket config message, falling
back to the `SERVER_CONFIG` value above. These are what the attack scripts themselves
actually read:

| Variable | Effect |
|---|---|
| `CLOUDFLARE_DOMAIN` | Base domain (mirrors `LAB_CF_DOMAIN` but is the name the scripts read) |
| `SHOP_URL_OVERRIDE` / `PORTAL_URL_OVERRIDE` / `API_URL_OVERRIDE` | Per-scenario target URL |
| `CAMPAIGN_TARGET_OVERRIDE` | **Campaign-scenario-only** escape hatch (`09_ctf.py`–`12_saas.py`) that points a run at one specific host, distinct from the shop/portal/api split — this is how you retarget the CTF or an industry campaign at a bespoke subdomain like `<name>.lab.soledrop.co` without touching the three URLs above |
| `CF_GATEWAY_DOH_URL` | DoH endpoint for the DNS tunnel scenario |
| `ATTACK_DELAY` / `ATTACK_JITTER` | Per-run pacing |
| `CAMPAIGN_COUNT` | Requests fired per box/phase for campaign scenarios — set from the UI's Low/Medium/High volume control via `CAMPAIGN_VOLUME_COUNTS` (`{low: 5, medium: 15, high: 30}`) in `main.py`. Single-technique scenarios ignore this. |

### C. Other backend-consumed vars
| Variable | Effect |
|---|---|
| `INCIDENT_KEY` | Shared secret with the SoleDrop shop worker's own `INCIDENT_KEY` — authenticates the CTF's incident-flip POST to `shop.soledrop.co/api/incident` (or your `.lab.soledrop.co` subdomain). Must match on both sides or the flip silently no-ops. |
| `PORTAL_USERNAME`/`PORTAL_PASSWORD`/`API_USERNAME`/`API_PASSWORD` | Lab credentials for the credential-stuffing scenario; match whatever's set as Wrangler secrets on the portal/api workers, or fall back to lab defaults baked into `config.py`. |

**Safety note on `CAMPAIGN_TARGET_OVERRIDE`:** this is meant to point a run at **your
own** `*.lab.soledrop.co` subdomain, or another domain you own or have explicit
permission to test. Never set it to a third-party domain — the campaign scenarios
fire real SQLi/credential-stuffing/prompt-injection/exfil-style traffic, and pointing
that at a domain you don't control is unauthorized testing, full stop. Treat this
variable the same as you'd treat a pentest scope: confirm ownership/permission before
setting it.

---

## 3. Two ways campaigns actually run — don't conflate them

| | One-shot scenario run | ThreatOps drip engine |
|---|---|---|
| Trigger | `WS /ws/run/{scenario_id}` (Scenario Detail page, "Run Attack" tab) | `POST /api/campaign/launch` (`/threatops` page) |
| Mechanism | Spawns `python -m scenarios.NN_x` as a subprocess, streams stdout | `asyncio` task in `campaign_engine.py`, module-level state, log buffer polled via `GET /api/campaign/logs` |
| Targeting | `CAMPAIGN_TARGET_OVERRIDE` env var, or shop/portal/api URL | `target_url` hardcoded per campaign in `campaigns/__init__.py`, or `target_role` → shop/portal/api via `config.py` |
| Volume | `CAMPAIGN_COUNT` (Low/Medium/High → 5/15/30 per box/phase) | `PRESEED_VOLUMES` (Low/Medium/High → 20/60/150), only in `preseed` mode |
| Concurrency | One WebSocket per browser tab — nothing currently stops multiple simultaneous runs across browsers/tabs | Hard single-flight — `launch()` raises if `_state["running"]` is already `True` |
| Use case | Individual attendees, self-serve | Facilitator-driven live demo with phase pacing and SOC talking points |

If you're wiring up a bespoke target (e.g. a new CTF attendee subdomain), remember
`CAMPAIGN_TARGET_OVERRIDE` only affects the **first path** — the ThreatOps engine's
CTF campaign is still hardcoded to `CAMPAIGNS['ctf']['target_url']`
(`campaigns/__init__.py`) unless you edit that value directly.

---

## 4. Security posture — know what this tool is and isn't

This is an **intentional attack-simulation lab**, not a hardened production service.
Be deliberate about where you expose it:

- **No authentication** on `/ws/run/*` or `/api/campaign/*` — anyone who can reach the
  backend can fire attack traffic or drive the drip engine. Fine for a
  localhost-only or trusted-network deployment; **do not** expose an unauthenticated
  instance to the open internet without adding an auth layer in front (reverse-proxy
  basic auth, Access policy, etc.).
- **`CORS allow_origins=["*"]`** on the FastAPI app — intentional for a demo console,
  same reasoning as above.
- **`verify=False`** appears on a couple of outbound calls (the SoleDrop incident-flip
  POST in `campaign_engine.py`, and equivalents in `attack-scripts/campaigns/engine.py`)
  — these skip TLS cert verification on lab-to-lab calls. Don't reuse that pattern for
  calls to anything outside your own lab infrastructure.
- **No concurrency cap** on subprocess spawning via `/ws/run/*` — a burst of
  simultaneous runs (many attendees clicking Run at once, or a scripted loop) will
  spawn that many Python subprocesses with no backpressure. On constrained hardware
  this can exhaust CPU/memory; if you're running a workshop with many concurrent
  attendees, size the host accordingly or consider fronting it with a rate limiter.
- **`CAMPAIGN_TARGET_OVERRIDE` and the URL overrides are intentionally flexible** —
  arbitrary-target support is a feature (multi-tenant `*.lab.soledrop.co` attendee
  subdomains, pointing at your own NFR), not a bug. The mitigation is controlling
  *who* can reach the console and set these values, not restricting *where* they can
  point.
- **Tokens never touch the server config** — `GET /api/config` only ever returns
  non-sensitive values (domain, target URLs, DoH URL, timing, a display-only S1 console
  link). Cloudflare/S1 API tokens live in browser localStorage and are only sent to
  your own backend when a user explicitly hits Run or Test Connection.
- **`/api/docs*` is gated by the console's own session/RBAC system** (see §6) — the
  same `_session_from_cookies` check used by every other authenticated route, not a
  separate mechanism. On a single-tenant deployment (no `RELAY_URL`/`ADMIN_TOKEN`)
  there's no session system at all, so the operator sees every doc — it's their own
  private instance.

---

## 5. Wiring Cloudflare → SentinelOne

Covered in full in [`README.md`](../README.md) Step 3 and
[`docs/infrastructure.md`](infrastructure.md); summary:

1. Configure Logpush jobs (HTTP Requests, Firewall Events, Gateway DNS, Access
   Requests/Audit Logs v2/Gateway HTTP as relevant) to your SentinelOne HEC endpoint.
2. Deploy `parsers/cloudflare-ocsf-parser/` to normalize Logpush JSON to OCSF.
3. Import `detections/`, `hyperautomation/`, and `dashboards/` JSON artifacts into
   your SentinelOne tenant.
4. Allow ~60s for Logpush delivery lag before assuming a detection isn't firing.

---

## 6. Docs viewer — role-gated docs inside the console

The console has a **Docs** page (`/docs`) that serves this repo's markdown (README,
ARCHITECTURE, and everything under `docs/`) straight from the backend, filtered by
role — attendees see attendee-facing guides; admins additionally see this guide,
`infrastructure.md`, `s1-hyperautomation-actions.md`, `soledrop-cloudflare-mapping.md`,
and the CTF question pack (`ctf-questions.md` — deliberately admin-only, since it's
the answer key attendees are meant to work out for themselves). The manifest and
role split live in [`lab-ui/backend/docs_registry.py`](../lab-ui/backend/docs_registry.py).

**Role comes from the console's own session system, not a separate auth mechanism.**
`_docs_role()` in `main.py` reuses `_session_from_cookies` (the same helper every
other RBAC-gated route uses):

- **Single-tenant instance** (no `RELAY_URL`/`ADMIN_TOKEN` — a partner's own private
  deployment): there's no session system running at all, so the operator sees
  everything. It's their own instance; there's no one to gate it from.
- **Shared multi-user console** (`ADMIN_TOKEN` set): role comes from the caller's
  actual logged-in session — `admin` and `viewer` (the same read-only ops role used
  elsewhere for `allow_viewer` routes) see the admin doc set; `user` and logged-out
  visitors see attendee-only. A `user` role can never see admin docs no matter what
  they send — there's no client-controllable input that elevates it.

If you want a third tier beyond admin/attendee, extend `docs_registry.py`'s
`_ROLE_RANK` and `_docs_role()`'s mapping together — they must stay in sync.

## 7. Adding a new attendee/CTF subdomain

1. Create the DNS record / worker route for `<name>.lab.soledrop.co` on the
   `soledrop.co` zone (matching the pattern used for existing attendee subdomains).
2. Point that attendee's console instance (or their `CAMPAIGN_TARGET_OVERRIDE` /
   Shop URL override) at `https://<name>.lab.soledrop.co`.
3. Confirm the wildcard STAR detection rules (`detections/ctf/*.json`, which match on
   `contains '.lab.soledrop.co'` rather than an exact host) will catch the new
   subdomain without edits.
4. Run one scenario end-to-end and confirm events land in SentinelOne filtered on
   `http_request.url.hostname contains '<name>.lab.soledrop.co'` before handing it to
   the attendee — see [`docs/troubleshooting-guide.md`](troubleshooting-guide.md) if
   they don't show up.
