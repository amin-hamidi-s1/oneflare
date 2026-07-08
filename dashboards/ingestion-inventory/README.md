# Cloudflare Data Ingestion Inventory

A single SentinelOne SDL PowerQuery + a ready-to-deploy dashboard TABLE panel that
answer, at a glance: **where is our data coming from, what data source is it, and
which Logpush source/dataset is being ingested?**

## What it shows

One row per **Data Source x Logpush dataset x OCSF class**, sorted by event count:

| Column | Source field | Example |
|---|---|---|
| Data Source | `dataSource.vendor` | Cloudflare |
| Logpush Dataset | `dataSource.cloudflare_dataset` | Gateway HTTP / Gateway DNS / Zero Trust Network Session Logs |
| OCSF Class | `class_name` | HTTP Activity / DNS Activity / Network Activity |
| Class UID | `class_uid` | 4002 / 4003 / 4001 |
| Parser | `any(unmapped.parser)` | marketplace-cloudflare-latest |
| Events | `count()` | (inline bar via `showBarsColumn`) |
| First Seen | `simpledateformat(min(timestamp), ...)` | 2026-07-06 14:02:11 GMT |
| Last Seen | `simpledateformat(max(timestamp), ...)` | 2026-07-06 14:11:58 GMT |

Scope is `dataSource.vendor = "Cloudflare"`. **No dataset value is hardcoded** - new
Cloudflare Logpush datasets (HTTP Requests, Firewall Events, Access) appear
automatically as they start flowing. To inventory every vendor, drop or widen the
first filter line.

## Files

- `ingestion-inventory.pq` - the PowerQuery (header comment explains usage/caveats).
- `ingestion-inventory.dashboard.json` - minimal single-tab dashboard: a markdown
  header + the table panel. Import as-is or copy the table panel into an existing
  dashboard's `graphs[]`.

## Why these specific field choices (load-bearing)

- **Parser uses `unmapped.parser`, not `metadata.transformation_info_list[0].name`.**
  Bracket-indexed array fields return HTTP 500 in PowerQuery `group`/`columns`
  (sdl-dashboard cheatsheet). The verified SDL export shows both fields carry the
  same value, so the scalar `unmapped.parser` is the safe, groupable source.
- **First/Last Seen are wrapped in `simpledateformat`.** Raw `min/max(timestamp)`
  render as a giant integer (e.g. `1.777e18`) because they return nanoseconds with
  no implicit date formatter on aggregate output.
- `sort` precedes `columns` (columns drops any field not projected).

## Time window

Do **not** put a time filter or `startTime` in the panel query - the dashboard's
global time picker (top-level `duration`, default `24h`) drives the range. For an
ad-hoc run, supply the window out-of-band (LRQ `startTime`/`endTime`, or `hours=`
on the MCP tool).

## Run / validate

Statically authored against the powerquery + sdl-dashboard skill references;
**not yet run live** (no S1/SDL credentials or `s1-secops-mcp` tools in this
environment). To validate on the tenant:

```
# 1. Run the query body (paste from ingestion-inventory.pq)
#    via the s1-secops-mcp tool:
mcp__s1-secops-mcp__powerquery_run(query="<body of ingestion-inventory.pq>", hours=1)

# 2. Or via the LRQ API on the CONSOLE host (Bearer auth):
POST https://<console>.sentinelone.net/sdl/v2/api/queries
{
  "queryType": "PQ",
  "tenant": true,
  "startTime": "<iso-z>",
  "endTime":   "<iso-z>",
  "queryPriority": "HIGH",
  "pq": { "query": "<body of ingestion-inventory.pq>", "resultType": "TABLE" }
}
```

Expected shape (from the 256-event, last-10-min sample used to author this - do not
treat as live output): three rows - Gateway HTTP (HTTP Activity, 4002), Zero Trust
Network Session Logs (Network Activity, 4001), Gateway DNS (DNS Activity, 4003) -
all Parser = marketplace-cloudflare-latest.

## Deploy the dashboard

```
# via s1-secops-mcp (bypasses the sandbox proxy):
mcp__s1-secops-mcp__sdl_put_file(
  path="/dashboards/cloudflare-ingestion-inventory",
  content=<contents of ingestion-inventory.dashboard.json>)

# then verify + replay every panel:
python3 reference/s1-secops-skills/skills/sdl-dashboard/scripts/validate_dashboard.py \
  /dashboards/cloudflare-ingestion-inventory
```

Read the existing version first and pass `expected_version` (CAS guard) if the path
already exists; sleep ~3s before the verifying `get_file`.
