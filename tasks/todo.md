# ThreatOps Merge — Execution Plan

Merge co-worker's cf-attack-sim-v2 (drip-flow + 4 campaigns) and novamind-cloudflare
(NovaMind AI app + Pyxis chat + incident/status) into OneFlare. Retire AcmeCorp ->
NovaMind/Pyxis. Keep our 6 scenarios working. Branch: threatops-merge.

Contract: tasks/threatops-merge-spec.md (every agent reads it first).

## Wave 0 — foundation (orchestrator) [DONE]
- [x] Analyze all 4 inputs (doc, 2 co-worker repos, our repo)
- [x] Decisions locked (NovaMind+Pyxis, include all campaigns, mock-real-ready chat, S1 author-only)
- [x] Feature branch threatops-merge
- [x] Build spec written

## Wave 1 — workers + attacks (parallel; separate dirs)
- [x] cloudflare-specialist: rebrand workers -> NovaMind; add Pyxis AI surface (/chat mock+real-ready,
      /models, /training-data, /users, /admin bait); incident /status page (KV); demo-ready visuals
      DONE: novamind-{shop,portal,api} workers complete. All routes validated (node --check passed).
- [ ] threat-simulation-engineer: port campaigns/ (engine+financial+healthcare+saas+ctf, importable
      with PHASES + drip metadata); repoint to OUR workers; rebrand config.py; incident webhook helper

## Wave 2 — backend + frontend (parallel; separate dirs)
- [ ] backend: drip-flow campaign engine (asyncio) + /api/campaign/* endpoints; keep /ws/run/{id} intact
- [ ] frontend: ThreatOps Campaigns console (/threatops) + 2-cluster nav separator; 4-box CTF grid;
      live countdown + talking points; poll /api/campaign/logs

## Wave 3 — S1 detection/response (parallel; separate dirs; author-only)
- [ ] s1-detection-engineer: detections/ for recon, bot/JA4, prompt-injection, breakout, exfil
- [ ] s1-hyperautomation-engineer: hyperautomation/ response playbooks for the above

## Wave 4 — integrate, test, validate (orchestrator + qa)
- [x] Rebrand sweep check — repo-wide acmecorp->NovaMind; 0 stray refs in active code
- [x] Frontend builds (vite, 1501 modules); backend imports; workers node --check (x3) + setup.sh
- [x] Existing 6 scenarios still run (regression) — IDs + SCENARIO_SCRIPTS intact
- [x] Incident contract fixed (key-in-body) + frontend<->backend route contract verified
- [x] CLAUDE.md / README / ARCHITECTURE / docs rebranded to NovaMind
- [ ] LIVE runtime e2e (drip flow hits deployed workers; incident page flips) — needs servers
      running + workers deployed (docker-compose up + wrangler dev / live CF). See deferred TODOs.

## Review (2026-06-30)
Merge complete and statically validated on branch threatops-merge. Summary:
- Workers (cloudflare/workers/{shop,portal,api}): rebranded NovaMind + Pyxis AI surface
  (/api/v1/chat mock+real-ready, /models, /training-data, /users, /admin bait, GET/POST /api/incident
  via KV), shop /chat + /status (4-phase breakout), portal /admin gate. All node --check pass.
- Attacks (attack-scripts/campaigns/): engine + financial/healthcare/saas/ctf drip campaigns
  (importable PHASES contract) + incident.py; our 6 scenarios kept, repointed to NovaMind.
- Backend (lab-ui/backend): asyncio drip-flow engine + /api/campaign/* endpoints; /ws/run/{id} kept.
- Frontend (lab-ui/frontend): /threatops console (4-box CTF grid, timeline, talking points, live
  countdown, polling) + two-cluster nav separator ("Lab Scenarios" | "ThreatOps").
- S1 (detections/ + hyperautomation/): 8 detection rules + 4 response playbooks (author-only).
- Branding: AcmeCorp retired repo-wide.
Not yet done: live runtime e2e + live deploys (deferred TODOs below; need creds).

## Deferred TODOs (do not lose)
- [ ] Wire Pyxis /api/v1/chat to a REAL LLM (Workers AI or Anthropic) behind env.PYXIS_LLM_*
      Code stub is in cloudflare/workers/api/src/index.js at the "TODO: Wire real LLM here" comment.
      Two paths to implement: (a) Workers AI binding env.AI + PYXIS_LLM_PROVIDER="workers-ai",
      (b) Anthropic Messages API via PYXIS_LLM_KEY + PYXIS_LLM_PROVIDER="anthropic".
- [ ] Replace placeholder_incident_kv_id in all 3 wrangler.toml with real KV namespace ID
      after running: wrangler kv:namespace create INCIDENT_KV
- [ ] Deploy + validate S1 detections/hyperautomation against a live tenant (needs creds/MCP)
- [ ] Deploy rebranded workers to live Cloudflare + reconfigure Logpush datasets for NovaMind
      (field contract unchanged: RayID, ClientIP, Action, RuleID, MatchedData still present)
- [ ] /status page INCIDENT_API_URL override: when shop/api are on different workers.dev subdomains,
      set window.INCIDENT_API_URL before the status page script runs (or use a custom domain).

## Review
(filled after each wave)
