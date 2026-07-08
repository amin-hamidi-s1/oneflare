// ============================================================================
// Cloudflare Data Ingestion Inventory  (SentinelOne PowerQuery / SDL)
// ============================================================================
// WHAT IT SHOWS
//   One row per (Data Source x Logpush dataset x OCSF class) currently landing
//   in the SDL. At a glance an analyst sees WHERE data comes from (vendor),
//   WHICH Logpush source/dataset it is (dataSource.cloudflare_dataset), what
//   OCSF class it was normalised to, which parser produced it, how many events
//   arrived, and the first/last-seen timestamps for that stream.
//
// HOW TO USE
//   * Dashboard panel: paste the body below (everything after this comment
//     block) into a table panel. Do NOT add a time filter or startTime -- the
//     dashboard's global time picker / top-level `duration` supplies the range.
//   * Ad-hoc run (LRQ API / powerquery_run): supply the window out-of-band
//     (startTime/endTime in the LRQ body, or `hours=` on the MCP tool). The
//     query itself is time-window-agnostic on purpose.
//
// DESIGN NOTES (verified against the powerquery + sdl-dashboard skill refs)
//   * Generic by design: no dataset value is hardcoded. When new Cloudflare
//     datasets (HTTP Requests, Firewall Events, Access) start flowing they
//     appear automatically. Scope is `dataSource.vendor = "Cloudflare"`; widen
//     or drop that line to inventory every vendor.
//   * Parser column uses the scalar `unmapped.parser`, NOT
//     `metadata.transformation_info_list[0].name`. Bracket-indexed array fields
//     return HTTP 500 in PowerQuery `group`/`columns` (sdl-dashboard cheatsheet);
//     the verified export shows both fields carry the same value
//     ("marketplace-cloudflare-latest"), so unmapped.parser is the safe source.
//   * min/max(timestamp) return raw nanoseconds and render as a giant integer
//     (e.g. 1.777e18) unless formatted -- wrapped in simpledateformat per the
//     dashboard pitfall table.
//   * `sort` precedes `columns` (columns drops any field not listed).
//   * count()/any()/min()/max() are all in the confirmed-working aggregate set.
// ============================================================================
dataSource.vendor = "Cloudflare"
| group events   = count(),
        first_ns = min(timestamp),
        last_ns  = max(timestamp),
        parser   = any(unmapped.parser)
    by  vendor     = dataSource.vendor,
        dataset    = dataSource.cloudflare_dataset,
        ocsf_class = class_name,
        class_uid
| let first_seen = simpledateformat(first_ns, 'yyyy-MM-dd HH:mm:ss z'),
      last_seen  = simpledateformat(last_ns,  'yyyy-MM-dd HH:mm:ss z')
| sort -events
| columns "Data Source"    = vendor,
          "Logpush Dataset"= dataset,
          "OCSF Class"     = ocsf_class,
          "Class UID"      = class_uid,
          "Parser"         = parser,
          "Events"         = events,
          "First Seen"     = first_seen,
          "Last Seen"      = last_seen
