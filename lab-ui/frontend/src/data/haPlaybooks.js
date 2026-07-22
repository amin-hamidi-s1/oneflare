// Raw workflow JSON is only needed for the collapsible "Workflow JSON" copy panel,
// so it is lazy-loaded (dynamic import → its own chunk) rather than bundled into the
// main app chunk. See loadHaWorkflowJson() below and WorkflowJsonPanel in ScenarioDetail.jsx.
const WORKFLOW_LOADERS = {
  'web-attacks': () => import('./ha-workflows/web-attacks.workflow.json'),
  'cred-stuffing': () => import('./ha-workflows/cred-stuffing.workflow.json'),
  'data-exfil': () => import('./ha-workflows/data-exfil.workflow.json'),
  'bot-scraper': () => import('./ha-workflows/bot-scraper.workflow.json'),
  'prompt-injection': () => import('./ha-workflows/prompt-injection.workflow.json'),
  'dns-tunneling': () => import('./ha-workflows/dns-tunneling.workflow.json'),
  'ctf-campaign': () => import('./ha-workflows/ctf-campaign.workflow.json'),
  'reset-demo': () => import('./ha-workflows/reset-demo.workflow.json'),
}

export async function loadHaWorkflowJson(workflowKey) {
  const loader = WORKFLOW_LOADERS[workflowKey]
  if (!loader) return null
  const mod = await loader()
  return mod.default ?? mod
}

// Structured, HA-editor-style diagram data + narrative for the Hyperautomation (HA)
// response workflow behind each attack scenario's "Response Playbook" tab.
//
// Derived from the actual workflow JSON (hyperautomation/<name>/*.workflow.json) and
// its README — node labels/detail are collapsed to the README's own block-by-block
// abstraction level (variable/plumbing actions folded into their parent step), the
// same abstraction the README's own ASCII flow diagrams use. Nothing here is invented:
// every gate condition, connection, and action mirrors what's documented.
//
// diagram.blocks shape is documented in ../components/HAPlaybookDiagram.jsx.

const UNKNOWN_DEVICE =
  'Cloudflare alerts key on src_ip, not an S1 agent id, so they bind to "Unknown Device" in ' +
  'the console until the asset-enrichment solution runs — containment here is deliberately ' +
  'network-edge / IP-centric (Cloudflare block or challenge), not EDR host isolation.'

// ---------------------------------------------------------------------------
// Shared 4-step diagram builder — every scenario below (and cred-stuffing,
// defined further down) instantiates this same shape: (1) read src_ip off the
// alert + one native SentinelOne PowerQuery for corroborating evidence,
// (2) VirusTotal + AbuseIPDB threat intel, (3) an interactive Slack approval
// gate, (4) act + write back to the alert, branched on the analyst's click
// and (for the verdict) on an independent malicious TI verdict.
// ---------------------------------------------------------------------------

// Reusable Cloudflare enrichment + containment nodes (see hyperautomation/*/*.workflow.json).
const CF_ENRICH_ZONE = { label: 'Cloudflare Zone Details', detail: 'current zone posture / security_level for context (best-effort)' }
const CF_ENRICH_JD = { label: 'Cloudflare JD Cloud IP Details', detail: 'Cloudflare IP ranges — is the source a CF egress? (best-effort)' }
const CF_BLOCK = { label: 'Cloudflare Block IP', detail: 'zone IP Access Rule mode=block, target=src_ip', variant: 'destructive' }
const CF_CHALLENGE = { label: 'Cloudflare Managed-Challenge IP', detail: 'zone IP Access Rule mode=managed_challenge — softer than a hard block', variant: 'destructive' }
const cfRuleset = (detail) => ({ label: 'Cloudflare Custom Firewall Rule', detail, variant: 'destructive' })

