# SentinelOne Development Protocol (OneFlare)

**Every agent doing SentinelOne work reads this file first, then consults the vendored
reference plugin.** This is the project's contract for how S1 development is done here.

The reference is a clone of the official **`Sentinel-One/ai-siem` → `plugins/s1-secops-skills`**
plugin (v1.2.4), vendored at:

```
reference/s1-secops-skills/
```

> `reference/` is gitignored (≈20 MB, AGPL). If it is missing, re-clone:
> `git clone --depth 1 https://github.com/Sentinel-One/ai-siem.git /tmp/ai-siem && \`
> `rsync -a --exclude dist --exclude .git /tmp/ai-siem/plugins/s1-secops-skills/ reference/s1-secops-skills/`

---

## The SDL development model (read once)

SentinelOne **Singularity Data Lake (SDL)** is an indexless "all-data-hot" log lake.

```
raw logs ──HEC ingest──▶ SDL ──log parser (→OCSF)──▶ queryable events
                                     │
        PowerQuery (LRQ API) ◀───────┴──────▶ dashboards / lookups / detections
```

- **Everything is config-as-JSON deployed via API**: parsers (`/logParsers/<name>`),
  dashboards (`/dashboards/<name>`), lookups, datatables, and detection rules.
- **PowerQuery (PQ)** is S1's pipe query language — used for hunts, scheduled detection
  bodies, dashboard panels, and behavioral baselines. Run via the **LRQ API**
  (`POST /sdl/v2/api/queries`) on the **console host** (not the SDL host).
- **OCSF** is the normalization target. Cloudflare logs arrive as a **third-party,
  non-OCSF source** → they must be parsed to OCSF before they are usefully queryable.

Authoritative deep-dives: `reference/s1-secops-skills/CLAUDE.md` (Purple SOC Analyst
persona), `docs/architecture.md`, `docs/zero-to-hero.md`.

---

## Reference map — what to read for each task

| Task | Skill `SKILL.md` | Key references / docs |
|---|---|---|
| Author/debug a **PowerQuery** hunt or detection body | `skills/powerquery/` | `references/{lrq-api,syntax-and-operators,functions-reference,detection-rules,datasource-command}.md`, `examples/{detection-library,behavioral-baselines}.md` |
| Write a **log parser** (Cloudflare→OCSF) | `skills/sdl-log-parser/` | `references/{ocsf-schema-documentation,ocsf-mapping,parse-directives,syntax,mappers,ai-siem-catalog,testing-workflow}.md`, `examples/*.json` |
| **Deploy a detection rule** (STAR/scheduled) | `skills/mgmt-console-api/` | `docs/detection-rule-types.md`, `docs/detection-asset-binding.md`, `skills/powerquery/references/detection-rules.md` |
| **Hyperautomation / SOAR** workflow | `skills/hyperautomation/` | `references/{workflow-schema,building-blocks-catalog,api-integration,validation-rules,functions-reference}.md` |
| **Dashboards** | `skills/sdl-dashboard/` | `docs/sdl-dashboard.md`, `references/{panel-type-cheatsheet,community-examples,lessons-learned}.md` |
| **SDL API** (config CRUD, schema discovery, ingest) | `skills/sdl-api/` | `references/{methods,auth_and_limits}.md`, `scripts/sdl_client.py` |
| **Packaged solutions** (onboard a source end-to-end, UEBA, RBA, asset enrichment) | `skills/sdl-solutions/` | `docs/solutions/*.md`, `assets/*.template.json` |
| Triage / investigate / report | (persona) | `reference/s1-secops-skills/CLAUDE.md`, `docs/mcp-tools.md` |

---

## Credentials & MCP (read before any live call)

Exact env vars (`docs/credentials.md`). Resolution order: env → project `credentials.json`
→ `~/.config/sentinelone/credentials.json`.

| Var | For |
|---|---|
| `S1_CONSOLE_URL` | everything (e.g. `https://usea1-acme.sentinelone.net`, no trailing slash) |
| `S1_CONSOLE_API_TOKEN` | Mgmt REST, LRQ PowerQuery, UAM/Purple GraphQL, SDL config ops, HEC Bearer |
| `S1_HEC_INGEST_URL` | UAM alert/indicator + SDL log ingest |
| `SDL_XDR_URL` | SDL API ops (e.g. `https://xdr.us1.sentinelone.net`) |
| `SDL_CONFIG_WRITE_KEY` | `sdl_put_file` (parser/dashboard deploy) — does **not** grant log read |
| `SDL_CONFIG_READ_KEY` / `SDL_LOG_READ_KEY` | `sdl_get_file`/`list_files` / V1 query fallback |

Auth schemes: Mgmt REST/UAM/Purple = `Authorization: ApiToken <jwt>`; SDL/LRQ/HEC =
`Authorization: Bearer <jwt>`. **HA workflow UI visibility requires a personal Console
User token**, not a service token.

**Prefer the `s1-secops-mcp` tools** (the sandbox proxy blocks outbound to `*.sentinelone.net`):
`powerquery_run`, `powerquery_schema_discover`, `powerquery_enumerate_sources`,
`s1_api_get/post/put/patch/delete`, `sdl_list_files/get_file/put_file/delete_file`,
`hec_ingest`, `ha_list/get/import/export/delete_workflow`, `uam_*`. NL→PQ only works via
`purple-mcp`'s `purple_ai` (API tokens cannot use Purple AI GraphQL directly).

---

## Detection rule types (memorize the decision)

All created at `POST /web/api/v2.1/cloud-detection/rules`, `queryLang:"2.0"`, listed with
**`isLegacy=false`** (omit it and scheduled rules silently return 0).

| Type | `queryType` | Body field | Language | Use when |
|---|---|---|---|---|
| Single-event (STAR) | `events` | `data.s1ql` | boolean S1QL (**no pipes**) | one event matches a filter (SQLi/XSS/traversal) |
| Correlation | `correlation` | `data.correlationParams` | boolean S1QL + thresholds, grouped by `entity` | "N times" / "A then B" (cred stuffing, brute force, impossible travel) |
| Scheduled | `scheduled` | `data.scheduledParams.query` | **PowerQuery (pipes OK)** | any aggregation/lookup/anti-join (DNS DGA, exfil volume) |

- PowerQuery (`|`) detection bodies **only** work with `queryType:"scheduled"` +
  `queryLang:"2.0"`. Single/correlation bodies are boolean S1QL.
- **S1QL backslash escaping:** the engine matches a single backslash → **double each one in
  the JSON POST body** (`\\s`, `domain\\user`).

---

## Asset binding — critical for the Cloudflare lab

An alert shows a real Target Asset only if the matched event carries the asset identity.
**SentinelOne EDR events carry it; Cloudflare logs do NOT** → they bind to "Unknown Device"
unless enriched first. Binding needs two attributes on the event: an id in a `uid` field
(`device.uid` / `user.uid`) **plus** a `class_uid` (HTTP→`4002`, DNS→`4003`, auth→`3002`;
endpoint class `1007`). For scheduled rules use `entityMappings` (≤3 projected columns).
**Run the asset-enrichment solution first** (`docs/solutions/asset-enrichment.md`) so
Cloudflare alerts map to real assets.

---

## Standard dev loops (always validate end-to-end)

- **Parser:** check `ai-siem-catalog.md` first (a Cloudflare parser already exists) → draft
  with the 4 mandatory attrs (`dataSource.category:"security"`, `.name`, `.vendor`,
  `metadata.version`) using OCSF names verbatim from `ocsf-schema-documentation.md` →
  `sdl_put_file` → `hec_ingest` a sample → `powerquery_schema_discover` to confirm fields
  (bump `metadata.version` each build; ~3–5 min propagation is the canary).
- **PowerQuery:** enumerate sources first → draft `filter | group | sort | limit | columns`
  → `powerquery_run` → on 0 rows, compare `matchCount` vs row count and widen the window
  *last*. Cast numeric-prone fields with `number()` before arithmetic.
- **Detection:** pick type (table above) → compose body → ensure asset binding → `POST`
  the rule → enable → poll until `status=="Active"` (`isLegacy=false`).
- **Hyperautomation:** build JSON from `building-blocks-catalog.md` → `ha_import_workflow`
  (lands as a **Private Draft owned by the token user**) → **publish in the same step**
  (`POST /hyper-automate/api/v1/workflows/{id}/publish?accountIds=…&siteIds=…`) → bind
  connections → activate. Re-import creates a new workflow (no in-place update).
- **Dashboard:** discovery → design tabs/panels with explicit x/y/w/h → validate every
  panel query → `sdl_put_file` to `/dashboards/<name>` → run `validate_dashboard.py`.

---

## Evidence discipline (inherited from the S1 persona)

- **No fabrication.** Every count/verdict is backed by a query actually run or a tool
  actually called this session. Empty/zero/error results are findings — report them.
- **No CRITICAL / TRUE POSITIVE without independent threat-intel confirmation.** A detection
  alert is a hypothesis; max classification without TI/MDR/multi-source is
  *SUSPICIOUS — Pending Confirmation*.
- Use the confidence ladder: confirmed / consistent with / suggests / possible / no evidence of.
