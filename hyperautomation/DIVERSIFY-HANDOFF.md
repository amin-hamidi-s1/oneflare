# Hyperautomation — Session Handoff & `diversify-*` Playbook Spec

**Written 2026-07-21. Read this + memory `ha-workflow-fix-and-deploy-recipe` and
`deploy-knowledge-objects` before continuing.** Console: `usea1-partners.sentinelone.net`,
site `2433185103040607397`, account `1472380766023399132`. Creds in repo `.env.local`
(`S1_CONSOLE_URL`, `S1_CONSOLE_API_TOKEN`, `CLOUDFLARE_API_TOKEN`).

---

## ✅ UPDATE 2026-07-21 (session 2) — diversify built + deployed; live 7 switched to zone-level

**All 8 diversify playbooks (7 scenarios + `unblock-demo-ips`) are LIVE + active** on the
console (manual_trigger → Set Context → one validated CF action). All CF endpoints/bodies were
**live-validated create+delete** on soledrop.co with the `.env.local` CF token. Live console
list = 7 `CF-*` + 8 `diversify-*`/`unblock`, all `active`, no duplicates.

CF endpoint verdicts (all validated this session — see `tasks/diversify-plan.md`):
- ✅ Zone IP access rules `/zones/cf4d15af…/firewall/access_rules/rules` (block + managed_challenge)
- ✅ Gateway DNS `/accounts/b8e637d5…/gateway/rules` (domain block)
- ✅ Modern Rulesets `/zones/cf4d15af…/rulesets/47e1f8f7…/rules` (route + JA3) — **user granted
  Zone→WAF/Rulesets Edit; custom-firewall entrypoint id `47e1f8f7826b485498964c658c551f22`**
