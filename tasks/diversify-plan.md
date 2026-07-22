# diversify-* build plan (2026-07-21)

Validated live against soledrop.co (`.env.local` CF token, Bearer). See DIVERSIFY-HANDOFF.md.

## Constants (all live-validated)
- ACCOUNT_ID `b8e637d5097fff0c694c3290ba81563e`
- ZONE_ID (soledrop.co) `cf4d15af4a7eb86b033f859aefec1047`  ← NOT the .env.local ZONE var (that's us.sentinelone.cftenant.com)
- CUSTOM_RULESET_ID (http_request_firewall_custom entrypoint) `47e1f8f7826b485498964c658c551f22`
- S1 CF connection: connection_id `f1d111b8-d0c0-4ea7-8ae7-2891c16e9592`, integration_id `0dedd07c-0b9a-4205-9215-03ab1a95eb3a`

## CF endpoint verdicts (live)
- ✅ Zone IP access rules `/zones/{zone}/firewall/access_rules/rules` — block + managed_challenge (use for cred/bot/web/unblock + LIVE 7)
- ✅ Account Gateway `/accounts/{acct}/gateway/rules` — dns domain block (dns-tunneling)
- ✅ Modern Rulesets `/zones/{zone}/rulesets/{rsid}/rules` — route + JA3 scoped (exfil/prompt/campaign) — AFTER user granted Rulesets:Edit
- ❌ Legacy `/zones/{zone}/firewall/rules` — GLOBALLY decommissioned (maintenance mode). Do not use.
- ❌ `/user/firewall/access_rules/rules` — API tokens 403 (user scope). Use zone-level instead.
- ❌ IP Intel `/accounts/{acct}/intel/ip` — 403 (Intel scope not granted). IP-Overview enrichment DEFERRED.

## Tasks
- [x] Regenerate 8 diversify scaffolds to validated endpoints (fixed 422: parent_action=null, var/manual data fields)
- [x] Import + activate the 8 on console (usea1-partners, site 2433185103040607397) — all active
- [x] Switch LIVE 7 CF-* block action /user → zone-level (public_action_id=null, raw http); re-import + re-activate — all active
- [x] Local scripts/unblock_demo_ips.py (dry-run default; --apply) resets zone-access/gateway/ruleset rules
- [x] Commit
- [ ] (later) frontend build + deploy lab-ui to one-flare.com (wizard copies already updated in repo)
- [ ] (optional) Get-IP-Overview enrichment — blocked on CF Intel scope (403)
- [ ] User: manual UI run of each playbook to confirm the S1 CF connection creds carry the needed scope