// Every response playbook: (1) read src_ip + one SentinelOne PowerQuery + a best-effort
// Cloudflare enrichment read, (2) VirusTotal + AbuseIPDB threat intel, (3) an interactive
// Slack approval (fail-closed, 24h SLA with a US-Central respond-by deadline), (4) on
// approval — validate (already-blocked check) → scenario-specific Cloudflare containment →
// a conditional Slack update (clean on success; on ANY action failure it names the failed
// action + the exact Cloudflare error, e.g. "already blocked") → alert note + TI-gated verdict.
function responseDiagram({ triggerLabel, triggerDetail, pqLabel, pqDetail, fpCaveat, cfEnrich = CF_ENRICH_ZONE, containment = [CF_BLOCK] }) {
  return {
    blocks: [
      { kind: 'trigger', label: triggerLabel, detail: triggerDetail },
      {
        kind: 'enrichment',
        nodes: [
          { label: `SentinelOne PowerQuery — ${pqLabel}`, detail: pqDetail },
          cfEnrich,
          { label: 'VirusTotal Search IP', detail: 'GET /ip_addresses/{ip} — primary verdict (malicious count, geo)' },
          { label: 'AbuseIPDB Check IP', detail: 'IP reputation — secondary corroboration (abuseConfidenceScore)' },
        ],
      },
      {
        kind: 'action',
        nodes: [
          { label: 'Send Interactive Slack Message', detail: `Block Kit — evidence summary + FP caveat (${fpCaveat}) + [Block at Cloudflare] / [Dismiss] buttons + a US-Central respond-by deadline`, variant: 'notify' },
          { label: 'Wait For Slack (≤24h SLA)', detail: 'pause for the analyst click, correlated by message ts', variant: 'action' },
        ],
      },
      {
        kind: 'decision',
        label: 'Analyst Decision',
        detail: 'button value == "approved" (fail-closed — anything else dismisses)',
        converge: false,
        branches: {
          true: {
            label: 'approved → validate + contain',
            nodes: [
              { label: 'Cloudflare List Rules (validate)', detail: 'already-blocked check before acting', variant: 'action' },
              ...containment,
              { label: 'Slack Update — success / failure', detail: 'clean confirm on success; on ANY action failure, the failed action + the exact Cloudflare error (e.g. already blocked) + alert link', variant: 'notify' },
              { label: 'S1 Add Note — Approved', detail: 'evidence summary + approver written to the alert', variant: 'note' },
              { label: 'Set Verdict (TI-gated)', detail: 'VirusTotal malicious > 0 → True Positive Malware, else → Status In Progress', variant: 'note' },
            ],
          },
          false: {
            label: 'dismissed → no action',
            nodes: [
              { label: 'Slack Update — Dismissed', detail: 'chat.update records the FP call, no block applied', variant: 'notify' },
              { label: 'S1 Add Note — Dismissed', detail: 'dismissal rationale written to the alert', variant: 'note' },
              { label: 'Verdict — False Positive Benign', detail: 'closes the loop on the alert', variant: 'note' },
            ],
          },
        },
      },
    ],
  }
}

// Setup panel content — identical shape/content across every response
// playbook (matches the cred-stuffing playbook exactly).
const RESPONSE_SETUP = {
  intro:
    'This playbook uses native SentinelOne Hyperautomation integrations. Before importing, ' +
    'bind these console connections:',
  items: [
    { label: 'SentinelOne (Mgmt + Unified Alerts)', detail: 'API token — PowerQuery (DV API) + Add Note / Set Verdict' },
    { label: 'Slack', detail: 'bot token — interactive approval channel (chat.postMessage / chat.update)' },
    { label: 'Cloudflare', detail: 'API token — Zone WAF/Rulesets + DNS edit + account Gateway (block / challenge / route / DNS / under-attack)' },
    { label: 'VirusTotal', detail: 'free API key', url: 'https://www.virustotal.com/gui/join-us' },
    { label: 'AbuseIPDB', detail: 'free API key', url: 'https://www.abuseipdb.com/register' },
  ],
  note:
    'Import with a personal Console User API token and publish in the same step so the ' +
    'workflow is visible/editable in the HA console. Slack approval SLA is 24 h (the alert ' +
    'does not expire before then), and the message shows a US-Central respond-by deadline.',
}

const NATIVE_CONNECTIONS = ['SentinelOne', 'Slack', 'Cloudflare', 'VirusTotal', 'AbuseIPDB']

// ---------------------------------------------------------------------------
// web-attacks — shared by sqli / xss / traversal
// ---------------------------------------------------------------------------

