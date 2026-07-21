# SentinelOne Hyperautomation — Native Integration & Action-ID Catalog

> **Source of truth for HA action wiring.** Live-fetched from `GET /web/api/v2.1/hyper-automate/api/v1/public-actions` on **usea1-partners.sentinelone.net** (2026-07-20). That endpoint returned **3,612 actions across 222 integrations**; this file is the **6 in-scope** for the OneFlare lab. Integration names were confirmed by matching known action signatures (Slack `43d27b10` verified against the Blocklist reference).

## ⛔ The rule (why this file exists)
When an action targets one of the vendors below, **use the native integration action — never hand-roll a generic `http_request`.** A native action node is:

```jsonc
{ "type": "http_request", "tag": "integration",
  "integration_id": "<the integration's id — from the Connection matrix below>",  // ⚠️ REQUIRED, NOT null
  "connection_id": null,         // OK to leave null → node imports as the native action, "no connection" warning; user binds it
  "data": { "action_type": "http_request",
            "public_action_id": "<from the tables below>",  // the specific action within that integration
            ... } }
```
**⚠️ `integration_id` MUST be set to the vendor's id (Connection-matrix column below).** If it's `null`, the console renders the node as a plain **"Send HTTP Request"** — NOT the native integration — even with a valid `public_action_id`. (Learned the hard way: `public_action_id` alone is not enough; `integration_id` is what binds the node to the integration definition that supplies the native rendering.) `connection_id` may stay `null` — the node still renders native, just unbound, and the user picks their connection after import. Only fall back to a raw `http_request` (`tag:"core_action"`, `public_action_id:null`, `integration_id:null`) when **no** catalogued action exists.

## Connection matrix
| Integration | `integration_id` | Connection (auth) | Notes |
|---|---|---|---|
| **Cloudflare** | `0dedd07c-0b9a-4205-9215-03ab1a95eb3a` | Cloudflare | API token connection; base `/client/v4`. IP-Access-Rule actions are **account/user-scoped**, firewall-rule actions need `<<zone_id>>`. |
| **SentinelOne (Mgmt / SDL)** | `ef645af9-ed60-4efd-882e-bf534442ce86` | SentinelOne (ApiToken) | Console Mgmt API. NOTE: the native `Create A Power Query…` posts to `/web/api/v2.1/dv/init-query` (console DV, ApiToken) — this is NOT the raw SDL LRQ endpoint (`/sdl/v2/api/queries`, Bearer). Use the native action for hydration; only drop to a raw HTTP+SDL-Bearer connection if you need pipe-PowerQuery the DV API can't run. |
| **SentinelOne (Unified Alerts)** | `3e274c5a-f574-462f-8685-5eed98e90fbb` | SentinelOne (ApiToken) | Alert response actions (note/verdict/status). These are the write-back actions the playbook uses to record its conclusion on the alert. |
| **Slack** | `43d27b10-ea4f-4829-a6d2-5de254dec613` | Slack (OAuth) | Bot token connection. `Send Interactive Message` + core `wait_for_slack` (or the native `Wait for Slack Interactive Message`) implement the approve/deny gate. |
| **AbuseIPDB** | `75af0459-ecea-48eb-9a62-7ec2e68a4c73` | AbuseIPDB (API key) | IP reputation enrichment. |
| **VirusTotal** | `9b735fa3-69db-4430-bca0-347b57a8604d` | VirusTotal (API key) | File/IP/domain/URL threat-intel enrichment. Mandatory for any TRUE-POSITIVE verdict per evidence discipline. |

## Cloudflare  ·  `0dedd07c-0b9a-4205-9215-03ab1a95eb3a`  ·  52 actions

**⭐ Lab-critical actions**

| Action | `public_action_id` | Method | url_path |
|---|---|---|---|
| `Create an IP Access rule` | `9db31c31-8713-4cff-924c-5d8dc392c8f2` | POST | `/client/v4/user/firewall/access_rules/rules` |
| `Delete an IP Access rule` | `0c2130ed-c52b-4893-981d-617f538626bd` | DELETE | `/client/v4/user/firewall/access_rules/rules/92f17202ed8bd63d69a66b86a49a8f6b` |
| `Update an IP Access rule` | `2148a78b-cca9-423c-91a4-9151ea10fb03` | PATCH | `/client/v4/user/firewall/access_rules/rules/<<rule_id>>` |
| `List IP Access rules` | `cff17fd5-fe89-4f01-9660-50e7be9cfa4d` | GET | `/client/v4/user/firewall/access_rules/rules` |
| `Create firewall rules` | `2fb46ecc-d6aa-478e-aab2-5e92ffa09794` | POST | `/client/v4/zones/<<zone_id>>/firewall/rules` |
| `Get IP Overview` | `170fef59-6471-4e65-8ccc-9d841fb33426` | GET | `/client/v4/accounts/<<account_id>>/intel/ip` |

<details><summary>All 52 actions</summary>

