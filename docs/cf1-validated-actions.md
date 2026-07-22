# CF1 build — validated Cloudflare action palette (2026-07-21)

Every call below was live create+delete/set+revert tested with the `.env.local` CF token
(Bearer) on soledrop.co. HA workflows run them through the S1 Cloudflare **connection**
(`connection_id f1d111b8-d0c0-4ea7-8ae7-2891c16e9592`, `integration_id 0dedd07c-0b9a-4205-9215-03ab1a95eb3a`)
as raw `http_request` nodes: `url = {{Connection.protocol}}{{Connection.url}}<path>`, header
`Content-Type: application/json`, `use_authentication_data: true`, `public_action_id: null`.

Constants: account `b8e637d5097fff0c694c3290ba81563e` · zone (soledrop.co)
`cf4d15af4a7eb86b033f859aefec1047` · custom-firewall ruleset entrypoint
`47e1f8f7826b485498964c658c551f22`.

## ACT (visible in portal)
| Purpose | Method + path | Body | Reverse |
|---|---|---|---|
| Block IP (Security→WAF→Tools) | POST `/client/v4/zones/{zone}/firewall/access_rules/rules` | `{"mode":"block","configuration":{"target":"ip","value":"<ip>"},"notes":"OneFlare ..."}` | DELETE `.../access_rules/rules/{id}` |
| Managed-challenge IP | same | `{"mode":"managed_challenge",...}` | DELETE by id |
| Route/JA3 rule (Security→WAF→Custom rules) | POST `/client/v4/zones/{zone}/rulesets/47e1f8f7.../rules` | `{"action":"block"|"managed_challenge","expression":"<cf expr>","description":"OneFlare ...","enabled":true}` | DELETE `.../rulesets/{rsid}/rules/{ruleid}` |
| Gateway DNS block (Zero Trust→Gateway→Firewall Policies→DNS) | POST `/client/v4/accounts/{acct}/gateway/rules` | `{"name":"OneFlare block C2 <domain>","action":"block","enabled":true,"filters":["dns"],"traffic":"any(dns.domains[*] == \"<domain>\")"}` | DELETE `/client/v4/accounts/{acct}/gateway/rules/{id}` |
| DNS sinkhole record (DNS→Records) | POST `/client/v4/zones/{zone}/dns_records` | `{"type":"A","name":"<name>.soledrop.co","content":"192.0.2.1","ttl":60,"proxied":false,"comment":"OneFlare ..."}` | DELETE `/client/v4/zones/{zone}/dns_records/{id}` |
| Under-Attack mode (Overview) — ZONE-WIDE, affects all visitors | PATCH `/client/v4/zones/{zone}/settings/security_level` | `{"value":"under_attack"}` | PATCH same `{"value":"medium"}` (default was medium) |

## ENRICH / VALIDATE (read-only)
| Purpose | Method + path | Notes |
|---|---|---|
| List IP access rules (already-blocked check) | GET `/client/v4/zones/{zone}/firewall/access_rules/rules?per_page=100` | zone-level works; filter result[] by configuration.value |
| List ruleset rules | GET `/client/v4/zones/{zone}/rulesets/47e1f8f7.../` | `.result.rules[]`, filter by description |
| Get IP Overview (ASN/geo/threat) | GET `/client/v4/accounts/{acct}/intel/ip?ipv4=<ip>` | **403 for our token (Intel scope)** — use as BEST-EFFORT only (`continue_on_fail:true`); may work via connection global key |
| Zone Details | GET `/client/v4/zones/{zone}` | plan, name |

## DEAD / DO NOT USE
- Native `Create firewall rules` (2fb46ecc) → legacy `/zones/{zone}/firewall/rules` = decommissioned (maintenance_mode). Use Rulesets.
- Native IP-access `Create/List/Delete/Update` (all `/user/...`) → 403 for API tokens. Use zone endpoints above.
- Native `Edit Zone` (PATCH `/zones/{zone}`) with security_level → 403 (9109). Use the `/settings/security_level` endpoint.

## Demo values (Set Context `demo_override`)
cred 185.220.101.182 · web 45.148.10.95 · exfil 193.32.162.157 · bot 23.129.64.218 ·
prompt 89.234.157.254 · dns 162.247.74.74 · campaign 104.244.73.29 · JA3
`0a80f68631b6e8b4634dbc261e8ba60b` · C2 domain `c2tunnel-demo.net`.