function webAttacksDiagram(triggerLabel) {
  return responseDiagram({
    triggerLabel,
    triggerDetail: 'WAF ML flags SQLi/XSS/traversal on shop.soledrop.co → src_ip (alert observable / entityMappings)',
    pqLabel: 'WAF Attack Enrichment',
    pqDetail: 'native DV API (init-query → query-status → events) — attack_requests, worst_score, sample_uri, method for src_ip',
    fpCaveat: 'authorized vulnerability scan / pentest or sanctioned scanner?',
    cfEnrich: CF_ENRICH_JD,
    containment: [CF_BLOCK, cfRuleset('host-scoped rule — block ip.src eq src_ip and http.host eq shop.soledrop.co')],
  })
}

const WEB_ATTACKS_WHY =
  'One parametrized workflow (`web-attacks`) answers all three Cloudflare WAF ML detections — ' +
  'SQLi, XSS, and Path Traversal/LFI share a `CF-WAF-` alert-name prefix, so a single flow ' +
  'runs the same 4-step formula against the offending src_ip rather than duplicating the same ' +
  'logic three times: (1) read src_ip off the alert and run one native SentinelOne PowerQuery for ' +
  'attack-request count, worst WAF ML score, and a sample URI/method; (2) VirusTotal + AbuseIPDB ' +
  'threat intel; (3) an interactive Slack approval (wait_for_slack) — the workflow pauses and only ' +
  'blocks on an explicit "Block at Cloudflare" click; (4) the verdict write-back is itself ' +
  'evidence-gated — True Positive Malware only fires when VirusTotal independently confirms the IP ' +
  'as malicious, otherwise the alert is left In Progress (SUSPICIOUS — pending confirmation). ' + UNKNOWN_DEVICE

const webAttacksEntry = (triggerLabel) => ({
  workflowKey: 'web-attacks',
  workflowFile: 'web-attacks.workflow.json',
  title: 'Web-Attack (WAF) Response — shared workflow',
  why: WEB_ATTACKS_WHY,
  connections: NATIVE_CONNECTIONS,
  setup: RESPONSE_SETUP,
  diagram: webAttacksDiagram(triggerLabel),
})

// ---------------------------------------------------------------------------
// cred-stuffing
// ---------------------------------------------------------------------------

// Response playbook for CF-Access-CredStuffing-Response. 4-step formula: (1) enrich/
// investigate off the alert with one native S1 PowerQuery, (2) independent third-party
// threat intel (VirusTotal primary, AbuseIPDB secondary), (3) decide via an interactive
// Slack approval (containment always needs a human click), (4) act + write back —
// Cloudflare block only on approval, TRUE_POSITIVE verdict only on an independent
// malicious verdict, everything logged back onto the alert.
// Source: hyperautomation/cred-stuffing/cred-stuffing.workflow.json (19 nodes).
const credStuffingEntry = {
  workflowKey: 'cred-stuffing',
  workflowFile: 'cred-stuffing.workflow.json',
  title: 'Credential Stuffing / Brute-Force Response',
  why:
    'This playbook reads src_ip straight off the alert (entityMappings), then runs ONE native ' +
    'SentinelOne PowerQuery (async DV API: init-query → query-status → events) for corroborating ' +
    'evidence, rather than re-deriving the IP with extra queries. Independent third-party threat ' +
    'intel (VirusTotal primary, AbuseIPDB secondary) is gathered before any decision is made. ' +
    'Because a Cloudflare edge block affects every user behind that source IP, containment is ' +
    'gated on an interactive Slack approval (wait_for_slack) — the workflow pauses and only blocks ' +
    'on an explicit "Block at Cloudflare" click, never automatically. The verdict write-back is ' +
    'itself evidence-gated: True Positive Malware only fires when VirusTotal independently confirms ' +
    'the IP as malicious; an approved-but-unconfirmed block leaves the alert In Progress ' +
    '(SUSPICIOUS — pending confirmation), per the project\'s evidence discipline. ' + UNKNOWN_DEVICE,
  connections: [
    'SentinelOne (Mgmt) — ApiToken · PowerQuery / DV API',
    'SentinelOne (Unified Alerts) — ApiToken · Add Note / Set Verdict / Status',
    'Cloudflare — API token · Zone WAF/Rulesets + DNS + account Gateway: Edit',
    'Slack — bot token · interactive approval channel',
    'VirusTotal API key',
    'AbuseIPDB API key',
  ],
  setup: {
    intro:
      'This playbook uses native SentinelOne Hyperautomation integrations. Before importing, ' +
      'bind these console connections:',
    items: [
      { label: 'SentinelOne (Mgmt + Unified Alerts)', detail: 'API token — PowerQuery (DV API) + Add Note / Set Verdict' },
      { label: 'Slack', detail: 'bot token — interactive approval channel (chat.postMessage / chat.update)' },
      { label: 'Cloudflare', detail: 'API token — Zone WAF/Rulesets + DNS edit + account Gateway (block / challenge / route / DNS / under-attack)' },
      { label: 'VirusTotal', detail: 'free API key', url: 'https://www.virustotal.com/gui/join-us' },
      { label: 'AbuseIPDB', detail: 'free API key', url: 'https://www.abuseipdb.com/register' },
    ],
    note:
      'Import with a personal Console User API token and publish in the same step so the ' +
      'workflow is visible/editable in the HA console.',
  },
  diagram: responseDiagram({
    triggerLabel: 'CF-Access-CredStuffing — HIGH',
    triggerDetail: 'Login Brute Force / Credential Stuffing on portal.soledrop.co → src_ip (alert observable / entityMappings)',
    pqLabel: 'Failed-Login Enrichment',
    pqDetail: 'native DV API (init-query → query-status → events) — failed_logins, distinct_uas, hosts for src_ip, 24h',
    fpCaveat: 'shared VPN/NAT egress?',
    cfEnrich: CF_ENRICH_ZONE,
    containment: [CF_CHALLENGE],
  }),
}