- ❌ Legacy `/zones/{zone}/firewall/rules` = **globally decommissioned** (don't use)
- ❌ `/user/firewall/access_rules/rules` = 403 for API tokens (use zone-level)
- ❌ IP Intel `/accounts/{acct}/intel/ip` = 403 (Intel scope NOT granted) → **IP-Overview
  enrichment DEFERRED**

**Live 7 CF-* switched `/user` → zone-level block** (repo + wizard copies + redeployed; block
node is now a raw http_request, `public_action_id:null`, → `/zones/cf4d15af…/…access_rules`).
Fully git-revertable if it misbehaves at runtime.

**Import bug fixed (was 422 on every scaffold):** `parent_action` must be `null` for non-loop
nodes (it's loop-only); wire via `connected_to` only. `variable`/`manual_trigger` need their
full `data` field sets. See `tasks/lessons.md` 2026-07-21.

**Real unblock:** `scripts/unblock_demo_ips.py` (dry-run default, `--apply` to delete) resets
all OneFlare zone-access/gateway/ruleset rules. The HA `unblock-demo-ips` is list-only because
HA per-action execution output is not API-visible.

**Runtime caveat (only confirmable via a UI run):** the diversify/live workflows execute via the
S1 Cloudflare **connection** (`f1d111b8…`), whose stored creds I can't introspect. Every
endpoint/body is validated with a token that has the needed scope; a manual UI run + the CF
console (or `unblock_demo_ips.py --apply` after) confirms the connection carries the same scope
(esp. Rulesets:Edit for exfil/prompt/campaign).

**Still open:** frontend build + deploy lab-ui so wizard users get the updated copies; optional
Get-IP-Overview enrichment (needs Intel scope).

---

## 1. What is DONE and LIVE (7 CF-* response workflows, all active + in repo)

Commits (newest first): `a51b8e3` toggle+PQ notes · `2f6da87` demo IPs · `b5acb72` markdown
notes+enrichment+gate · `d4ac8ff` descriptive notes · `4062c5e` `$id` String! · `694ba46`
GraphQL write-backs. Repo copies live in BOTH `hyperautomation/*/*.workflow.json` AND
`lab-ui/frontend/src/data/ha-workflows/*.workflow.json` (the wizard copies — keep in sync).

The 7 workflows (name → repo dir): CF-Access-CredStuffing-Response→cred-stuffing,
CF-WAF-WebAttack-Response→web-attacks, CF-API-Exfil-Response→data-exfil,
CF-Bot-Scraper-Response→bot-scraper, CF-AI-PromptInjection-Response→prompt-injection,
CF-Gateway-DNSTunnel-Response→dns-tunneling, CF-Campaign-DropDaySwarm-Response→ctf/ctf-campaign.

Each shares an identical 18-node skeleton: `singularity_response_trigger` → Set Context
(variable) → Create Power Query (http_request) → Extract Enrichment (variable) → VirusTotal
Search IP → AbuseIPDB Check IP → Send Interactive Message (Slack) → Wait For Slack →
**Analyst Approved** (condition) → **Cloudflare Block IP** (the ONLY remediation) → Slack
Update Approved/Dismissed → Add Note Approved/Dismissed → Threat Intel Malicious (condition) →
Verdict False Positive Benign / True Positive Malware → Status In Progress.

Fixes already applied to all 7:
- **S1 write-backs use Unified Alerts GraphQL** `POST {{Connection.url}}/web/api/v2.1/unifiedalerts/graphql`,
  body `{"query": "<mutation>", "variables": {...}}` (raw JSON payload). Mutation:
  `alertTriggerActions(actions:[{id:"S1/alert/<X>", payload:{...}}], filter:{or:[{and:[{fieldId:"id", stringEqual:{value:$id}}]}]}){ ... on ActionsTriggered { actions{ actionId success{id} failure{id} skip{id} } } }`.
  IDs: `S1/alert/addNote` (`payload:{note:{value:$note}}` OR rich `{formattedNote:{text:$text, plainText:$plain, type: MARKDOWN}}`),
  `S1/alert/analystVerdictUpdate` (`{analystVerdict:{value: <ENUM>}}`), `S1/alert/statusUpdate`
  (`{status:{value: <ENUM>}}`). **Enums are UNQUOTED GraphQL literals.** AnalystVerdict:
  FALSE_POSITIVE_BENIGN / TRUE_POSITIVE_MALWARE / UNDEFINED (etc). Status: NEW/IN_PROGRESS/RESOLVED.
  **`$id` variable type MUST be `String!`** (not ID! — `stringEqual.value` expects String).
- **Fail-CLOSED gate:** Analyst Approved condition = `{{wait-for-slack.body.actions[0].value}} equals "approved"`
  (Slack approve button value = "approved", dismiss = "dismissed").
- **Notes are rich MARKDOWN** (heading, bold, evidence table, VT/AbuseIPDB links) + a copyable
  "🔎 Investigate" PowerQuery code block keyed to `{{local_var.real_ip}}`.
- **Demo/real toggle** in Set Context: vars in order `demo_override`, `real_ip`, `src_ip`.
  `real_ip = {{Function.DEFAULT(singularity-response-trigger.data.asset.name, "0.0.0.0")}}`;
  `demo_override` = a per-scenario malicious IP; `src_ip = {{Function.DEFAULT(local_var.demo_override, local_var.real_ip)}}`.
  DEMO mode = demo_override set; REAL mode = clear demo_override to "". `src_ip` feeds VT,
  AbuseIPDB, the block, and note display. Per-scenario demo IPs (Tor exits the attack scripts spoof):
  cred 185.220.101.182 · web 45.148.10.95 · exfil 193.32.162.157 · bot 23.129.64.218 ·
  prompt 89.234.157.254 · dns 162.247.74.74 · campaign 104.244.73.29.

**Known-still-imperfect:** the traffic-count evidence (failed_logins, attack_requests, etc.)
often shows **N/A**. Root cause: `Create Power Query` runs on the deprecated `/web/api/v2.1/dv/events/pq`
(sync; rejects `coalesce()` and other funcs) AND the bound alert asset IP is a shared egress
edge IP (104.28.x = one-flare Cloudflare egress) so re-querying it finds little. User accepted
N/A is fine sometimes; the demo-IP + threat-intel + copyable PQ carry the realism. A real fix
would move enrichment to async LRQ (`POST /sdl/v2/api/queries`, Bearer, poll) — deferred.

---

## 2. NEXT TASK — build separate `diversify-<name>` playbooks (manual-trigger, standalone)

**Goal:** one standalone MANUAL-trigger playbook per scenario that performs the *diversified*
Cloudflare response in isolation, so the user can run them together and troubleshoot the CF
calls without the full alert flow. Name them `diversify-<scenario>`. Put JSON in
`hyperautomation/diversify/` (+ copies under `lab-ui/frontend/src/data/ha-workflows/` if wizard-
exposed). Also build an `unblock-demo-ips` playbook. **The user said their CF token has full
scope now — RE-TEST the CF calls live before wiring** (earlier my scoped token 403'd on
user-level access rules; zone firewall + account gateway rules worked).

### DE+HA agreed response per scenario (the "best" response, both agents concur)
The current single action is `Cloudflare Block IP` = `Create an IP Access rule`
(public_action_id `9db31c31-8713-4cff-924c-5d8dc392c8f2`, CF integration_id
`0dedd07c-0b9a-4205-9215-03ab1a95eb3a`, connection_id `f1d111b8-d0c0-4ea7-8ae7-2891c16e9592`),
POST `{{Connection.url}}/client/v4/user/firewall/access_rules/rules`, body
`{"mode":"block","configuration":{"target":"ip","value":"{{local_var.src_ip}}"},"notes":"OneFlare ..."}`.

| diversify-<name> | Response | CF call (endpoint + body) |
|---|---|---|
| **dns-tunneling** (flagship — current IP block is a NO-OP) | Block C2 **domain** at Zero-Trust Gateway | POST `/client/v4/accounts/{{account_id}}/gateway/rules` body `{"name":"OneFlare block C2 {{c2_domain}}","action":"block","enabled":true,"filters":["dns"],"traffic":"any(dns.domains[*] == \"{{c2_domain}}\")"}` (raw http_request, CF connection, public_action_id:null — no native Gateway action exists) |
| **bot-scraper** | IP **managed_challenge** (not hard block) | same as Block IP but body `mode:"managed_challenge"` (or `configuration.target:"asn"`) |
| **cred-stuffing** | Managed Challenge on `/login` | POST zone firewall rule (see note) OR IP managed_challenge |
| **prompt-injection** | Managed Challenge on `/chat` | zone firewall rule on `(http.request.uri.path contains "/api/v1/chat")` action managed_challenge |
| **data-exfil** | Route-scoped block on `/export` | zone firewall rule `(http.request.uri.path contains "/export" and ip.src eq {{src_ip}})` action block |
| **campaign** | JA3-scoped block (actor rotates IP) | zone firewall rule `(cf.bot_management.ja3_hash eq "{{ja3}}")` action block. JA3 data IS present (`tls.ja3_hash.value`). |
| **web-attacks** | keep IP block (correct) — optionally Update WAF rule to block | native `Create an IP Access rule` (unchanged) |

**Zone firewall rules caveat:** the CF **native** action `Create firewall rules`
(public_action_id `2fb46ecc`) posts `/client/v4/zones/{{zone_id}}/firewall/rules` (LEGACY API —
needs a filter object). The modern path is Rulesets (`/zones/{id}/rulesets`). VALIDATE which the
account supports. IDs: **zone_id `cf4d15af4a7eb86b033f859aefec1047`**, **account_id
`b8e637d5097fff0c694c3290ba81563e`** (soledrop.co, Enterprise plan). Firewall-for-AI is
Enterprise-only → do NOT use; use a firewall-rule managed_challenge on `/chat` instead.

### `unblock-demo-ips` playbook
Manual trigger → for each demo IP (loop, or 7 hardcoded): GET
`/client/v4/user/firewall/access_rules/rules?configuration.value={{ip}}&mode=block` → extract
`result[0].id` → DELETE `/client/v4/user/firewall/access_rules/rules/{{id}}`. HA has `loop` +
`break_loop` building blocks and `manual_trigger` (ref `{{manual-trigger.data.<field>}}`).
Purpose: remove blocks so the user can re-block and re-validate in the CF console.

### Cloudflare native actions available (from the console "Actions" tab)
Create/Update/Delete/List IP Access rules · Create/Update/Delete/Get firewall rules + Update
priority · Create/Update/Delete/List DNS Record · DNS Firewall Cluster ops · Edit Zone (Under
Attack mode) · Get/Update WAF rule + package · Create/Get/Download PCAP request (evidence
capture) · **Get IP Overview** + Cloudflare JD Cloud IP Details (ASN/geo/intel ENRICHMENT — add
to notes) · Get zero trust user failed logins · Get user audit logs · Load Balancer ops. **No
native Zero-Trust Gateway-rule action** → Gateway DNS block must be a raw http_request.

### Also-wanted enrichment (additive, non-breaking)
Add **Get IP Overview** on `src_ip` → project ASN/country/threat-category into the note table.
Validate the endpoint (Cloudflare Intel may be Enterprise-gated).

---

## 3. HA DEPLOY RECIPE (verified this session)

- **Export ALL workflows:** `GET {{B}}/workflow-import-export/export?ids=all` where
  `B = {{S1_CONSOLE_URL}}/web/api/v2.1/hyper-automate/api/public`. Returns a **ZIP** (binary) of
  every workflow JSON. Unzip; each member is `{name, description, actions, notes}`; each action
  is `{action:{type, tag, connection_id, integration_id, data:{name, action_type, public_action_id,
  url, url_path, payload, method, headers, ...}}, export_id, connected_to, parent_action}`.
- **Replace a workflow (re-import creates a NEW one; duplicate name auto-suffixes " (1)"):**
  1. `POST {{B}}/workflows/{id}/deactivate?siteIds={site}` body `{"data":{}}` (else DELETE 400s
     "Active workflows cannot be archived"). 2. `DELETE {{Bv}}/workflows/{id}?siteIds={site}`
     (`Bv = .../hyper-automate/api/v1`). 3. `POST {{B}}/workflow-import-export/import?siteIds={site}`
     body `{"data": <full export json>}` → returns `id` + `version_id`. 4. `POST
     {{B}}/workflows/{id}/{version_id}/activation?siteIds={site}` body `{"data":{"timeout":86400}}`
     → 204 (retry on transient 500). Auth = header `Authorization: ApiToken <S1_CONSOLE_API_TOKEN>`.
- **List:** `GET {{B}}/workflows?limit=100` → `data[].workflow.{id,version_id,name,state}`.
- **Executions:** `GET {{B}}/workflow-execution?limit=50` (NOT `-executions`); per-action output
  is NOT exposed via API (output endpoints 404) — validate by re-running scenarios + reading notes.
- **Sandbox blocks `*.sentinelone.net`** → run all S1/CF API python with Bash
  `dangerouslyDisableSandbox: true`. Parse `.env.local` with regex `^(?:export\s+)?KEY\s*=\s*(.+)$`
  (it uses `export K = v` with spaces). Python 3.9 only locally; attack venv at
  scratchpad `attack-venv` (deps installed). Run scenarios: `cd attack-scripts && venv/python -m
  scenarios.NN_x` (demo.py needs 3.10; individual modules are 3.9-ok). Target defaults to
  shop.soledrop.co.

## 4. Deploy to one-flare.com
Frontend build + wizard copies: `cd lab-ui/frontend && npm run build`. Deploy lab-ui:
`cd lab-ui && export CLOUDFLARE_API_TOKEN="$(parse .env.local)" && npx wrangler@4.77.0 deploy`
(needs Docker running for the backend container; frontend is static assets). See memory
`repos-and-deploy-workflow`. The HA workflows themselves live on the S1 console (not one-flare.com);
the repo/wizard copies are what users deploy to THEIR own S1 via the Settings deploy wizard.

## 5. Immediate next steps
1. Re-test CF calls live with the (now full-scope) CF token: IP access rule managed_challenge,
   Gateway rule create, zone firewall rule create, IP Overview, access-rule list+delete.
2. Generate the 7 `diversify-*` + `unblock-demo-ips` manual-trigger scaffolds (manual_trigger →
   Set Context demo vars → the CF action from the table above). Import + activate on the console.
3. Add Get IP Overview enrichment to the 7 response notes.
4. Build frontend + deploy lab-ui to one-flare.com so users can deploy to other sites.
5. User validates demo-vs-real by toggling `demo_override` and running scenarios.
