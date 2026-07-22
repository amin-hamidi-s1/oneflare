// ── Canonical knowledge-object registry (single source of truth) ─────────────
//
// Every deployable SentinelOne artifact the lab ships — STAR/scheduled detection
// rules, Hyperautomation response workflows, and SDL dashboards — is listed here,
// each tied to the scenario it belongs to. BOTH the Architecture page (the
// "knowledge objects" collapsibles + the Deploy wizard) AND the Scenarios pages
// read from this module, so editing an object here (or its underlying vendored
// JSON) updates every surface at once — no duplicated, drifting copies.
//
// The detection rule bodies are the ACTUAL deployed rule JSON (verbatim copies of
// detections/<name>/*.rule.json), so "what the card shows" == "what deploys".

import webSqli from './detections/web-sqli.rule.json'
import webXss from './detections/web-xss.rule.json'
import webTraversal from './detections/web-traversal.rule.json'
import credStuffing from './detections/cred-stuffing.rule.json'
import dataExfil from './detections/data-exfil.rule.json'
import botScraper from './detections/bot-scraper.rule.json'
import promptInjection from './detections/prompt-injection.rule.json'
import dnsTunneling from './detections/dns-tunneling.rule.json'

// CTF campaign detections (deployable rule bodies extracted verbatim from
// detections/ctf/*.json api_body). Pushed by the Deploy wizard alongside the base rules.
import ctfBox1ScannerRecon from './detections/campaigns/ctf-box1-scanner-recon.rule.json'
import ctfBox1ReconSweepFanout from './detections/campaigns/ctf-box1-recon-sweep-fanout.rule.json'
import ctfBox2PolymorphicJa4 from './detections/campaigns/ctf-box2-polymorphic-ja4.rule.json'
import ctfBox3ConciergePromptInjection from './detections/campaigns/ctf-box3-concierge-prompt-injection.rule.json'
import ctfBox3ConciergeInjectionBurst from './detections/campaigns/ctf-box3-concierge-injection-burst.rule.json'
import ctfBox4AgenticBreakout from './detections/campaigns/ctf-box4-agentic-breakout.rule.json'
import ctfBox4MultiVectorStorm from './detections/campaigns/ctf-box4-multi-vector-storm.rule.json'
import exfilTrainingDataModelWeights from './detections/campaigns/exfil-training-data-model-weights.rule.json'

import threatDetectionDashboard from './dashboards/threat-detection.dashboard.json'
import ingestionInventoryDashboard from './dashboards/ingestion-inventory.dashboard.json'

// deployedId = the rule id currently live in the reference S1 tenant (for
// reference/dedup only; a user deploying to their OWN console gets fresh ids).
const DETECTION_DEFS = [
  { key: 'web-sqli',         scenarioId: 'sqli',      rule: webSqli,         deployedId: '2519092985434164473' },
  { key: 'web-xss',          scenarioId: 'xss',       rule: webXss,          deployedId: '2519092991281024296' },
  { key: 'web-traversal',    scenarioId: 'traversal', rule: webTraversal,    deployedId: '2519092998092573998' },
  { key: 'cred-stuffing',    scenarioId: 'cred',      rule: credStuffing,    deployedId: '2519093004283366750' },
  { key: 'data-exfil',       scenarioId: 'exfil',     rule: dataExfil,       deployedId: '2519093015733817725' },
  { key: 'bot-scraper',      scenarioId: 'bot',       rule: botScraper,      deployedId: '2523842940840264774' },
  { key: 'prompt-injection', scenarioId: 'promptinj', rule: promptInjection, deployedId: '2519093028014740613' },
  { key: 'dns-tunneling',    scenarioId: 'dns',       rule: dnsTunneling,    deployedId: '2519102258169184569' },
]

// Normalize each detection to the shape both the UI and the deploy layer consume.
// Facts (name/severity/queryType/query) come straight from the deployed rule JSON.
export const DETECTIONS = DETECTION_DEFS.map(({ key, scenarioId, rule, deployedId }) => {
  const data = rule.data || {}
  return {
    type: 'detection',
    key,
    scenarioId,
    name: data.name || key,
    description: data.description || '',
    severity: data.severity || 'Medium',
    queryType: data.queryType || 'scheduled',
    query: data.scheduledParams?.query || data.s1ql || '',
    runIntervalMinutes: data.scheduledParams?.runIntervalMinutes ?? null,
    lookbackWindowMinutes: data.scheduledParams?.lookbackWindowMinutes ?? null,
    deployedId,
    rule, // full deployable JSON
  }
})

// CTF campaign detections — same deployable shape as the base rules, tied to the
// 'ctf' campaign/scenario. The Deploy wizard POSTs `item.rule` for each of these.
const CAMPAIGN_DETECTION_DEFS = [
  { key: 'ctf-box1-scanner-recon',              campaignId: 'ctf', box: 'Box 1', rule: ctfBox1ScannerRecon,             scenarioId: 'ctf' },
  { key: 'ctf-box1-recon-sweep-fanout',         campaignId: 'ctf', box: 'Box 1', rule: ctfBox1ReconSweepFanout,         scenarioId: 'ctf' },
  { key: 'ctf-box2-polymorphic-ja4',            campaignId: 'ctf', box: 'Box 2', rule: ctfBox2PolymorphicJa4,           scenarioId: 'ctf' },
  { key: 'ctf-box3-concierge-prompt-injection', campaignId: 'ctf', box: 'Box 3', rule: ctfBox3ConciergePromptInjection, scenarioId: 'ctf' },
  { key: 'ctf-box3-concierge-injection-burst',  campaignId: 'ctf', box: 'Box 3', rule: ctfBox3ConciergeInjectionBurst,  scenarioId: 'ctf' },
  { key: 'ctf-box4-agentic-breakout',           campaignId: 'ctf', box: 'Box 4', rule: ctfBox4AgenticBreakout,          scenarioId: 'ctf' },
  { key: 'ctf-box4-multi-vector-storm',         campaignId: 'ctf', box: 'Box 4', rule: ctfBox4MultiVectorStorm,         scenarioId: 'ctf' },
  { key: 'exfil-training-data-model-weights',   campaignId: 'ctf', box: 'Cross-box', rule: exfilTrainingDataModelWeights, scenarioId: 'ctf' },
]

