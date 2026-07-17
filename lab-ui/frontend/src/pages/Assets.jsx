import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield, Workflow, LayoutDashboard,
  Copy, Check, Plug, Clock, Boxes, Swords,
} from 'lucide-react'
import { DETECTIONS, CAMPAIGN_DETECTIONS, HA_WORKFLOWS, DASHBOARDS } from '../data/knowledgeObjects.js'
import { loadHaWorkflowJson } from '../data/haPlaybooks.js'
import { SCENARIOS } from '../data/scenarios.js'
import Badge from '../components/Badge.jsx'

// ── Shared copy-to-clipboard button ─────────────────────────────────────────

function CopyButton({ text, label = 'Copy', getText }) {
  const [copied, setCopied] = useState(false)
  const onClick = async () => {
    const value = getText ? await getText() : text
    if (value == null) return
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all duration-200 shrink-0
        border-purple-500/30 text-purple-400 bg-purple-500/5 hover:bg-purple-500/15 hover:border-purple-400/40"
    >
      {copied ? (
        <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copied!</span></>
      ) : (
        <><Copy className="w-3.5 h-3.5" />{label}</>
      )}
    </button>
  )
}

// ── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, count, accent, sub }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${accent.iconBg}`}>
        <Icon className={`w-5 h-5 ${accent.text}`} />
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-slate-100 leading-tight">{label}</h2>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-white/5 border border-white/10 text-slate-400">
        {count}
      </span>
    </div>
  )
}

// ── Detection cards ──────────────────────────────────────────────────────────