| Action | `public_action_id` | Method | url_path |
|---|---|---|---|
| `Cloudflare JD Cloud IP Details` | `46eafa14-d54e-4d37-9147-ac0ac095e93e` | GET | `/client/v4/ips` |
| `Create Bucket` | `0f98dc78-ce3e-4281-97e3-ec748af3f292` | POST | `/client/v4/accounts/<<account_id>>/r2/buckets/<<bucket_name>>` |
| `Create DNS Firewall Cluster` | `4cb721f2-d8ba-4180-b6ea-7c040a8a1e37` | POST | `/client/v4/accounts/<<account_id>>/dns_firewall` |
| `Create DNS Record` | `828d96cc-222b-48dd-ae76-6ac0a69679ca` | POST | `/client/v4/zones/<<zone_id>>/dns_records` |
| `Create Load Balancer` | `a4b6eb58-848b-4f24-8e33-215d563706e6` | POST | `/client/v4/zones/<<zone_id>>/load_balancers` |
| `Create PCAP request` | `d7b33eb1-e0c6-44ee-90ac-c0d99d5fe11f` | POST | `/client/v4/accounts/<<account_id>>/pcaps` |
| `Create Zone` | `ecde61da-ed1c-482f-b0a4-c03942ccddd8` | POST | `/client/v4/zones` |
| `Create an IP Access rule` | `9db31c31-8713-4cff-924c-5d8dc392c8f2` | POST | `/client/v4/user/firewall/access_rules/rules` |
| `Create firewall rules` | `2fb46ecc-d6aa-478e-aab2-5e92ffa09794` | POST | `/client/v4/zones/<<zone_id>>/firewall/rules` |
| `Create simple pcap` | `67dd2932-8dea-44f7-8526-f4955fa6eb7c` | POST | `/client/v4/accounts/<<account_id>>/pcaps` |
| `DNS Firewall Cluster Details` | `6f0a1573-77a3-4ef4-b23e-26ffab458fca` | GET | `/client/v4/accounts/<<account_id>>/dns_firewall/<<firewall_id>>` |
| `DNS Record Details` | `0373550e-3552-44c6-9d10-1f335ecd65db` | GET | `/client/v4/zones/<<zone_id>>/dns_records/<<record_id>>` |
| `Delete Bucket` | `3cd68c05-9700-453f-96ab-1df8fb8b907e` | DELETE | `/client/v4/accounts/<<account_id>>/r2/buckets/<<bucket_name>>` |
| `Delete DNS Firewall Cluster` | `181cb960-6f7a-420e-a3a8-ee7c4f00964c` | DELETE | `/client/v4/accounts/<<account_id>>/dns_firewall/<<firewall_id>>` |
| `Delete DNS Record` | `bd6c1c99-5c5b-4742-8353-2b43bd0c055a` | DELETE | `/client/v4/zones/<<zone_id>>/dns_records/<<record_id>>` |
| `Delete Load Balancer` | `7429add6-099b-4f77-80fd-470a734e3718` | DELETE | `/client/v4/zones/<<zone_id>>/load_balancers/<<load_balancer_id>>` |
| `Delete Zone in Cloudflare` | `15ac9db0-1ee1-4bb9-9ea4-8d3001a08b6d` | DELETE | `/client/v4/zones/<<zone_id>>` |
| `Delete a firewall rule` | `65c19248-8f24-47be-8c0f-99aae4ea6291` | DELETE | `/client/v4/zones/<<zone_id>>/firewall/rules/<<rule_id>>` |
| `Delete an IP Access rule` | `0c2130ed-c52b-4893-981d-617f538626bd` | DELETE | `/client/v4/user/firewall/access_rules/rules/92f17202ed8bd63d69a66b86a49a8f6b` |
| `Download Simple PCAP` | `83da78bd-f8c7-4365-8412-e4bcd404af4e` | GET | `/client/v4/accounts/<<account_id>>/pcaps/<<request_id>>/download` |
| `Edit Zone` | `70c1ff7b-18f7-4946-895c-d0365a1bfd76` | PATCH | `/client/v4/zones/<<zone_id>>` |
| `Export DNS Records` | `5c26b72e-6b3b-4e91-a3b3-945e073556c1` | GET | `/client/v4/zones/<<zone_id>>/dns_records/export` |
| `Get IP Overview` | `170fef59-6471-4e65-8ccc-9d841fb33426` | GET | `/client/v4/accounts/<<account_id>>/intel/ip` |
| `Get PCAP request` | `8d6ffd68-0a93-4b3c-a609-d3ca92f49bd7` | GET | `/client/v4/accounts/<<account_id>>/pcaps/<<request_id>>` |
| `Get a WAF package` | `56274eee-4b5f-4243-b0d7-86b1dcb4cdda` | GET | `/client/v4/zones/<<cloudflare>>/firewall/waf/packages/<<package_id>>` |
| `Get a WAF rule` | `043d1a5a-b13b-44ff-bf62-00dcf2e60b1c` | GET | `/client/v4/zones/<<zone_id>>/firewall/waf/packages/<<package_id>>/rules/<<rule_id>>` |
| `Get a firewall rule` | `4a2b57cf-bf43-48d0-aa8e-a85ce9daab28` | GET | `/client/v4/zones/<<zone_id>>/firewall/rules/<<rule_id>>` |
| `Get billing profile` | `e66b4c2f-8b97-4da9-8147-47d1eb47f358` | GET | `/client/v4/accounts/<<account_id>>/billing/profile` |
| `Get firewall rules` | `f4cbf2b8-395d-4d63-8d07-43b86795c82a` | GET | `/client/v4/zones/023e105f4ecef8ad9ca31a8372d0c353/firewall/rules` |
| `Get user audit logs` | `6967714a-d934-464a-9da2-be44867a96f7` | GET | `/client/v4/user/audit_logs` |
| `Get zero trust user failed logins` | `a3620341-5c10-4c7e-bf3b-41167b7ad137` | GET | `/client/v4/accounts/<<account_id>>/access/users/<<user_id>>/failed_logins` |
| `Get zero trust users` | `31c92893-c696-4264-bf17-dd0ae3fb5516` | GET | `/client/v4/accounts/<<account_id>>/access/users` |
| `List DNS Firewall Clusters` | `dae6f469-323e-4457-8bb7-9e4fbe5fd044` | GET | `/client/v4/accounts/<<account_id>>/dns_firewall` |
| `List DNS Records` | `752058a2-44a7-4b01-a782-70ec1019e1fa` | GET | `/client/v4/zones/<<zone_id>>/dns_records` |
| `List IP Access rules` | `cff17fd5-fe89-4f01-9660-50e7be9cfa4d` | GET | `/client/v4/user/firewall/access_rules/rules` |
| `List WAF packages` | `9e4d9c02-e2b6-449d-aa04-b5808c6579d7` | GET | `/client/v4/zones/<<zone_id>>/firewall/waf/packages` |
| `List WAF rules` | `c6bdfe8c-07cd-42bf-9646-142341a67eb0` | GET | `/client/v4/zones/<<zone_id>>/firewall/waf/packages/<<package_id>>/rules` |
| `List Workers` | `52faa5fe-aefb-4f28-a8eb-af503f9159e0` | GET | `/client/v4/accounts/<<account_id>>/workers/scripts` |
| `List Zones` | `9f9b6800-0d34-4b72-b756-a0de273200b8` | GET | `/client/v4/zones` |
| `List load balancers` | `fbf9c523-640b-4475-ade8-9ee3c021d6d0` | GET | `/client/v4/zones/<<zone_id>>/load_balancers` |
| `List packet capture requests` | `cc252e48-4c2c-412b-995b-74ce1dc99790` | GET | `/client/v4/accounts/<<account_id>>/pcaps` |
| `Search load balancer resources` | `5f6421f1-5582-442c-94ba-b0b377016f9d` | GET | `/client/v4/accounts/<<account_id>>/load_balancers/search` |
| `Update DNS Record` | `f4f9ae35-a4ae-4533-b47a-f86fbb514a7e` | PATCH | `/client/v4/zones/<<zone_id>>/dns_records/<<record_id>>` |
| `Update a WAF package` | `cdfd1cfb-cb9f-4499-9237-8bb138d3c27a` | PATCH | `/client/v4/zones/<<zone_id>>/firewall/waf/packages/<<package_id>>` |
| `Update a WAF rule` | `94b482c3-4149-49bb-bc9d-8eca94fcc27f` | PATCH | `/client/v4/zones/<<zone_id>>/firewall/waf/packages/<<package_id>>/rules/<<rule_id>>` |
| `Update a firewall rule` | `7e1971dc-15c1-4a9b-acfd-dafac1ed7ab9` | PUT | `/client/v4/zones/<<zone_id>>/firewall/rules/<<rule_id>>` |
| `Update an IP Access rule` | `2148a78b-cca9-423c-91a4-9151ea10fb03` | PATCH | `/client/v4/user/firewall/access_rules/rules/<<rule_id>>` |
| `Update dns firewall` | `454a7d30-d7cd-4f86-975a-ebc0b167e6de` | PATCH | `/client/v4/accounts/<<account_id>>/dns_firewall/<<firewall_id>>` |
| `Update load balancer` | `c5c48a64-f3ff-4053-9817-f089125f858b` | PATCH | `/client/v4/zones/<<zone_id>>/load_balancers/<<load_balancer_id>>` |
| `Update log retention flag` | `3e56b9b0-37c7-479a-994b-9da9d42d4591` | POST | `/client/v4/zones/<<zone_id>>/logs/control/retention/flag` |
| `Update priority of firewall rule` | `2255adc2-ae0f-4b59-a60c-bb5b56ec588f` | PATCH | `/client/v4/zones/<<zone_id>>/firewall/rules/<<rule_id>>` |
| `Zone Details` | `da54fc7f-5287-448c-b81a-c62dbd1e50d4` | GET | `/client/v4/zones/<<zone_id>>` |