export const CAMPAIGN_DETECTIONS = CAMPAIGN_DETECTION_DEFS.map(({ key, campaignId, box, rule, scenarioId }) => {
  const data = rule.data || {}
  return {
    type: 'detection',
    key,
    campaignId,
    scenarioId,
    box,
    name: data.name || key,
    description: data.description || '',
    severity: data.severity || 'Medium',
    queryType: data.queryType || 'scheduled',
    query: data.scheduledParams?.query || data.s1ql || '',
    runIntervalMinutes: data.scheduledParams?.runIntervalMinutes ?? null,
    lookbackWindowMinutes: data.scheduledParams?.lookbackWindowMinutes ?? null,
    deployedId: null,
    rule, // full deployable JSON
  }
})

// Hyperautomation response workflows. workflowKey matches the loaders in
// haPlaybooks.js (src/data/ha-workflows/<key>.workflow.json) so the raw JSON is
// lazy-loaded on demand. web-attacks covers three scenarios.
const NATIVE_CONNECTIONS = ['SentinelOne', 'Slack', 'Cloudflare', 'VirusTotal', 'AbuseIPDB']

export const HA_WORKFLOWS = [
  { type: 'ha', key: 'web-attacks',      scenarioIds: ['sqli', 'xss', 'traversal'], name: 'CF-WAF-WebAttack', detail: 'SQLi / XSS / Path-Traversal — parametrized', connections: NATIVE_CONNECTIONS },
  { type: 'ha', key: 'cred-stuffing',    scenarioIds: ['cred'],       name: 'CF-Access-CredStuffing', detail: 'Brute force / credential stuffing', connections: NATIVE_CONNECTIONS },
  { type: 'ha', key: 'data-exfil',       scenarioIds: ['exfil'],      name: 'CF-API-Exfil', detail: 'Bulk pull / endpoint enumeration', connections: NATIVE_CONNECTIONS },
  { type: 'ha', key: 'bot-scraper',      scenarioIds: ['bot'],        name: 'CF-Bot-Scraper', detail: 'Low-BotScore automated scraping', connections: NATIVE_CONNECTIONS },
  { type: 'ha', key: 'prompt-injection', scenarioIds: ['promptinj'],  name: 'CF-AI-PromptInjection', detail: 'LLM jailbreak / injection probing', connections: NATIVE_CONNECTIONS },
  { type: 'ha', key: 'dns-tunneling',    scenarioIds: ['dns'],        name: 'CF-Gateway-DNSTunnel', detail: 'DNS tunneling / C2 beaconing', connections: NATIVE_CONNECTIONS },
  { type: 'ha', key: 'ctf-campaign',     scenarioIds: ['ctf'],        name: 'CF-Campaign-DropDaySwarm', detail: 'Operation Drop-Day Bot Swarm — recon → bot swarm → AI abuse → breakout', connections: NATIVE_CONNECTIONS },
  { type: 'ha', key: 'reset-demo',        scenarioIds: [],             name: 'CF-Reset-Demo', detail: 'Manual reset — reverts every demo Cloudflare artifact (IP access rules, custom-firewall/Ruleset rules, Gateway DNS rules, sinkhole DNS record, Under-Attack mode) so the lab is clean for the next run', connections: ['Cloudflare'] },
]

// SDL dashboards (config-as-JSON put to /dashboards/<name>).
export const DASHBOARDS = [
  { type: 'dashboard', key: 'threat-detection',  name: 'Cloudflare', deployPath: '/dashboards/threat-detection',            description: threatDetectionDashboard.description || '', tabs: (threatDetectionDashboard.tabs || []).length,  dashboard: threatDetectionDashboard },
  { type: 'dashboard', key: 'ingestion-inventory', name: 'Cloudflare Ingestion',  deployPath: '/dashboards/cloudflare-ingestion-inventory', description: ingestionInventoryDashboard.description || '', tabs: (ingestionInventoryDashboard.tabs || []).length, dashboard: ingestionInventoryDashboard },
]

// Lookups by scenario id — used by the Scenarios pages to pull canonical facts.
export const detectionForScenario = (scenarioId) => DETECTIONS.find(d => d.scenarioId === scenarioId) || null
export const haWorkflowsForScenario = (scenarioId) => HA_WORKFLOWS.filter(w => w.scenarioIds.includes(scenarioId))

// Everything the Deploy wizard can push, grouped by type.
export const KNOWLEDGE_OBJECT_GROUPS = [
  { type: 'detection', label: 'STAR / Scheduled Detections', items: DETECTIONS },
  { type: 'ha',        label: 'Hyperautomation Workflows',   items: HA_WORKFLOWS },
  { type: 'dashboard', label: 'SDL Dashboards',              items: DASHBOARDS },
  { type: 'detection', label: 'Campaign Detections (CTF)',   items: CAMPAIGN_DETECTIONS },
]