// ---------------------------------------------------------------------------
// data-exfil
// ---------------------------------------------------------------------------

const dataExfilEntry = {
  workflowKey: 'data-exfil',
  workflowFile: 'data-exfil.workflow.json',
  title: 'Data-Exfiltration Response (api.soledrop.co)',
  why:
    'Runs the same 4-step formula against the source pulling data in bulk: (1) read src_ip off ' +
    'the alert and run one native SentinelOne PowerQuery for bytes pulled, sensitive endpoints ' +
    'enumerated, and the largest response; (2) VirusTotal + AbuseIPDB threat intel; (3) an ' +
    'interactive Slack approval (wait_for_slack) — the workflow pauses and only blocks on an ' +
    'explicit "Block at Cloudflare" click; (4) the verdict write-back is itself evidence-gated — ' +
    'True Positive Malware only fires when VirusTotal independently confirms the IP as malicious, ' +
    'otherwise the alert is left In Progress (SUSPICIOUS — pending confirmation). ' + UNKNOWN_DEVICE,
  connections: NATIVE_CONNECTIONS,
  setup: RESPONSE_SETUP,
  diagram: responseDiagram({
    triggerLabel: 'CF-API-BulkExfil — HIGH/CRITICAL',
    triggerDetail: 'sensitive-endpoint volume / oversized responses on api.soledrop.co → src_ip (alert observable / entityMappings)',
    pqLabel: 'Bulk-Exfil Enrichment',
    pqDetail: 'native DV API (init-query → query-status → events) — sensitive_hits, distinct_paths, max_bytes, largest_uri for src_ip',
    fpCaveat: 'authorized bulk export / ETL pipeline or backup service account?',
    cfEnrich: CF_ENRICH_ZONE,
    containment: [CF_BLOCK, cfRuleset('route rule — block http.host eq api.soledrop.co and uri.path starts_with /export')],
  }),
}

// ---------------------------------------------------------------------------
// bot-scraper
// ---------------------------------------------------------------------------

