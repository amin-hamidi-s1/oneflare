# Lessons

## 2026-07-02 — Cloudflare Containers deploy: don't containerize a static SPA
**Context:** Deploying lab-ui to Cloudflare Containers repeatedly failed. Root causes, in order:
(1) the frontend Docker build's `npm install` died on `ECONNRESET` because the host network
could not reach registry.npmjs.org at all (`curl` → HTTP 000), while PyPI was fine;
(2) the `CLOUDFLARE_API_TOKEN` could deploy Workers but lacked the **Cloudflare Containers**
permission (`GET /accounts/:id/containers/me` → 403; `/workers/scripts` → 200 — a clean way to
prove it's containers-scope-specific); (3) the frontend nginx container crash-looped because
`nginx.conf` had `proxy_pass http://backend:8000` and nginx refuses to start when an upstream
host is unresolvable; (4) even after fixing nginx, the frontend container instance sat
`inactive` on Cloudflare (never scheduled, never failed) though the image ran fine locally.
**Lesson:** A static SPA (Vite `dist/`) does not belong in a container. The correct Cloudflare
architecture is **Worker static assets for the frontend + a container only for the dynamic
backend**. wrangler.jsonc: `assets: { directory, binding: "ASSETS", not_found_handling:
"single-page-application", run_worker_first: true }`, Worker routes `/api`+`/ws` →
`getContainer(env.BACKEND,...).fetch()` and everything else → `env.ASSETS.fetch(request)`.
This removed the only failing component, is faster/cheaper, and has no cold-start.
**Also:** when a package registry is unreachable at build time but deps are already installed
on the host, build the artifact on the host (`npm run build` is fully local once node_modules
exists) and `COPY dist` into a single-stage nginx/static image — don't run `npm install` in the
image. `dist/` is platform-independent (safe to copy from macOS host → Linux image), unlike
node_modules. **Diagnose "which side" first:** `curl` npm/PyPI/CF endpoints separately, and hit
`/containers/me` vs `/workers/scripts` to localize an auth failure to a specific permission.

## 2026-06-30 — Scope rebrands repo-wide, not per-agent-directory
**Context:** During the ThreatOps merge I told each Wave-1 specialist to rebrand only its own
directory (e.g. "rebrand acmecorp->novamind in config.py ONLY"). QA then found acmecorp still
in scenario scripts, wordlists, setup.sh, demo.py, several frontend pages, main.py's fallback
domain, and docs — because no single agent owned the cross-cutting rename.
**Lesson:** A global rename/rebrand is a CROSS-CUTTING concern. Don't split it across
dir-scoped agents. Either (a) run one repo-wide mechanical pass myself
(`grep -rIli <term>` to collect, then perl -i across the list) BEFORE the feature agents run,
or (b) assign one agent explicitly to "rename X->Y everywhere" with whole-repo scope.
**Also:** when collecting files for a rename, use case-INSENSITIVE grep (`-i`) — `AcmeCorp`
and `acmecorp` both exist and a case-sensitive sweep silently misses half of them.

## 2026-06-30 — Pin cross-agent wire contracts in the spec, exactly
**Context:** incident.py (attack side) sent `Authorization: Bearer <key>` while the worker
checked `data.key` in the JSON body. Two agents, two reasonable interpretations, one mismatch.
**Lesson:** When two parallel agents share a wire protocol (auth header vs body field, exact
JSON shape, route paths), specify the EXACT contract in the shared spec — don't leave it to
each agent's judgment. The co-worker's original (body `key`) was the right reference; I should
have quoted it verbatim in the spec.

## 2026-06-30 — Parallel agents: one directory per agent prevents conflicts
**Context:** Running cloudflare/attacks, then backend/frontend, then S1 agents in waves with
strictly non-overlapping directories produced zero merge conflicts across ~8 agents.
**Lesson:** Dependency-ordered waves + one-dir-per-agent + a pinned spec is a reliable pattern
for multi-agent builds. Keep doing this; reconcile cross-cutting contracts between waves.