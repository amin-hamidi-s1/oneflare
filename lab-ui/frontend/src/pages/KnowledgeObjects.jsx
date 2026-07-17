import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield, Workflow, LayoutDashboard, Terminal as TerminalIcon,
  Copy, Check, CheckCircle, ChevronDown, ChevronUp, Plug,
  FileCode, Clock, Boxes,
} from 'lucide-react'
import { DETECTIONS, HA_WORKFLOWS, DASHBOARDS } from '../data/knowledgeObjects.js'
import { SCENARIOS } from '../data/scenarios.js'
import Badge from '../components/Badge.jsx'

// ── Shared copy-to-clipboard button ─────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
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

function SectionHeader({ icon: Icon, label, count, accent }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${accent.iconBg}`}>
        <Icon className={`w-5 h-5 ${accent.text}`} />
      </div>
      <h2 className="text-lg font-bold text-slate-100">{label}</h2>
      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-white/5 border border-white/10 text-slate-400">
        {count}
      </span>
    </div>
  )
}

// ── Detection cards ──────────────────────────────────────────────────────────

function DetectionCard({ detection }) {
  const [open, setOpen] = useState(false)
  const scenario = SCENARIOS.find(s => s.id === detection.scenarioId)

  return (
    <div className="rounded-xl border border-[#2d1b4e] bg-[#1a0a2e] p-4 transition-all duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100 leading-snug">{detection.name}</h3>
          {scenario && (
            <Link
              to={`/scenarios/${scenario.id}`}
              className="text-xs text-orange-400 hover:underline inline-flex items-center gap-1 mt-1"
            >
              {scenario.number} · {scenario.title}
            </Link>
          )}
        </div>
        <Badge type="severity" value={detection.severity} />
      </div>

      {detection.description && (
        <p className="text-sm text-slate-400 leading-relaxed mb-3">{detection.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono mb-3">
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

      <div
        className="collapsible-header !p-2.5 !rounded-lg border border-[#2d1b4e]"
        onClick={() => setOpen(o => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-purple-400" />
          {detection.queryType === 'scheduled' ? 'PowerQuery' : 'S1QL'}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {open && (
        <div className="mt-2">
          <div className="flex justify-end mb-1.5">
            <CopyButton text={detection.query} />
          </div>
          <pre
            className="terminal-scroll text-xs leading-relaxed overflow-x-auto rounded-lg p-3 whitespace-pre-wrap max-h-72"
            style={{
              background: '#0a0a14',
              border: '1px solid #1e1235',
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              color: '#c4b5fd',
            }}
          >
            <code>{detection.query}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Hyperautomation workflow cards ───────────────────────────────────────────

function HaWorkflowCard({ workflow }) {
  const scenarios = workflow.scenarioIds.map(id => SCENARIOS.find(s => s.id === id)).filter(Boolean)

  return (
    <div className="rounded-xl border border-[#2d1b4e] bg-[#1a0a2e] p-4 transition-all duration-200 hover:-translate-y-0.5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-100 leading-snug">{workflow.name}</h3>
        <p className="text-xs text-slate-400 mt-0.5">{workflow.detail}</p>
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
  const [codeOpen, setCodeOpen] = useState(false)
  const pretty = JSON.stringify(entry.dashboard, null, 2)

  return (
    <div className="rounded-xl border border-[#2d1b4e] bg-[#1a0a2e] p-4 transition-all duration-200 hover:-translate-y-0.5">
      <div className="flex items-start gap-3 mb-2">
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

      {entry.description && (
        <p className="text-sm text-slate-400 leading-relaxed mb-3">{entry.description}</p>
      )}

      <div className="text-xs font-mono text-slate-500 bg-white/5 border border-white/10 rounded px-2 py-1.5 mb-3 overflow-x-auto whitespace-nowrap">
        {entry.deployPath}
      </div>

      <div
        className="collapsible-header !p-2.5 !rounded-lg border border-[#2d1b4e]"
        onClick={() => setCodeOpen(o => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setCodeOpen(o => !o)}
        aria-expanded={codeOpen}
      >
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
          <FileCode className="w-3.5 h-3.5 text-orange-400" />
          {entry.key}.dashboard.json
        </span>
        {codeOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {codeOpen && (
        <div className="mt-2">
          <div className="flex justify-end mb-1.5">
            <CopyButton text={pretty} label="Copy JSON" />
          </div>
          <pre className="terminal-scroll bg-black/40 border border-white/5 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-auto max-h-72 leading-relaxed">
            {pretty}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({ icon: Icon, value, label, color, iconBg }) {
  return (
    <div className="stat-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function KnowledgeObjects() {
  return (
    <div className="page-enter space-y-8 max-w-4xl mx-auto">
      {/* Hero header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Boxes className="w-5 h-5 text-orange-400" />
          <h1 className="text-2xl font-bold text-slate-100">Knowledge Objects</h1>
        </div>
        <p className="text-sm text-slate-400 max-w-2xl">
          The deployable SentinelOne artifacts — detection rules, response workflows, and SDL
          dashboards — that back every scenario in this lab, all generated from a single source
          of truth.
        </p>
      </div>

      {/* Stat strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          icon={Shield}
          value={DETECTIONS.length}
          label="STAR / Scheduled Detections"
          color="text-orange-400"
          iconBg="bg-orange-500/10"
        />
        <StatTile
          icon={Workflow}
          value={HA_WORKFLOWS.length}
          label="Hyperautomation Workflows"
          color="text-purple-400"
          iconBg="bg-purple-500/10"
        />
        <StatTile
          icon={LayoutDashboard}
          value={DASHBOARDS.length}
          label="SDL Dashboards"
          color="text-blue-400"
          iconBg="bg-blue-500/10"
        />
      </section>

      {/* Detections */}
      <section>
        <SectionHeader
          icon={Shield}
          label="Detections"
          count={DETECTIONS.length}
          accent={{ iconBg: 'bg-orange-500/10 border-orange-500/20', text: 'text-orange-400' }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {DETECTIONS.map(detection => (
            <DetectionCard key={detection.key} detection={detection} />
          ))}
        </div>
      </section>

      {/* Hyperautomation */}
      <section>
        <SectionHeader
          icon={Workflow}
          label="Hyperautomation Workflows"
          count={HA_WORKFLOWS.length}
          accent={{ iconBg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-400' }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {HA_WORKFLOWS.map(workflow => (
            <HaWorkflowCard key={workflow.key} workflow={workflow} />
          ))}
        </div>
      </section>

      {/* Dashboards */}
      <section>
        <SectionHeader
          icon={LayoutDashboard}
          label="SDL Dashboards"
          count={DASHBOARDS.length}
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