const botScraperEntry = {
  workflowKey: 'bot-scraper',
  workflowFile: 'bot-scraper.workflow.json',
  title: 'Bot / Scraper Response (BotScore)',
  why:
    'Runs the same 4-step formula against the source Cloudflare\'s ML flagged as automated — ' +
    'keyed on BotScore, never the User-Agent, which validated scraper hits trivially spoofed ' +
    '(Wrath-AIO, libwww-perl, PhantomJS): (1) read src_ip off the alert and run one native ' +
    'SentinelOne PowerQuery for low-BotScore request count, distinct paths crawled, and average ' +
    'BotScore; (2) VirusTotal + AbuseIPDB threat intel; (3) an interactive Slack approval ' +
    '(wait_for_slack) — the workflow pauses and only blocks on an explicit "Block at Cloudflare" ' +
    'click; (4) the verdict write-back is itself evidence-gated — True Positive Malware only fires ' +
    'when VirusTotal independently confirms the IP as malicious, otherwise the alert is left In ' +
    'Progress (SUSPICIOUS — pending confirmation). ' + UNKNOWN_DEVICE,
  connections: NATIVE_CONNECTIONS,
  setup: RESPONSE_SETUP,
  diagram: responseDiagram({
    triggerLabel: 'CF-BotMgmt-LowBotScoreScraper — MED/HIGH',
    triggerDetail: 'BotScore ≤ 29, ≥20 requests on shop.soledrop.co → src_ip (alert observable / entityMappings)',
    pqLabel: 'Bot-Scraper Enrichment',
    pqDetail: 'native DV API (init-query → query-status → events) — bot_requests, avg_botscore, distinct_paths, sample_ua for src_ip',
    fpCaveat: 'legitimate crawler — Googlebot/Bingbot, uptime/SEO monitor, or approved partner integration?',
    cfEnrich: CF_ENRICH_JD,
    containment: [CF_CHALLENGE],
  }),
}

// ---------------------------------------------------------------------------
// prompt-injection
// ---------------------------------------------------------------------------

const promptInjectionEntry = {
  workflowKey: 'prompt-injection',
  workflowFile: 'prompt-injection.workflow.json',
  title: 'LLM Prompt-Injection Response (SoleDrop Concierge chat)',
  why:
    'Runs the same 4-step formula against the source probing the AI concierge — the ' +
    'network/identity-level half of defense-in-depth (it does not inspect prompt content): ' +
    '(1) read src_ip off the alert and run one native SentinelOne PowerQuery for injection-attempt ' +
    'count, max attack score, and a sample payload/User-Agent; (2) VirusTotal + AbuseIPDB threat ' +
    'intel; (3) an interactive Slack approval (wait_for_slack) — the workflow pauses and only ' +
    'blocks on an explicit "Block at Cloudflare" click; (4) the verdict write-back is itself ' +
    'evidence-gated — True Positive Malware only fires when VirusTotal independently confirms the ' +
    'IP as malicious, otherwise the alert is left In Progress (SUSPICIOUS — pending confirmation). ' +
    UNKNOWN_DEVICE,
  connections: NATIVE_CONNECTIONS,
  setup: RESPONSE_SETUP,
  diagram: responseDiagram({
    triggerLabel: 'CF-FirewallForAI-PromptInjection — HIGH',
    triggerDetail: 'burst of chat POSTs to /api/v1/chat → src_ip (alert observable / entityMappings)',
    pqLabel: 'Prompt-Injection Enrichment',
    pqDetail: 'native DV API (init-query → query-status → events) — injection_posts, max_attack_score, distinct_uas, sample_uri/ua for src_ip',
    fpCaveat: 'authorized red-team / QA harness or sanctioned LLM-security scanner?',
    cfEnrich: CF_ENRICH_ZONE,
    containment: [CF_BLOCK, cfRuleset('route rule — managed_challenge http.host eq api.soledrop.co and uri.path starts_with /api/v1/chat')],
  }),
}

// ---------------------------------------------------------------------------
// dns-tunneling
// ---------------------------------------------------------------------------