</details>

## SentinelOne (Mgmt / SDL)  ·  `ef645af9-ed60-4efd-882e-bf534442ce86`  ·  50 actions

**⭐ Lab-critical actions**

| Action | `public_action_id` | Method | url_path |
|---|---|---|---|
| `Create A Power Query And Get Queryid` | `26adfd4c-0f20-4e2d-8e63-2905b0a20092` | POST | `/web/api/v2.1/dv/init-query` |
| `Add IOCs` | `282ae683-5ab1-46c1-b5b2-d6ff270627d4` | POST | `/web/api/v2.1/threat-intelligence/iocs` |
| `Create Blocklist Item` | `07e21f3c-3e9e-4685-83a4-fd599910dd3e` | POST | `/web/api/v2.0/restrictions` |
| `Disconnect Endpoint From Network` | `c0eca0c4-31cd-400b-9a98-f88a1daa3876` | POST | `/web/api/v2.1/agents/actions/disconnect` |
| `Reconnect Endpoint to Network` | `332d15f9-8bb5-4df4-a020-45a0a9cf3e0b` | POST | `/web/api/v2.1/agents/actions/connect` |

<details><summary>All 50 actions</summary>

| Action | `public_action_id` | Method | url_path |
|---|---|---|---|
| `Add IOCs` | `282ae683-5ab1-46c1-b5b2-d6ff270627d4` | POST | `/web/api/v2.1/threat-intelligence/iocs` |
| `Broadcast Message to Agents` | `6b80f826-3ecc-4ef5-9cfc-2c8a9f19acb8` | POST | `/web/api/v2.1/agents/actions/broadcast` |
| `Cancel Long Running Query` | `0455354d-96fd-4392-9cd6-ee8e97a841d0` | DELETE | `/sdl/v2/api/queries/<@queryId@>` |
| `Count Agents` | `b99a37a3-bee6-4f4b-9ff7-9c3bec334b9d` | GET | `/web/api/v2.1/agents/count` |
| `Create A Power Query And Get Queryid` | `26adfd4c-0f20-4e2d-8e63-2905b0a20092` | POST | `/web/api/v2.1/dv/init-query` |
| `Create Blocklist Item` | `07e21f3c-3e9e-4685-83a4-fd599910dd3e` | POST | `/web/api/v2.0/restrictions` |
| `Create Firewall Rule` | `fecff713-56be-4f9b-8e64-0af3d46ad8aa` | POST | `/web/api/v2.1/firewall-control` |
| `Create Long Running Query` | `00d322ab-ca12-4a8e-ac93-a432fa29ce96` | POST | `/sdl/v2/api/queries` |
| `Create Query And Get Queryid` | `8d823fbd-87bc-47cc-a950-05959a50b553` | POST | `/web/api/v2.1/dv/init-query` |
| `Delete Blocklist Item` | `86a933ba-edeb-4a90-96e0-ba947a2ad703` | DELETE | `/web/api/v2.0/restrictions` |
| `Disconnect Endpoint From Network` | `c0eca0c4-31cd-400b-9a98-f88a1daa3876` | POST | `/web/api/v2.1/agents/actions/disconnect` |
| `Fetch Files` | `462b4aa9-7fbf-476a-bb27-0811d1b1d146` | POST | `/web/api/v2.1/agents/<<agentId>>/actions/fetch-files` |
| `Get Accounts` | `ed12a7e8-0ba0-4850-8039-368b5edab65e` | GET | `/web/api/v2.0/private/accounts` |
| `Get Activities` | `34a53bc6-4f63-423b-8955-549e53827a35` | GET | `/web/api/v2.1/activities` |
| `Get Activity Types` | `f198505f-c193-40ff-8dc8-51897d9f9300` | GET | `/web/api/v2.1/activities/types` |
| `Get Agent by Hostname` | `869d0ecc-7768-47f0-9fd9-aba99883547b` | GET | `/web/api/v2.1/agents` |
| `Get Agent by UUID` | `60af5d30-fa9c-40d8-866b-bc5139a412fd` | GET | `/web/api/v2.1/agents` |
| `Get Agents` | `afe978b7-6a52-4e4b-9871-c0c738971b6f` | GET | `/web/api/v2.1/agents` |
| `Get Agents Details` | `8dfd1f8e-eb7f-427d-a61d-ccc8b36d2256` | GET | `/web/api/v2.1/agents` |
| `Get Agents Installed Applications` | `3bc7c1a4-dc65-49bb-a100-b92f48744acd` | GET | `/web/api/v2.1/agents/applications` |
| `Get Agents by Network Domains` | `b2318415-46e9-4203-a5a8-32acba98e69b` | GET | `/web/api/v2.1/agents` |
| `Get Agents by Operating System Type` | `87d498f0-46e3-4df9-9db7-d2ddf15ff278` | GET | `/web/api/v2.1/agents` |
| `Get Agents by Version` | `a798599d-940b-4eb2-98cb-fb3fbbe43ed2` | GET | `/web/api/v2.1/agents` |
| `Get Agents with active threat` | `af9116da-24f5-4453-a014-5a8e93e18bd6` | GET | `/web/api/v2.1/agents` |
| `Get Alerts` | `34049bba-98b5-4b78-9de5-968251b550f9` | GET | `/web/api/v2.0/threats` |
| `Get Blocklist` | `f89d6dc3-efb4-47c2-8366-075ff12100ef` | GET | `/web/api/v2.0/restrictions` |
| `Get CVEs For Installed Applications` | `647cc5ea-b630-4703-ac17-0e433c6441b2` | GET | `/web/api/v2.1/installed-applications/cves` |
| `Get Events By Type` | `711c862f-394a-4483-a280-9229df47db56` | GET | `/web/api/v2.1/dv/events/<<event_type>>` |
| `Get Exclusions` | `1219e0d6-3b5a-4342-8035-a8192b7078df` | GET | `/web/api/v2.1/exclusions` |
| `Get Firewall Rules` | `20bc9ffd-6904-4163-8cbc-d63c60046d01` | GET | `/web/api/v2.1/firewall-control` |
| `Get IOCs` | `9836ab47-a744-48d3-a022-db34d5a3b89b` | GET | `/web/api/v2.1/threat-intelligence/iocs` |
| `Get Query Status` | `6b7c9ea5-cf53-4a27-986a-5bc0b627e0f8` | GET | `/web/api/v2.1/dv/query-status` |
| `Get Recent Threats` | `d0895800-45d1-476a-8291-f8fb6b810c2e` | GET | `/web/api/v2.0/threats` |
| `Get Scripts` | `cd0ee9ad-98cb-4914-8fed-9628e17fdf7b` | GET | `/web/api/v2.1/remote-scripts` |
| `Get Specific IOC` | `39997030-eb4f-4a91-b309-a275fb7cc8f8` | GET | `/web/api/v2.1/threat-intelligence/iocs` |
| `Get Threats` | `a1863e01-cfa4-4544-ae32-ca1a37442340` | GET | `/web/api/v2.0/threats` |
| `Get all Deep Visibility events from a queryId` | `014e1093-4466-4fa4-8cd7-317a8dac18c2` | GET | `/web/api/v2.1/dv/events` |
| `Initiate Scan on Agents` | `0ca5039b-8b1a-47d7-8e58-5c2a709ee1ca` | POST | `/web/api/v2.1/agents/actions/initiate-scan` |
| `List Applications` | `468eea9f-07bd-4c9c-8887-7eea4a0a8349` | GET | `/web/api/v2.0/installed-applications` |
| `List Users` | `3e1b65da-0b9d-48ca-aa28-700b9c2a37ac` | GET | `/web/api/v2.0/users` |
| `Mitigate Threats - Kill` | `fd024552-57c7-486e-96db-8cba89a56331` | POST | `/web/api/v2.1/threats/mitigate/kill` |
| `Mitigate Threats - Quarantine` | `7c6a2088-8d36-419d-bddf-3fb358d2618e` | POST | `/web/api/v2.1/threats/mitigate/quarantine` |
| `Mitigate Threats - Remediate` | `8f2d917e-f265-4ef4-b782-2faa97783857` | POST | `/web/api/v2.1/threats/mitigate/remediate` |
| `Mitigate Threats - Rollback Remediation` | `4de74424-12dc-4f81-97b2-c6d819d17f37` | POST | `/web/api/v2.1/threats/mitigate/rollback-remediation` |
| `Ping Long Running Query` | `617741b9-8340-4f72-93ff-1000d16825fe` | GET | `/sdl/v2/api/queries/<@queryId@>` |
| `Reconnect Endpoint to Network` | `332d15f9-8bb5-4df4-a020-45a0a9cf3e0b` | POST | `/web/api/v2.1/agents/actions/connect` |
| `Restart Endpoints` | `30fa7849-e6f3-47c0-9d2f-1b43e06f9025` | POST | `/web/api/v2.1/agents/actions/restart-machine` |
| `Run Remote Script` | `3de49850-54d7-403c-a9a7-f8e72129f64b` | POST | `/web/api/v2.1/remote-scripts/execute` |
| `Shutdown Agents` | `0547ee5f-84d1-47dd-9fd9-b95da5521035` | POST | `/web/api/v2.1/agents/actions/shutdown` |
| `Uninstall Agents` | `366b3132-dad3-44ed-8c9d-35cea04d40af` | POST | `/web/api/v2.1/agents/actions/uninstall` |

