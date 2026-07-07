# ThreatOps Merge — Build Spec (single source of truth)

Every agent reads this before building. It pins the contracts so parallel work doesn't conflict.
We are merging a co-worker's two repos into OneFlare:
- `cf-attack-sim-v2` (drip-flow attack console + 4 campaigns incl. the Agentic AI Breakout CTF)
- `novamind-cloudflare` (the NovaMind AI "victim" web app + Pyxis chat + incident/status page)

Reference clones live at `/tmp/cf-attack-sim-v2` and `/tmp/novamind-cloudflare` (read them).

## North-star decisions (locked)
1. **Retire AcmeCorp.** Company brand = **NovaMind Technologies**. Rogue agentic AI product = **Pyxis**.
2. **Include ALL co-worker progress**: the **CTF (Agentic AI Breakout)** + the **3 industry campaigns**
   (financial / healthcare / saas), with the live **drip-flow** engine — PLUS our existing 6 scenarios.
3. **Pyxis chat = mock now, real-ready** (structured so a real LLM drops in later via env/binding).
   A deferred TODO tracks the real-LLM wiring.
4. **S1 squad authors** detections + hyperautomation for the new AI scenarios — **no live deploy**.
5. **Attacks only ever target our own workers** (NovaMind on Cloudflare). Never target the
   co-worker's live `*.mihirkansagra.com`.
6. **Nothing breaks**: our 6 existing scenarios + their run flow keep working. All new work is additive
   or a clean rebrand. The scenario-ID contract (frontend `scenarios.js .id` ⇄ backend
   `SCENARIO_SCRIPTS` key ⇄ `scenarios/NN_*.py`) stays intact.

## Branding map (apply everywhere; agents own their own dirs)
- `acmecorp` → `novamind` ; `AcmeCorp` → `NovaMind` ; `acme` → `novamind`
- Worker names: `acmecorp-{shop,portal,api}` → `novamind-{shop,portal,api}` (keep the 3-role split).
- Domain default: `acmecorp-lab.workers.dev` → `novamind-lab.workers.dev` (keep the workers.dev URL
  builder logic in `config.py` — just swap the prefix/default).
- Emails/creds: `*@acmecorp.com` → `*@novamind.ai` (keep the same env-var NAMES; only values change).
- Pyxis model IDs: `pyxis-chat-v2` (200K), `pyxis-chat-v2-fast` (32K), `pyxis-forge-v1-finetuned`
  (custom/tenant), `pyxis-embed-v1` (embeddings); staging: `pyxis-chat-v3`.
- JA4 CTF "flag" clue (reuse verbatim from co-worker): `t13d1812h1_85036bcba153_b26ce05bbdd6`.

## Worker surface — canonical route map (cloudflare-specialist owns cloudflare/workers/**)
Keep all EXISTING routes working (rebranded), and ADD the NovaMind/Pyxis AI surface. Roles:

**`novamind-shop` (public site)** — keep `/`, `/search?q=` (reflect unsanitized → XSS/SQLi bait),
`/login`, `/products/:id` (traversal bait), `/reviews` (POST), `/checkout`, `/cart`. ADD NovaMind
marketing look (hero/products/docs) + a **Pyxis chat UI** page (`/chat`) and a **`/status`** page.

**`novamind-portal` (authed app)** — keep `/login` (cred-stuffing target, env creds), `/dashboard*`,
`/logout`. ADD `/admin` → returns a 401 gate page when unauthed (forced-browse/RCE bait), real admin
view when authed. Keep behind Cloudflare Access where applicable.

**`novamind-api` (REST + AI)** — keep `/api/v1/health`, `/api/v1/auth/login` (mock token),
`/api/v1/customers`(+`/:id`), `/api/v1/customers/export` (exfil target), `/api/v1/orders`. ADD:
- `POST /api/v1/chat` — **mock OpenAI-shaped** completion; model `pyxis-chat-v2`; `chatcmpl-<hex>` id,
  `usage` token math, fake latency via `await new Promise(r=>setTimeout(r,...))`. **Real-ready**: if
  `env.PYXIS_LLM_PROVIDER`/`env.PYXIS_LLM_KEY` (or a Workers AI binding) is present, call it; else mock.
  This is the **prompt-injection / Firewall-for-AI** target.