const dnsTunnelingEntry = {
  workflowKey: 'dns-tunneling',
  workflowFile: 'dns-tunneling.workflow.json',
  title: 'DNS Tunneling / C2 Beaconing Response',
  why:
    'Runs the same 4-step formula against the source beaconing over Gateway DNS: (1) read ' +
    'src_ip off the alert and run one native SentinelOne PowerQuery for DNS query volume, distinct ' +
    'and long subdomains, and the suspected C2 domain; (2) VirusTotal + AbuseIPDB threat intel; ' +
    '(3) an interactive Slack approval (wait_for_slack) — the workflow pauses and only blocks on an ' +
    'explicit "Block at Cloudflare" click; (4) the verdict write-back is itself evidence-gated — ' +
    'True Positive Malware only fires when VirusTotal independently confirms the IP as malicious, ' +
    'otherwise the alert is left In Progress (SUSPICIOUS — pending confirmation). ' + UNKNOWN_DEVICE,
  connections: NATIVE_CONNECTIONS,
  setup: RESPONSE_SETUP,
  diagram: responseDiagram({
    triggerLabel: 'CF-Gateway-DNSTunnel — HIGH',
    triggerDetail: 'high-entropy / long-label DNS query clustering on Gateway DNS → src_ip (alert observable / entityMappings)',
    pqLabel: 'DNS-Tunnel Enrichment',
    pqDetail: 'native DV API (init-query → query-status → events) — total_queries, distinct_subdomains, long_subdomains, c2_domain for src_ip',
    fpCaveat: 'shared resolver/forwarder egress or a legitimate high-cardinality cloud service?',
    cfEnrich: CF_ENRICH_ZONE,
    containment: [CF_BLOCK, { label: 'Cloudflare Gateway DNS Block', detail: 'Zero-Trust Gateway rule — block the C2 domain', variant: 'destructive' }, { label: 'Cloudflare Create Sinkhole DNS Record', detail: 'A record → 192.0.2.1 (visible in DNS portal)', variant: 'destructive' }],
  }),
}

// ---------------------------------------------------------------------------
// ctf-campaign — "Operation Drop-Day Bot Swarm" (SoleDrop CTF)
// ---------------------------------------------------------------------------

const ctfCampaignEntry = {
  workflowKey: 'ctf-campaign',
  workflowFile: 'ctf-campaign.workflow.json',
  title: 'SoleDrop CTF Campaign Response (Operation Drop-Day Bot Swarm)',
  why:
    'One workflow answers all 4 CTF boxes — every box\'s STAR/scheduled rule shares a "SoleDrop ' +
    'CTF" alert-name prefix, so a single flow runs the same 4-step formula against whichever ' +
    'box fires: (1) read src_ip off the alert and run one native SentinelOne PowerQuery for the ' +
    'JA3 fingerprint, distinct User-Agent count, and recon + injection/RCE signal counts; ' +
    '(2) VirusTotal + AbuseIPDB threat intel; (3) an interactive Slack approval (wait_for_slack) — ' +
    'the workflow pauses and only blocks on an explicit "Block at Cloudflare" click; (4) the ' +
    'verdict write-back is itself evidence-gated — True Positive Malware only fires when ' +
    'VirusTotal independently confirms the IP as malicious, otherwise the alert is left In ' +
    'Progress (SUSPICIOUS — pending confirmation). ' + UNKNOWN_DEVICE,
  connections: NATIVE_CONNECTIONS,
  setup: RESPONSE_SETUP,
  diagram: responseDiagram({
    triggerLabel: 'SoleDrop CTF — any box (1–4)',
    triggerDetail: 'name contains "SoleDrop CTF" → src_ip (alert observable / entityMappings)',
    pqLabel: 'CTF Campaign Enrichment',
    pqDetail: 'native DV API (init-query → query-status → events) — hits, distinct_uas, ja3, distinct_ja3, distinct_paths, recon_hits, injection_hits for src_ip',
    fpCaveat: 'shared corporate VPN/NAT egress or a sanctioned scanner?',
    cfEnrich: CF_ENRICH_ZONE,
    containment: [CF_BLOCK, cfRuleset('JA3 rule — block cf.bot_management.ja3_hash eq <swarm fingerprint>'), { label: 'Cloudflare Edit Zone — Under Attack Mode', detail: 'zone-wide security_level=under_attack (reverted by CF-Reset-Demo)', variant: 'destructive' }],
  }),
}

export const HA_PLAYBOOKS = {
  sqli: webAttacksEntry('CF-WAF-SQLi — HIGH/CRITICAL'),
  xss: webAttacksEntry('CF-WAF-XSS — HIGH/CRITICAL'),
  traversal: webAttacksEntry('CF-WAF-Traversal — HIGH/CRITICAL'),
  cred: credStuffingEntry,
  exfil: dataExfilEntry,
  bot: botScraperEntry,
  promptinj: promptInjectionEntry,
  dns: dnsTunnelingEntry,
  ctf: ctfCampaignEntry,
}