</details>

## SentinelOne (Unified Alerts)  ·  `3e274c5a-f574-462f-8685-5eed98e90fbb`  ·  43 actions

**⭐ Lab-critical actions**

| Action | `public_action_id` | Method | url_path |
|---|---|---|---|
| `Add Note to Alert` | `34de543f-a745-42ac-84ec-6c2a87c26f60` | POST | `/web/api/v2.0/threats` |
| `Set Alert Status to In Progress` | `b9658ad8-24a1-4a6f-a490-f22a93445069` | POST | `/web/api/v2.0/threats` |
| `Set Alert Status to Resolved` | `6ee7243a-4112-46d5-9b2e-140b1a11278e` | POST | `/web/api/v2.0/threats` |
| `Set Analyst Verdict as True Positive Malware` | `8ec867d8-bb74-459f-8a17-d328d2e6776b` | POST | `/web/api/v2.0/threats` |
| `Set Analyst Verdict as False Positive Benign` | `ed217fb5-9184-4dce-a951-2e3d52d7d197` | POST | `/web/api/v2.0/threats` |
| `Set Analyst Verdict as Undefined` | `304c5ce5-7a4b-4535-84bb-1d06043675dc` | POST | `/web/api/v2.0/threats` |

<details><summary>All 43 actions</summary>

