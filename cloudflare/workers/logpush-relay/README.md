# oneflare-logpush-relay

Multi-tenant Logpush fan-out relay for the shared `soledrop.co` zone.

## Why this exists

~30 users each run their own dockerized OneFlare lab against a unique host
`<name>.lab.soledrop.co` (wildcard DNS + a `*.lab.soledrop.co/*` route already
point at `shop-soledrop-worker`). Cloudflare Logpush has no per-record
routing — you get one destination per job, not one per hostname. So instead
of ~30 Logpush jobs, there is **one shared job** (datasets: `http_requests` +
`firewall_events`, filtered to `ClientRequestHost contains ".lab.soledrop.co"`)
pointed at this Worker's `POST /ingest`. The Worker reads each record's
`ClientRequestHost`, looks up the owning tenant in a KV registry, and
forwards **only that tenant's records** to that tenant's own SentinelOne HEC
ingest endpoint. That gives write-time isolation: each user's S1 site only
ever receives their own traffic.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/ingest` | none (Logpush destination) | Receives the shared Logpush job's POSTs; also answers the HTTP-destination ownership/validation ping (see below) |
| `POST` | `/register` | `X-Enroll-Code` header or `enroll_code` in body, must equal `LAB_ENROLL_CODE` | Self-service enrollment: `{ name, s1_hec_url, s1_hec_token }` -> creates/updates a registry row, returns the assigned `<slug>.lab.soledrop.co` |
| `GET` | `/admin/registry` | `ADMIN_TOKEN` | List all tenants (S1 HEC token redacted to last 4 chars) |
| `GET` | `/admin/history` | `ADMIN_TOKEN` | Rolling audit/history log (registrations, enable/disable, teardown, forward errors, dropped-unknown-host summaries) — capped at the most recent 200 entries |
| `POST` | `/admin/user/:subdomain/enable` | `ADMIN_TOKEN` | Flip a tenant's `status` to `active` |
| `POST` | `/admin/user/:subdomain/disable` | `ADMIN_TOKEN` | Flip a tenant's `status` to `disabled` (records for this host are dropped at ingest, not forwarded) |
| `DELETE` | `/admin/user/:subdomain` | `ADMIN_TOKEN` | Teardown — deletes the registry row (no live Cloudflare API calls needed; the shared wildcard DNS/route stays in place) |
| `GET` | `/health` | none | Liveness check, `{ "status": "ok" }` |

`:subdomain` accepts either the bare slug (`alice`) or the full host
(`alice.lab.soledrop.co`).

Admin auth: send `Authorization: Bearer <ADMIN_TOKEN>` or
`X-Admin-Token: <ADMIN_TOKEN>`.

## Registry (KV) design

Binding: `REGISTRY` (see `wrangler.toml`).

- **Tenant rows** — key = the full host (`<slug>.lab.soledrop.co`), value =
  ```json
  {
    "name": "Alice",
    "subdomain": "alice.lab.soledrop.co",
    "s1_hec_url": "https://ingest.us1.sentinelone.net/services/collector/raw?sourcetype=marketplace-cloudflare-latest",
    "s1_hec_token": "...",
    "status": "active",
    "created_at": "2026-07-13T00:00:00.000Z",
    "forwarded": 1234,
    "last_seen": "2026-07-13T01:23:45.000Z"
  }
  ```
  Teardown = delete this key. No orphaned Cloudflare-side config to clean up
  (DNS/route are shared and wildcard).
- **`__history__`** — reserved key holding a JSON array of the most recent 200
  audit events (register, re-register, enable, disable, teardown,
  forward_error, dropped_unknown_host).
- **`__unknown__:<host>`** — reserved per-host counters for records whose
  `ClientRequestHost` didn't match any registry row (e.g. stale/decommissioned
  tenants still sending traffic, or scanner noise on `*.lab.soledrop.co`).

`/admin/registry` and `/admin/history` skip the `__`-prefixed reserved keys.

## Ingest behavior

1. **Ownership/validation challenge** — generic HTTP Logpush destinations do
   **not** use the manual `POST /zones/:id/logpush/ownership` round-trip
   (that flow is for S3/GCS/Azure-style bucket destinations only — see
   `developers.cloudflare.com/logs/get-started/api-configuration/`). Per
   `developers.cloudflare.com/logs/get-started/enable-destinations/http/`:
   > "The `ownership_challenge` parameter is not required to create a Logpush
   > job to an HTTP endpoint." ... "you need to make sure that the file upload
   > to validate the destination accepts a gzipped `test.txt.gz` with content
   > as `{"content":"tests"}` compressed, otherwise it will return an error,
   > like `error validating destination: error writing object: error
   > uploading`."

   `handleIngest()` decompresses every POST body and, if the decompressed
   text is exactly `{"content":"tests"}`, returns `200 OK` immediately
   without treating it as a log batch. Everything else is parsed as NDJSON.
2. **Log batches** — the body is gzip-compressed newline-delimited JSON
   (decompressed via `DecompressionStream('gzip')`). Each line is
   `JSON.parse`d; the tenant is resolved from the record's `ClientRequestHost`
   field (the Cloudflare Logpush field name for both `http_requests` and
   `firewall_events`, as long as it's included in the job's `output_options`
   field list). Unknown hosts are counted and dropped; disabled tenants are
   dropped silently; known+active tenants have their records buffered and
   forwarded.
3. `/ingest` acks Logpush with `200 OK` immediately; the actual KV
   bookkeeping and outbound HEC POSTs run in the background via
   `ctx.waitUntil()` so the response isn't held up by however many
   tenants/records are in the batch.
4. **Forwarding format** — mirrors the existing shared soledrop.co Logpush
   destination (`sentinelone://ingest.us1.sentinelone.net/services/collector/raw?header_Authorization=<token>&sourcetype=marketplace-cloudflare-latest`):
   the relay `POST`s the raw NDJSON body (records as-received, one per line)
   to the tenant's `s1_hec_url` (the full HEC "raw" collector URL, including
   `?sourcetype=...`) with header `Authorization: <s1_hec_token>` (no
   `Bearer` prefix — this is the Splunk-HEC-style scheme S1's collector
   expects). The user supplies both values at `/register`.