function DetectionCard({ detection }) {
  const scenario = SCENARIOS.find(s => s.id === detection.scenarioId)
  const ruleJson = JSON.stringify(detection.rule, null, 2)

  return (
    <div className="rounded-xl border border-[#2d1b4e] bg-[#1a0a2e] p-4 transition-all duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {detection.box && (
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-pink-500/10 border border-pink-500/25 text-pink-300">
                {detection.box}
              </span>
            )}
            <h3 className="text-sm font-semibold text-slate-100 leading-snug break-words">{detection.name}</h3>
          </div>
          {scenario && (
            <Link
              to={`/scenarios/${scenario.id}`}
              className="text-xs text-orange-400 hover:underline inline-flex items-center gap-1 mt-1"
            >
              {scenario.number} · {scenario.title}
            </Link>
          )}
        </div>
        <CopyButton label="Copy JSON" text={ruleJson} />
      </div>

      {detection.description && (
        <p className="text-sm text-slate-400 leading-relaxed mb-3">{detection.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
        <Badge type="severity" value={detection.severity} />
        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
          {detection.queryType}
        </span>
        {detection.runIntervalMinutes != null && (
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            every {detection.runIntervalMinutes}m
          </span>
        )}
        {detection.lookbackWindowMinutes != null && (
          <span>lookback {detection.lookbackWindowMinutes}m</span>
        )}
      </div>
    </div>
  )
}

// ── Hyperautomation workflow cards ───────────────────────────────────────────

function HaWorkflowCard({ workflow }) {
  const scenarios = workflow.scenarioIds.map(id => SCENARIOS.find(s => s.id === id)).filter(Boolean)

  return (
    <div className="rounded-xl border border-[#2d1b4e] bg-[#1a0a2e] p-4 transition-all duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100 leading-snug">{workflow.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{workflow.detail}</p>
        </div>
        <CopyButton label="Copy JSON" getText={async () => {
          const json = await loadHaWorkflowJson(workflow.key)
          return json ? JSON.stringify(json, null, 2) : null
        }} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {scenarios.map(s => (
          <Link
            key={s.id}
            to={`/scenarios/${s.id}`}
            className="text-xs font-mono text-orange-400 bg-orange-500/5 border border-orange-500/20 rounded px-2 py-0.5 hover:bg-orange-500/15 transition-colors"
          >
            {s.number} · {s.title}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Plug className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        {workflow.connections.map(c => (
          <span
            key={c}
            className="inline-flex items-center rounded-full border border-[#2d1b4e] bg-white/5 px-2.5 py-0.5 text-xs font-mono text-slate-300"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Dashboard cards ───────────────────────────────────────────────────────────

function DashboardCard({ entry }) {
  const pretty = JSON.stringify(entry.dashboard, null, 2)

  return (
    <div className="rounded-xl border border-[#2d1b4e] bg-[#1a0a2e] p-4 transition-all duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-5 h-5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100 leading-snug">{entry.name}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {entry.tabs} tab{entry.tabs === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <CopyButton label="Copy JSON" text={pretty} />
      </div>

      {entry.description && (
        <p className="text-sm text-slate-400 leading-relaxed mb-3">{entry.description}</p>
      )}

      <div className="text-xs font-mono text-slate-500 bg-white/5 border border-white/10 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">
        {entry.deployPath}
      </div>
    </div>
  )
}

// ── Clickable stat tile (scrolls to its section) ────────────────────────────

function StatTile({ icon: Icon, value, label, color, iconBg, targetId }) {
  const go = () => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <button
      onClick={go}
      className="stat-card p-4 flex items-center gap-4 text-left w-full transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 cursor-pointer"
      title={`Jump to ${label}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
    </button>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Assets() {
  return (
    <div className="page-enter space-y-8 max-w-4xl mx-auto">
      {/* Hero header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Boxes className="w-5 h-5 text-orange-400" />
          <h1 className="text-2xl font-bold text-slate-100">Assets</h1>
        </div>
        <p className="text-sm text-slate-400 max-w-2xl">
          The deployable SentinelOne artifacts — detection rules, campaign detections, response
          workflows, and SDL dashboards — that back every scenario in this lab, all generated from a
          single source of truth. Deploy them to your own console from Settings → Lab Identity.
        </p>
      </div>

      {/* Stat strip — click a tile to jump to its section */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile
          icon={Shield} value={DETECTIONS.length} label="Core Detections"
          color="text-orange-400" iconBg="bg-orange-500/10" targetId="sec-detections"
        />
        <StatTile
          icon={Swords} value={CAMPAIGN_DETECTIONS.length} label="Campaign Detections"
          color="text-pink-400" iconBg="bg-pink-500/10" targetId="sec-campaign"
        />
        <StatTile
          icon={Workflow} value={HA_WORKFLOWS.length} label="HA Workflows"
          color="text-purple-400" iconBg="bg-purple-500/10" targetId="sec-ha"
        />
        <StatTile
          icon={LayoutDashboard} value={DASHBOARDS.length} label="SDL Dashboards"
          color="text-blue-400" iconBg="bg-blue-500/10" targetId="sec-dashboards"
        />
      </section>

      {/* Core Detections */}
      <section id="sec-detections" className="scroll-mt-24">
        <SectionHeader
          icon={Shield} label="Core Detections" count={DETECTIONS.length}
          sub="One STAR / scheduled rule per single-technique scenario"
          accent={{ iconBg: 'bg-orange-500/10 border-orange-500/20', text: 'text-orange-400' }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {DETECTIONS.map(detection => (
            <DetectionCard key={detection.key} detection={detection} />
          ))}
        </div>
      </section>

      {/* Campaign Detections */}
      <section id="sec-campaign" className="scroll-mt-24">
        <SectionHeader
          icon={Swords} label="Campaign Detections" count={CAMPAIGN_DETECTIONS.length}
          sub="The SoleDrop CTF box rules — deploy alongside the core set"
          accent={{ iconBg: 'bg-pink-500/10 border-pink-500/20', text: 'text-pink-400' }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {CAMPAIGN_DETECTIONS.map(detection => (
            <DetectionCard key={detection.key} detection={detection} />
          ))}
        </div>
      </section>

      {/* Hyperautomation */}
      <section id="sec-ha" className="scroll-mt-24">
        <SectionHeader
          icon={Workflow} label="Hyperautomation Workflows" count={HA_WORKFLOWS.length}
          sub="Alert-triggered SOAR response playbooks"
          accent={{ iconBg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-400' }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {HA_WORKFLOWS.map(workflow => (
            <HaWorkflowCard key={workflow.key} workflow={workflow} />
          ))}
        </div>
      </section>

      {/* Dashboards */}
      <section id="sec-dashboards" className="scroll-mt-24">
        <SectionHeader
          icon={LayoutDashboard} label="SDL Dashboards" count={DASHBOARDS.length}
          sub="Ready-to-import Singularity Data Lake dashboards"
          accent={{ iconBg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400' }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {DASHBOARDS.map(entry => (
            <DashboardCard key={entry.key} entry={entry} />
          ))}
        </div>
      </section>
    </div>
  )
}