| Action | `public_action_id` | Method | url_path |
|---|---|---|---|
| `Add Alert Files to Blocklist Account Scope` | `e314e4f0-385b-4cdb-a68b-3ec2cfd67729` | POST | `/web/api/v2.0/threats` |
| `Add Alert Files to Blocklist Site Scope` | `8b38d01b-f4bd-4122-9524-1b04ebc02639` | POST | `/web/api/v2.0/threats` |
| `Add Alert to Exclusions Account Scope` | `6bdfb62b-f544-4842-9eec-1a1976d9853d` | POST | `/web/api/v2.0/threats` |
| `Add Alert to Exclusions Site Scope` | `f7676b74-3eb2-4b6f-94e5-1bff8d85b500` | POST | `/web/api/v2.0/threats` |
| `Add Note to Alert` | `34de543f-a745-42ac-84ec-6c2a87c26f60` | POST | `/web/api/v2.0/threats` |
| `Add Note to Vulnerability` | `d3f47f2b-6870-4b8a-94ac-216ccf933689` | POST | `/web/api/v2.1/remote-scripts/execute` |
| `Get Agentic Investigation Summary` | `288d7810-3e36-4aa0-a5a7-1c201c08020a` | POST | `/web/api/v2.1/unifiedalerts/graphql` |
| `Get Alert Ticket ID` | `75fb0f27-2648-4e78-958d-6e67f2ceca2d` | POST | `/web/api/v2.0/threats` |
| `Kill Alert Processes` | `af104a3f-89a7-45d9-af99-7af09964d96d` | POST | `/web/api/v2.0/threats` |
| `Mark Vulnerability as False Positive` | `f2255570-8b5b-4cb2-845d-78d473f70f61` | POST | `/web/api/v2.1/remote-scripts/execute` |
| `Mark Vulnerability as True Positive` | `bf9ab0be-4844-4611-8a15-65e0440e6a6c` | POST | `/web/api/v2.1/remote-scripts/execute` |
| `Quarantine Alert Files` | `c945d335-ff15-497b-9684-823d05c22dbe` | POST | `/web/api/v2.0/threats` |
| `Remediate Alert` | `9abe3a93-d95e-4cd0-bdfb-6c089dff99c2` | POST | `/web/api/v2.0/threats` |
| `Reset Vulnerability Verdict` | `1a837e2c-d941-4a61-abad-e859d2923102` | POST | `/web/api/v2.1/remote-scripts/execute` |
| `Resolve Alert as False Positive Benign` | `d42652f3-3792-4a11-b65a-a44343c595af` | POST | `/web/api/v2.0/threats` |
| `Resolve Alert as False Positive Benign but Suspicious` | `129b757e-9fd9-43fa-99d0-59342fbab7f4` | POST | `/web/api/v2.0/threats` |
| `Resolve Alert as False Positive Undefined` | `6dc62e2f-0562-4ebd-863b-ba875f31b8a2` | POST | `/web/api/v2.0/threats` |
| `Resolve Alert as False Positive User Error` | `1c4c33ff-c5b9-43ff-ac57-f42979c22a49` | POST | `/web/api/v2.0/threats` |
| `Resolve Alert as True Positive Malware` | `9a8578f0-b8dc-4b06-8e41-84e20028b7bf` | POST | `/web/api/v2.0/threats` |
| `Resolve Alert as True Positive Policy Violation` | `54a227d8-7b61-40bc-9a77-59bdc21c248b` | POST | `/web/api/v2.0/threats` |
| `Resolve Alert as True Positive Ransomware` | `cdb21b08-840d-454a-babe-2a19fbf0b021` | POST | `/web/api/v2.0/threats` |
| `Resolve Alert as True Positive Undefined` | `34a73603-3b5e-4ca0-90ad-4d7cdaff901d` | POST | `/web/api/v2.0/threats` |
| `Rollback Alert` | `c4ccb7df-072a-4324-b92c-12c772d4f553` | POST | `/web/api/v2.0/threats` |
| `Set Alert Status to In Progress` | `b9658ad8-24a1-4a6f-a490-f22a93445069` | POST | `/web/api/v2.0/threats` |
| `Set Alert Status to New` | `980c54d2-ed25-4228-ad3b-486d7e496feb` | POST | `/web/api/v2.0/threats` |
| `Set Alert Status to Resolved` | `6ee7243a-4112-46d5-9b2e-140b1a11278e` | POST | `/web/api/v2.0/threats` |
| `Set Alert Ticket ID` | `6dd22364-2ddd-4592-a05a-a0401b7cc222` | POST | `/web/api/v2.0/threats` |
| `Set Analyst Verdict as False Positive Benign` | `ed217fb5-9184-4dce-a951-2e3d52d7d197` | POST | `/web/api/v2.0/threats` |
| `Set Analyst Verdict as False Positive Benign but Suspicious` | `3c2924b3-89f5-42ab-b2c0-7713d8c880c0` | POST | `/web/api/v2.0/threats` |
| `Set Analyst Verdict as False Positive Undefined` | `fb264d94-644a-4075-b127-cede3f545ee0` | POST | `/web/api/v2.0/threats` |
| `Set Analyst Verdict as False Positive User Error` | `bdb6d84a-3384-4147-aeed-4354fd7006a7` | POST | `/web/api/v2.0/threats` |
| `Set Analyst Verdict as True Positive Malware` | `8ec867d8-bb74-459f-8a17-d328d2e6776b` | POST | `/web/api/v2.0/threats` |
| `Set Analyst Verdict as True Positive PUA Adware` | `319e57ed-9e9a-4013-aa9a-3252e3640f8a` | POST | `/web/api/v2.0/threats` |
| `Set Analyst Verdict as True Positive Policy Violation` | `5963a237-708d-4e4f-92d8-0a5fe70b7402` | POST | `/web/api/v2.0/threats` |
| `Set Analyst Verdict as True Positive Ransomware` | `ab0be592-0d83-44f8-8c2c-389c4778f612` | POST | `/web/api/v2.0/threats` |
| `Set Analyst Verdict as Undefined` | `304c5ce5-7a4b-4535-84bb-1d06043675dc` | POST | `/web/api/v2.0/threats` |
| `Set Vulnerability Status to New` | `52499fb4-9feb-4156-8c73-ab0e1b8e5fcd` | POST | `/web/api/v2.1/remote-scripts/execute` |
| `Set Vulnerability Status to On Hold` | `81c1de86-fec3-4ab3-98c6-2c940ebb7b9a` | POST | `/web/api/v2.1/remote-scripts/execute` |
| `Set Vulnerability Status to Resolved False Positive` | `490afdb9-188b-4c1c-b129-cbbcea7955d4` | POST | `/web/api/v2.1/remote-scripts/execute` |
| `Set Vulnerability Status to Resolved True Positive` | `811f5d98-5f66-4316-ac5b-ac0c69f0efc3` | POST | `/web/api/v2.1/remote-scripts/execute` |
| `Set Vulnerability Status to To Be Patched` | `dc370704-07cd-4fdc-a224-aedf60106346` | POST | `/web/api/v2.1/remote-scripts/execute` |
| `Trigger Agentic Investigation` | `99dd0d16-8eb5-4db9-8701-223e4e281f53` | POST | `/web/api/v2.1/unifiedalerts/graphql` |
| `Unquarantine` | `e97cef90-bdaa-41c9-9353-0ec7cf04624e` | POST | `/web/api/v2.0/threats` |