5. **Optional host rewrite** — set the `REWRITE_HOST` var to `"true"` to
   rewrite every forwarded record's `ClientRequestHost` back to
   `shop.soledrop.co` before it reaches the tenant's S1 HEC endpoint, so
   their SentinelOne site shows a single pristine hostname instead of their
   unique `<slug>.lab.soledrop.co`. Off by default.

## Assumptions to flag for the parser team

- `ClientRequestHost` is read as a **flat top-level field** on each decoded
  record — this assumes the Logpush job's `output_options.field_names`
  includes `ClientRequestHost` and that the job uses the default JSON field
  format (not `sample`/CSV). If the shared job's field list changes, update
  the lookup in `handleIngest()`.
- Forwarded records are byte-identical to what Logpush sent (same field set,
  same JSON shape) **except** `ClientRequestHost` when `REWRITE_HOST=true`.
  The OCSF parser's field contract for this dataset is therefore unaffected
  by this relay, other than that one optional field rewrite — flag to
  `s1-log-parser-engineer` if `REWRITE_HOST` is turned on in a given
  environment.

## Deploy

```bash
cd cloudflare/workers/logpush-relay

# 1. Create the KV namespace and paste the returned id into wrangler.toml
wrangler kv namespace create REGISTRY

# 2. Set secrets (never commit these)
wrangler secret put LAB_ENROLL_CODE
wrangler secret put ADMIN_TOKEN

# 3. Deploy
wrangler deploy
```

## Wire up the Logpush job destination

1. Deploy this Worker first (step above) so you have a stable destination
   URL — either the default `https://oneflare-logpush-relay.<account>.workers.dev/ingest`
   or a custom route/hostname you've mapped to it (e.g.
   `https://relay.soledrop.co/ingest`).
2. Create the Logpush job against that destination:
   ```bash
   curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/logpush/jobs" \
     --request POST \
     --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     --header "Content-Type: application/json" \
     --data '{
       "name": "oneflare-multi-tenant-relay",
       "dataset": "http_requests",
       "destination_conf": "https://oneflare-logpush-relay.<account>.workers.dev/ingest",
       "logpull_options": "fields=RayID,ClientIP,ClientRequestHost,ClientRequestMethod,ClientRequestURI,EdgeResponseStatus,EdgeStartTimestamp,...&timestamps=rfc3339",
       "filter": "{\"where\":{\"key\":\"ClientRequestHost\",\"operator\":\"contains\",\"value\":\".lab.soledrop.co\"}}",
       "enabled": true
     }'
   ```
   Because this is a generic HTTP destination, Cloudflare validates it
   automatically as part of job creation by POSTing the gzip `test.txt.gz`
   ownership/validation ping described above — **no separate
   `/logpush/ownership` call or manual token round-trip is needed**. If job
   creation fails with `error validating destination`, confirm `/ingest` is
   deployed and returns `200` for that exact ping (see "Ingest behavior"
   above) before retrying.
3. Repeat for `dataset: "firewall_events"` with an analogous filter/field
   list, pointed at the same `/ingest` URL.
4. Onboard each user by having them call `POST /register` with their name and
   S1 HEC destination — see the endpoint table above.