- `GET /api/v1/models` — Pyxis model registry (the 4 models above), OpenAI `list` shape.
- `GET /api/v1/training-data` — 401-without-auth dataset list (IDOR / data-exfil + poisoning target).
- `GET /api/v1/users` — 401-without-auth user/role list (IDOR target).
- `GET /api/v1/admin` — **always 401** (pure WAF bait).
- `GET /api/incident` — returns incident state JSON (polled by `/status`).
- `POST /api/incident` — key-gated by `env.INCIDENT_KEY`; sets banner/severity/affected services.
  Cross-isolate state via **Workers KV** (binding `INCIDENT_KV`) — fall back to a module global if no KV.

`/status` page (served by shop) polls `GET .../api/incident` every 5s and animates the **4-phase
Agentic AI Breakout** timeline + IOC table + remediation checklist (port from
`novamind-cloudflare/templates/status.html`, rebranded Pyxis). All inline CSS/JS in JS template
literals (ES-module Workers, no build step). Visually demo-ready (port NovaMind's dark theme).

## Attack content (threat-simulation-engineer owns attack-scripts/**)
- **Keep** our 6 scenarios (`scenarios/01_sqli.py`…`06_data_exfil.py`); rebrand acmecorp→novamind in
  `config.py` only (URL builder + default creds/domain). Do NOT change their IDs or `run()` contract.
- **Add** a `campaigns/` package porting the co-worker's drip-flow content as **importable** modules
  (NOT subprocess) so the backend engine can call them with live timing:
  - `campaigns/engine.py` — port `send_request()` (X-Forwarded-For/X-Real-IP spoofing, blocked∈{403,429,444}),
    writing structured dicts to a passed-in log buffer.
  - `campaigns/financial.py`, `healthcare.py`, `saas.py`, `ctf.py` — each exposes a `PHASES` list; each
    phase = `{name, description, what_fires, cloudflare_story, sentinelone_story, hyperautomation,
    fire_one(target,...), fire_many(count,delay_range,target,...)}`. Port `payloads/*` too.
  - `campaigns/__init__.py` — `CAMPAIGNS = {"financial":..., "healthcare":..., "saas":..., "ctf":...}`
    with display metadata (name, campaign title, color, icon, target_role).
- **Repoint targets to OUR workers.** The campaign target is built from our `config.py` URLs, NOT
  `mihirkansagra.com`. The CTF (Pyxis/agentic) primarily hits `novamind-api` (`/api/v1/chat`,
  `/training-data`, `/models`, `/admin`) and `novamind-shop` recon paths. Industry campaigns hit the
  same NovaMind base; where a co-worker path (e.g. `/online-banking/login`) has no worker route it
  still yields recon/WAF signal — acceptable, but prefer mapping to a real NovaMind route when one fits.
- Keep payload sets intact (SQLi, Log4Shell, Spring4Shell, Struts, prompt-injection/DAN, SSRF,
  GraphQL introspection, JA4-constant rotating-UA). They are net-new attack value.
- Add an incident webhook helper that POSTs `novamind-api /api/incident` on CTF start/stop using
  `INCIDENT_KEY` (mirrors co-worker's `_signal_novamind_incident`). Never point it at an external host.

## Backend (backend agent owns lab-ui/backend/**)
- Keep existing `/api/health`, `/api/test-connection`, `/api/scenarios`, and the
  `WS /ws/run/{scenario_id}` runner UNCHANGED (our 6 scenarios).
- Add the **drip-flow campaign engine** as an asyncio background task (fixes the co-worker's Flask
  global-state/multi-worker bug — uvicorn runs one process; module-level state + a `deque(maxlen=500)`
  is fine). Endpoints (polling model, to reuse the ported frontend):
  - `GET  /api/campaigns` → all campaign + phase metadata (drives timeline + talking points).
  - `POST /api/campaign/launch` → `{campaign, mode:"live"|"preseed", phase, volume}`; reject if a
    campaign is already running; spawn the asyncio drip task.
  - `GET  /api/campaign/logs?since=<id>` → `{entries:[...], running, phase, campaign}` (id-incremental).
  - `GET  /api/campaign/status` → `{running, phase, campaign}`.
  - `POST /api/campaign/stop` → set stop flag; on CTF also clear incident.
  - `POST /api/campaign/clear-incident` → clear the NovaMind/Pyxis status banner.
- Engine timing constants (port + keep tunable): `LIVE_INTERVAL_SECONDS=30`,
  `LIVE_PHASE_DURATION_SECONDS=180`, `CTF_LIVE_PHASE_DURATION_SECONDS=90`, `LIVE_BATCH_SIZE=5`,
  preseed volumes low/med/high. Engine imports `attack-scripts/campaigns` and calls `fire_one`/`fire_many`.
- Resolve target URLs from the same env the scripts use (`CLOUDFLARE_DOMAIN` etc.).

## Frontend (frontend agent owns lab-ui/frontend/**)
- **Separator = a clear two-cluster nav** in `Navbar.jsx` (the "distinguish the two projects" ask):
  - Cluster **"Lab Scenarios"** (our existing): Dashboard, Detections, History, Parsers, Architecture.
  - Cluster **"ThreatOps"** (co-worker merge): a new **`/threatops` Campaigns console** page.
  - Settings stays global. Use a visual divider/label between clusters.
- New page `src/pages/ThreatOps.jsx` (route `/threatops`) — port the co-worker `index.html` console as
  React: campaign picker (financial/healthcare/saas/CTF), Demo/Live + phase + volume controls,
  launch/stop, **phase timeline** (done/active/pending), **talking-points panel** that swaps per phase,
  **live countdown** ("Next batch 30s" / "Phase advances m:ss"), color-coded **live log**, stats bar,
  and the **4-box CTF grid** that pulses as boxes fire (for the `ctf` campaign). Plus a **Clear Pyxis
  Incident** button. Drive it by **polling** `/api/campaign/logs` at 1Hz (matches the engine).
- Reuse our Tailwind theme + `src/index.css` utility classes (`.btn-orange`, `.stat-card`,
  `.terminal-scroll`, etc.). Match the existing dark look; don't introduce a new design system.
- Do NOT break existing pages or the `scenarios.js` ⇄ backend ID contract.

## S1 content (s1-detection-engineer → detections/**, s1-hyperautomation-engineer → hyperautomation/**)
- Author detections + response for the 4 CTF boxes / AI scenarios: recon sweep, **polymorphic bot /
  constant-JA4 evasion**, **prompt injection / jailbreak (Firewall-for-AI)**, **agentic multi-vector
  breakout**, training-data exfil. Follow `.claude/rules/s1-development.md` and the reference plugin.
  Author-only (files in `detections/` + `hyperautomation/`); note where a live tenant is needed.

## Hard "do not break" / conflict rules
- Each agent edits ONLY its own directory (cloudflare/workers, attack-scripts, lab-ui/backend,
  lab-ui/frontend, detections, hyperautomation). Cross-cutting contracts are pinned above.
- Don't rename existing scenario IDs, the `/ws/run/{id}` route, or the `SCENARIO_SCRIPTS` keys.
- Keep `.env*`, `.wrangler/`, tokens out of git (unchanged gitignore rules).
- Validate your slice before declaring done; report exactly what you ran.

## Deferred TODOs (write into tasks/todo.md, don't lose)
- Wire Pyxis `/api/v1/chat` to a REAL LLM (Workers AI or Anthropic) behind `env.PYXIS_LLM_*`.
- Deploy + validate S1 detections/hyperautomation against a live tenant when creds/MCP are available.
- Deploy the rebranded workers to live Cloudflare + reconfigure Logpush datasets for NovaMind.