</details>

## Slack  ·  `43d27b10-ea4f-4829-a6d2-5de254dec613`  ·  18 actions

**⭐ Lab-critical actions**

| Action | `public_action_id` | Method | url_path |
|---|---|---|---|
| `Post Message` | `1a5289f8-e910-4228-a079-100bcbea03c2` | POST | `/api/chat.postMessage` |
| `Send Interactive Message` | `43c970e2-4519-4eef-84d4-80566c7a5532` | POST | `/api/chat.postMessage` |
| `Wait for Slack Interactive Message` | `ec6c6e55-5f75-419b-b696-d34ec89ad911` | — | `—` |
| `Post Ephemeral Message` | `f84f76cc-ee31-412c-88cd-6f70180303a9` | POST | `/api/chat.postEphemeral` |

<details><summary>All 18 actions</summary>

| Action | `public_action_id` | Method | url_path |
|---|---|---|---|
| `Add Bookmark to Channel` | `d2e5405d-bad8-4575-ab3a-3e837cfcbbca` | POST | `/api/bookmarks.edit` |
| `Archive Channel` | `d2444c31-3e29-47fc-b4a8-ffbbd8874daa` | POST | `/api/conversations.create` |
| `Create Private Channel` | `cfba9db9-5b29-4eef-89b4-25c7d15520ca` | POST | `/api/conversations.create` |
| `Create Public Channel` | `888f47c5-8a9f-4390-9465-a7f59d97aded` | POST | `/api/conversations.create` |
| `Edit Bookmark` | `d8923b4c-b6b2-4ebd-84fe-18b7c471b725` | POST | `/api/bookmarks.edit` |
| `Fetch Conversation History` | `3ab3461f-fd71-48d0-913d-f4937e131054` | POST | `/api/conversations.history` |
| `Find User by Email Address` | `5a42f231-04b7-469b-9364-39e6f0719ef9` | GET | `/api/users.lookupByEmail` |
| `Get User Presence Information` | `535c3a07-4a0d-40ac-83ed-d8f50b5334e4` | GET | `/api/users.list` |
| `Invite Users To a Channel` | `3554242f-6aa0-4495-a88e-d713c5a726e7` | POST | `/api/conversations.invite` |
| `List Channels and Conversations` | `63b7896d-1093-4367-b3e6-6c7b7e5b8558` | GET | `/api/conversations.list` |
| `List Slack Users` | `ec47262e-97ea-40c8-b6bd-0ad6754fe859` | GET | `/api/users.list` |
| `Post Ephemeral Message` | `f84f76cc-ee31-412c-88cd-6f70180303a9` | POST | `/api/chat.postEphemeral` |
| `Post Message` | `1a5289f8-e910-4228-a079-100bcbea03c2` | POST | `/api/chat.postMessage` |
| `Post Message In a Thread` | `42723783-cdfc-408d-9d0a-c78306ba4156` | POST | `/api/chat.postMessage` |
| `Remove Bookmark` | `3c31f4aa-1fa4-41d7-a758-4e64b1d9f761` | POST | `/api/bookmarks.edit` |
| `Send Interactive Message` | `43c970e2-4519-4eef-84d4-80566c7a5532` | POST | `/api/chat.postMessage` |
| `Send a File to a Channel` | `36619580-66f5-4e2d-8e13-953c24df5533` | POST | `/api/files.upload` |
| `Wait for Slack Interactive Message` | `ec6c6e55-5f75-419b-b696-d34ec89ad911` | — | `—` |

</details>

## AbuseIPDB  ·  `75af0459-ecea-48eb-9a62-7ec2e68a4c73`  ·  4 actions

**⭐ Lab-critical actions**

| Action | `public_action_id` | Method | url_path |
|---|---|---|---|
| `Check IP` | `6ea08101-8a9f-4559-8194-0af800acd620` | GET | `/api/v2/blacklist` |

<details><summary>All 4 actions</summary>

| Action | `public_action_id` | Method | url_path |
|---|---|---|---|
| `Check IP` | `6ea08101-8a9f-4559-8194-0af800acd620` | GET | `/api/v2/blacklist` |
| `Get IP Reports` | `1d4e3ff0-d27d-4cfb-ac8d-861c02df1b7b` | GET | `/api/v2/blacklist` |
| `Get Reported IPs` | `2e1761e1-b409-42d1-9ca8-265a78dd3ad2` | GET | `/api/v2/blacklist` |
| `Report IP` | `6846e00d-0ed5-44f1-ae09-f7ea5b301191` | POST | `/api/v2/report` |

</details>

## VirusTotal  ·  `9b735fa3-69db-4430-bca0-347b57a8604d`  ·  67 actions
<details><summary>All 67 actions</summary>

