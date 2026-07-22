#!/usr/bin/env python3
"""Reset every OneFlare-created Cloudflare block on the soledrop.co lab.

Removes, so you can re-run the response/diversify playbooks and re-validate:
  1. Zone IP access rules for the 7 demo attacker IPs (or any rule whose notes contain "OneFlare")
  2. Zero-Trust Gateway rules named "OneFlare block C2 ..."  (diversify-dns-tunneling)
  3. Zone custom-firewall ruleset rules described "OneFlare ..."  (diversify data-exfil/prompt/campaign)

Read-only by default (dry run). Pass --apply to actually delete.
Reads CLOUDFLARE_API_TOKEN from .env.local (or env). Zone/account are the soledrop lab constants.

Usage:
  python3 scripts/unblock_demo_ips.py            # dry run — show what would be deleted
  python3 scripts/unblock_demo_ips.py --apply    # delete them
"""
import json, urllib.request, urllib.error, re, os, sys

ACCOUNT_ID = "b8e637d5097fff0c694c3290ba81563e"
ZONE_ID    = "cf4d15af4a7eb86b033f859aefec1047"   # soledrop.co
CUSTOM_RULESET_PHASE = "http_request_firewall_custom"
DEMO_IPS = ["185.220.101.182", "45.148.10.95", "193.32.162.157",
            "23.129.64.218", "89.234.157.254", "162.247.74.74", "104.244.73.29"]
MARKER = "oneflare"

def load_token():
    if os.environ.get("CLOUDFLARE_API_TOKEN"):
        return os.environ["CLOUDFLARE_API_TOKEN"]
    for p in (os.path.join(os.path.dirname(__file__), "..", ".env.local"),
              os.path.join(os.getcwd(), ".env.local")):
        if os.path.exists(p):
            m = re.search(r'^(?:export\s+)?CLOUDFLARE_API_TOKEN\s*=\s*(.+)$', open(p).read(), re.M)
            if m:
                return m.group(1).strip().strip('"').strip("'")
    sys.exit("CLOUDFLARE_API_TOKEN not found (env or .env.local)")

TOK = load_token()
BASE = "https://api.cloudflare.com/client/v4"
APPLY = "--apply" in sys.argv

def cf(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
        headers={"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"})
    try:
        r = urllib.request.urlopen(req, timeout=45); raw = r.read().decode()
        return r.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try: return e.code, json.loads(raw)
        except: return e.code, {"raw": raw[:400]}

def do_delete(path, label):
    if not APPLY:
        print(f"  [dry-run] would DELETE {label}"); return
    st, d = cf(path, "DELETE")
    print(f"  {'DELETED' if (isinstance(d,dict) and d.get('success')) else f'FAILED {st}'} {label}")

removed = 0

# 1. Zone IP access rules
st, d = cf(f"/zones/{ZONE_ID}/firewall/access_rules/rules?per_page=100")
print(f"\n== Zone IP access rules (HTTP {st}) ==")
for r in (d.get("result") or []):
    val = (r.get("configuration") or {}).get("value", "")
    notes = (r.get("notes") or "")
    if val in DEMO_IPS or MARKER in notes.lower():
        removed += 1
        do_delete(f"/zones/{ZONE_ID}/firewall/access_rules/rules/{r['id']}",
                  f"access_rule {r.get('mode')} {val} ({notes[:40]})")

# 2. Gateway rules
st, d = cf(f"/accounts/{ACCOUNT_ID}/gateway/rules")
print(f"\n== Gateway rules (HTTP {st}) ==")
for r in (d.get("result") or []):
    if MARKER in (r.get("name") or "").lower():
        removed += 1
        do_delete(f"/accounts/{ACCOUNT_ID}/gateway/rules/{r['id']}", f"gateway rule '{r.get('name')}'")

# 3. Custom firewall ruleset rules
st, d = cf(f"/zones/{ZONE_ID}/rulesets/phases/{CUSTOM_RULESET_PHASE}/entrypoint")
rs = d.get("result") if isinstance(d, dict) else None
print(f"\n== Custom firewall ruleset rules (HTTP {st}) ==")
if rs:
    rsid = rs["id"]
    for rule in (rs.get("rules") or []):
        if MARKER in (rule.get("description") or "").lower():
            removed += 1
            do_delete(f"/zones/{ZONE_ID}/rulesets/{rsid}/rules/{rule['id']}",
                      f"ruleset rule '{rule.get('description')}'")

print(f"\n{'Deleted' if APPLY else 'Would delete'} {removed} OneFlare rule(s)."
      + ("" if APPLY else "  Re-run with --apply to remove them."))