| Action | `public_action_id` | Method | url_path |
|---|---|---|---|
| `Add a comment on a URL` | `e7f71036-6fdc-43fc-a5ca-dca038a987a9` | POST | `/api/v3/urls/<<url-id>>/comments` |
| `Add a vote on a URL` | `11cb5618-1f2c-44f7-851f-a5f832066251` | POST | `/api/v3/urls/<<url-id>>/votes` |
| `Add a vote on a file` | `92a457e2-f98a-4fed-81ca-58cfb290ee8c` | POST | `/api/v3/files/<<file-id>>/votes` |
| `Add a vote to a domain` | `821b57fe-443c-4112-99e5-f4ece09f4e79` | POST | `/api/v3/domains/<<domain-id>>/votes` |
| `Add a vote to an IP address` | `fbfbdf21-2e2b-4a5e-b746-5dcf1583e79f` | POST | `/api/v3/ip_addresses/<<ip-id>>/votes` |
| `Cancel a Retrohunt Job` | `af215cbc-7f65-4a94-9562-f90f142584e5` | POST | `/api/v3/intelligence/retrohunt_jobs/<<retrohunt-job-id>>/abort` |
| `Create a Comment to an IP Address` | `b2188b3c-c719-45db-8faf-d048cc81c7c1` | POST | `/api/v3/ip_addresses/<<ip-id>>/comments` |
| `Create a graph` | `35a5f140-86cb-411b-abec-7e7d4fb933c4` | POST | `/api/v3/graphs` |
| `Delete a graph` | `452e89da-30f6-4bae-8f72-245f748686fa` | DELETE | `/api/v3/graphs/<<graph-id>>` |
| `Download a file` | `680702c9-d783-4855-a0f6-e4ea8ebc067f` | GET | `/api/v3/files/<<file-id>>/download` |
| `Download a file published in the file feed` | `a4f61725-8f02-48ba-be63-99355ab88058` | GET | `/api/v3/feeds/files/<<download-token>>/download` |
| `Get Analysis` | `0ce5be8c-12db-43fd-8535-1a392dcca594` | GET | `/api/v3/analyses/<<analysis-id>>` |
| `Get Daily Stats Grouped by VHASH` | `afdd6563-4529-4cca-bd63-5f551b4a4839` | GET | `/api/v3/stats/vhash_clusters` |
| `Get Votes of a File` | `75fb16c7-4c36-4e11-b277-177efc50b30e` | GET | `/api/v3/files/<<file-id>>/votes` |
| `Get a DNS resolution object` | `550ab53c-7f11-4baf-b4e3-1c66be316197` | GET | `/api/v3/resolutions/<<resolution-id>>` |
| `Get a Summary of all MITRE Techniques in a FIle` | `27250c7d-5b8e-41b3-9989-62c39802e246` | GET | `/api/v3/files/<<file-id>>/behaviour_mitre_trees` |
| `Get a URL analysis report` | `d32362a5-35b4-4609-810d-a7d4b21f766b` | GET | `/api/v3/urls/<<url-id>>` |
| `Get a URL for uploading large files` | `d5506265-cebf-46bd-8613-7059a4c33cb8` | GET | `/api/v3/files/upload_url` |
| `Get a User API Usage` | `52be324c-a52e-46b9-9c14-191a241891be` | GET | `/api/v3/users/<<user-id>>/api_usage` |
| `Get a ZIP File's Download URL` | `0b910e51-b481-4bd3-bf68-aa5b2e563c61` | GET | `/api/v3/intelligence/zip_files/<<zip-file-id>>/download_url` |
| `Get a crowdsourced Sigma rule object` | `52d0f8d0-9ce0-4f15-8bf9-18d6146867fd` | GET | `/api/v3/sigma_rules/<<rule-id>>` |
| `Get a crowdsourced YARA ruleset` | `09cb5729-7a0e-41ca-8d96-e331e7959e17` | GET | `/api/v3/yara_rulesets/<<ruleset-id>>` |
| `Get a detailed HTML behaviour report` | `745483bf-2a4d-433d-aef6-059e62ca7ffc` | GET | `/api/v3/file_behaviours/<<sandbox-id>>/html` |
| `Get a file behavior report from a sandbox` | `4b5eac84-ee96-4fee-82c6-85c202d991ab` | GET | `/api/v3/file_behaviours/<<sandbox-id>>` |
| `Get a files download URL` | `2cbe854f-f71a-4cfd-aaa2-170fd550d9ce` | GET | `/api/v3/files/<<file-id>>/download_url` |
| `Get a graph object` | `bbf550ca-e3ad-4c62-82a3-706073364fa2` | GET | `/api/v3/graphs/<<graph-id>>` |
| `Get a list of popular threat categories` | `2dd2f98b-1c12-4fe4-bf40-0bd0e470cd17` | GET | `/api/v3/popular_threat_categories` |
| `Get a submission object` | `01aa852c-cafb-4e44-a446-f4401e50e4b6` | GET | `/api/v3/submissions/<<submission-object-id>>` |
| `Get a summary of all behavior reports for a file` | `3a7bb87c-0f71-4cf9-9d05-720b94807828` | GET | `/api/v3/files/<<file-id>>/behaviour_summary` |
| `Get a users quota summary` | `b5eefa98-be9a-46a0-be2a-5cfb3fdff955` | GET | `/api/v3/users/<<user-id>>/overall_quotas` |
| `Get a widget rendering URL` | `fb8436c8-f63b-4161-87a6-14e29091fa5e` | GET | `/api/v3/widget/url` |
| `Get an Attack Technique Object` | `09705eaf-535d-41c3-88fb-3d6d6ef994cf` | GET | `/api/v3/attack_techniques/<<attack-technique-id>>` |
| `Get an Hourly Domain Feed Batch` | `d0d2ad3b-e51d-4ed4-b1cc-4eaf9c4fc62f` | GET | `/api/v3/feeds/domains/hourly/<<time>>` |
| `Get an Hourly File Behaviour Feed Batch` | `a04beb48-f58e-4465-a156-33e9c9ce756c` | GET | `/api/v3/feeds/file-behaviours/hourly/<<time>>` |
| `Get an Hourly URL Feed Batch` | `207ac3df-671b-48e2-951a-73d4419e6375` | GET | `/api/v3/feeds/urls/hourly/<<time>>` |
| `Get an attack tactic object` | `84dcc1aa-1e49-4bd7-ad40-d25bb5894788` | GET | `/api/v3/attack_tactics/<<attack-tactic-id>>` |
| `Get an hourly IP address feed batch` | `a255112f-c93c-41c9-8d0e-37b68c4c7d7a` | GET | `/api/v3/feeds/ip_addresses/hourly/<<time>>` |
| `Get comments on a URL` | `ea8245c8-d7d0-400b-890e-b1501af57d5a` | GET | `/api/v3/urls/<<url-id>>/comments` |
| `Get comments on a domain` | `18c3257f-3b9a-41bd-befd-4c6413bd459f` | GET | `/api/v3/domains/<<domain-id>>/comments` |
| `Get comments on a file` | `71043bc0-d7a4-4377-b28c-b550ebf6249d` | GET | `/api/v3/files/<<file-id>>/comments` |
| `Get comments on an IP address` | `986a90f4-0ea6-4af5-a05e-c03904eb9114` | GET | `/api/v3/ip_addresses/<<ip-id>>/comments` |
| `Get objects related to a URL` | `5244dbfc-dd68-4355-9809-13c289ac2190` | GET | `/api/v3/urls/<<url-id>>/<<object-type>>` |
| `Get objects related to a behaviour report` | `f669403e-b5f5-47c4-987c-60e8b247f4c9` | GET | `/api/v3/file_behaviours/<<sandbox-id>>/<<relationship>>` |
| `Get objects related to a file` | `989ee4c4-1a9c-42f7-b9ff-524a1a0af83f` | GET | `/api/v3/files/<<file-id>>/<<object-type>>` |
| `Get objects related to a graph` | `211d564b-29c3-4dec-b33c-45e471d34f3f` | GET | `/api/v3/graphs/<<graph-id>>/<<object-type>>` |
| `Get objects related to an IP address` | `9a748f66-d548-40c0-aea1-bd5690f19f5e` | GET | `/api/v3/domains/<<ip-id>>/<<object-type>>` |
| `Get objects related to an analysis` | `9c120acf-3939-4bef-a29c-0b075cf650f6` | GET | `/api/v3/analyses/<<analysis-id>>/<<object-type>>` |
| `Get objects related to an attack tactic` | `53573104-381e-4583-849b-cdede064e1f9` | GET | `/api/v3/attack_tactics/<<attack-tactic-id>>/<<object-type>>` |
| `Get objects related to an attack technique` | `b92ea497-2a3d-4df1-84fb-100fe8fb0492` | GET | `/api/v3/attack_tactics/<<attack-technique-id>>/<<object-type>>` |
| `Get votes on a URL` | `031beef2-063e-44d7-a6ec-980d63c792ef` | GET | `/api/v3/urls/<<url-id>>/votes` |
| `Get votes on a domain` | `589a67f3-088b-4786-bfd8-505573969b03` | GET | `/api/v3/domains/<<domain-id>>/votes` |
| `Get votes on an IP address` | `a28a634e-58f9-4d93-8388-a914dfabc719` | GET | `/api/v3/ip_addresses/<<ip-id>>/votes` |
| `Grant Read Permission to a Graph` | `8c44d884-57a4-4b11-aaa9-4519357aa798` | POST | `/api/v3/graphs/<<graph-id>>/relationships/viewers` |
| `List Objects Related to a Domain` | `c00e1bbb-946a-4f1c-affd-3c7676b7bb6e` | GET | `/api/v3/domains/<<domain-id>>/<<object-type>>` |
| `List Users and Groups with Read Permissions to a Graph` | `ff84d8c9-0c63-4a92-af44-f77f7f771cb9` | GET | `/api/v3/graphs/<<graph-id>>/relationships/viewers` |
| `Request a URL rescan` | `5e8c8b62-b7cc-4ba0-97cc-312e0c4ac49d` | POST | `/api/v3/urls/<<url-id>>/analyse` |
| `Request a file rescan` | `685829f4-1736-4165-8196-33615a725d02` | POST | `/api/v3/files/<<file-id >>/analyse` |
| `Retrieve the widgets HTML content` | `65fe9dff-d4b3-4fa6-99d9-f2f0e48e13d1` | GET | `/ui/widget/html/token` |
| `Revoke Edit Permission to a Graph` | `f7a8a3b7-2473-4f1d-ac5c-98c10d841c1a` | DELETE | `/api/v3/graphs/<<graph-id>>/relationships/editors/<<user-id OR group-id>>` |
| `Scan URL` | `f7178631-7c35-4244-b038-222b2a300763` | POST | `/api/v3/urls` |
| `Search Domain` | `202e00f0-426e-41ea-9235-1c136413abf1` | GET | `/api/v3/domains/<<domain>>` |
| `Search File Hash` | `bb65ec26-0d88-4f9e-9369-4ceba0e738bd` | GET | `/api/v3/files/<<file_hash>>` |
| `Search IP address` | `25394f56-6862-4ba7-9843-5d6c5fa3ac04` | GET | `/api/v3/ip_addresses/<<ip>>` |
| `Search for files URLs domains IPs and comments` | `29f9e680-d99d-41f9-a593-7bdef399e1c4` | GET | `/api/v3/search` |
| `Search graphs` | `a2d29d10-7f4a-4eee-a85d-d42555b6cfe4` | GET | `/api/v3/graphs` |
| `Update a graph object` | `dffde181-0acc-42f2-b746-c9a49256bc37` | PATCH | `/api/v3/graphs/<<graph-id>>` |
| `Upload a File for Scanning` | `56753ffc-0da5-4afd-803a-7849af562e4b` | POST | `/api/v3/files` |

</details>

## Wiring notes & gotchas
- **Cloudflare block (the OneFlare response):** `Create an IP Access rule` (`9db31c31…`, POST `/client/v4/user/firewall/access_rules/rules`) is account-scoped — no `zone_id` needed. Body: `{mode:"block", configuration:{target:"ip", value:"<src_ip>"}, notes:"..."}`. Reverse with `Delete an IP Access rule`.
- **Native hydration:** `Create A Power Query And Get Queryid` (`26adfd4c…`) is **async** — it returns a `queryId`; poll the companion query-result/status action in this integration before reading rows. Uses the console DV API (ApiToken), not the SDL LRQ Bearer endpoint.
- **Record the verdict natively:** prefer the `Set Analyst Verdict as …` / `Set Alert Status to …` actions over a free-text note alone — they set the alert's structured verdict. Per evidence discipline, only use a **True Positive** verdict action after VirusTotal/AbuseIPDB confirmation; otherwise `Set Alert Status to In Progress` + a note.
- **Add Note to Alert:** the catalogued native action is `34de543f…` (POST `/web/api/v2.0/threats`). The older `Blocklist IP` reference used a GraphQL `alertTriggerActions` variant (`c4d87734…`, POST `/unifiedalerts/graphql`) under the same integration — both work; prefer the catalogued one for new builds.
- **Slack gate:** `Send Interactive Message` (`43c970e2…`) → core `wait_for_slack` (proven in the reference) **or** the native `Wait for Slack Interactive Message` (`ec6c6e55…`).
- **Full 222-integration catalog** (CrowdStrike, Okta, Recorded Future, Palo Alto, Microsoft, etc.) is available from the same endpoint — re-fetch and extend this file when a new vendor comes in scope.
