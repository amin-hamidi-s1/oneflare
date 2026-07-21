import { useState, useEffect } from 'react'
import {
  Rocket, X, CheckCircle2, XCircle, AlertTriangle, Loader2, Info,
  ChevronDown, ChevronUp, KeyRound, RefreshCw, Pencil, Unlink, Lock,
  Shield, Workflow, LayoutDashboard, ServerCog, Circle, Plus, Star, Server,
} from 'lucide-react'
import Badge from './Badge.jsx'
import { KNOWLEDGE_OBJECT_GROUPS } from '../data/knowledgeObjects.js'
import { loadHaWorkflowJson } from '../data/haPlaybooks.js'

// Deploy wizard — pushes the lab's canonical SentinelOne assets (detections,
// Hyperautomation workflows, dashboards — see src/data/knowledgeObjects.js)
// to a signed-in user's OWN SentinelOne console(s) via the session-gated
// /api/deploy/* backend contract:
//   GET    /api/deploy/config          -> {configured, connections:[...], default_id}
//   POST   /api/deploy/config          -> same shape (add or update one connection; secrets write-only)
//   POST   /api/deploy/config/default  -> same shape (mark a connection default)
//   DELETE /api/deploy/config[?id=]    -> same shape (remove one connection, or all)
//   POST   /api/deploy/validate        -> {ok, connection_id, console_url, site, capabilities, messages}
//   POST   /api/deploy/run             -> {ok, connection_id, console_url, site, results:[...]}
//
// A user can save MULTIPLE consoles and pick one OR MORE as deploy targets; the
// wizard fans out validate/run once per selected target. Four steps:
// Configure -> Validate -> Select -> Deploy. Every fetch handles 401 (sign in)
// and 403 (read-only role) the same way everywhere via `gate`.

const STEPS = [
  { id: 'configure', label: 'Configure' },
  { id: 'validate', label: 'Validate' },
  { id: 'select', label: 'Select' },
  { id: 'deploy', label: 'Deploy' },
]

const GROUP_ICON = { detection: Shield, ha: Workflow, dashboard: LayoutDashboard }
const CAP_KEY = { detection: 'detections', ha: 'ha', dashboard: 'dashboards' }
const CAP_KEYS = ['detections', 'ha', 'dashboards']
const CAPABILITY_ROWS = [
  { key: 'detections', label: 'Detections' },
  { key: 'ha', label: 'Hyperautomation' },
  { key: 'dashboards', label: 'Dashboards' },
]

// Flat lookup of every deployable item by "type:key" — used to resolve a
// human-readable name for a deploy result row.
const ITEM_BY_ID = {}
for (const group of KNOWLEDGE_OBJECT_GROUPS) {
  for (const item of group.items) ITEM_BY_ID[`${group.type}:${item.key}`] = item
}
const idFor = (type, key) => `${type}:${key}`

// AND the capabilities across a set of validated targets — an asset type is only
// offered in Select if EVERY selected (and successfully validated) target supports
// it, so a chosen object can never fail on a target that lacks the capability.
function intersectCaps(list) {
  if (!list.length) return {}
  const out = {}
  for (const k of CAP_KEYS) out[k] = list.every((c) => !!(c && c[k]))
  return out
}

function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function hostOf(url) {
  if (!url) return ''
  try { return new URL(url).host } catch { return url }
}

// Turn an HTTP error into an actionable message: prefer the backend's own
// error/detail, else surface a trimmed snippet of the raw body (strips HTML from
// edge/Access/WAF blocks), plus a hint for common statuses.
function describeHttpError(status, data, rawText, verb = 'Request') {
  const detail = (data && (data.error || (typeof data.detail === 'string' ? data.detail : null))) || ''
  const snippet = !detail && rawText
    ? rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220)
    : ''
  const hints = {
    403: 'Permission denied. If you used a scoped service-user token, its role may be missing a required write permission — deploying needs STAR Custom Rules, Hyperautomation, and (for dashboards) SDL Dashboards + SDL Configuration Files. If it persists after a page reload, your Cloudflare Access session may have expired — reload and sign in again.',
    502: 'The backend could not reach your SentinelOne console — check the Console URL and that the token is valid.',
    500: 'The backend hit an unexpected error while deploying.',
  }
  const hint = hints[status] || ''
  const lead = detail || snippet || `${verb} failed`
  return `${lead} (HTTP ${status})${hint ? ` — ${hint}` : ''}`
}

// ── Small shared bits ───────────────────────────────────────────────────────

function Stepper({ activeId }) {
  const activeIdx = STEPS.findIndex((s) => s.id === activeId)
  return (
    <div className="flex items-center gap-1.5 px-5 pt-3.5 pb-2 flex-wrap">
      {STEPS.map((s, i) => {
        const done = i < activeIdx
        const active = i === activeIdx
        return (
          <div key={s.id} className="flex items-center gap-1.5">
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : done
                    ? 'text-slate-400'
                    : 'text-slate-600'
              }`}
            >
              {done ? <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> : <Circle className={`w-3.5 h-3.5 ${active ? 'fill-orange-400 text-orange-400' : ''}`} />}
              {s.label}
            </div>
            {i < STEPS.length - 1 && <div className={`w-4 h-px ${done ? 'bg-slate-600' : 'bg-[#2d1b4e]'}`} />}
          </div>
        )
      })}
    </div>
  )
}

function LoadingBlock({ text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  )
}

function ErrorBlock({ text, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <AlertTriangle className="w-7 h-7 text-red-400" />
      <p className="text-sm text-red-400 max-w-sm">{text}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  )
}

function GateScreen({ kind }) {
  const signin = kind === 'signin'
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center px-6">
      <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
        <Lock className="w-6 h-6 text-orange-400" />
      </div>
      <p className="text-sm font-semibold text-slate-200">
        {signin ? 'Sign in to deploy' : 'Read-only role'}
      </p>
      <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
        {signin
          ? 'Your session has expired or you are not signed in. Use the account menu in the top-right of the navbar to sign in, then reopen this wizard.'
          : 'Your account has the viewer role, which can browse the lab but cannot push SentinelOne assets to a console. Ask an admin to upgrade your role to user or admin.'}
      </p>
    </div>
  )
}

// ── Step 1: Configure — connections manager ──────────────────────────────────

// One saved-connection row: a target checkbox, its identity, and per-row actions.
function ConnectionRow({ conn, checked, busy, onToggleTarget, onSetDefault, onEdit, onRemove }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-[#1e1235] last:border-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggleTarget(conn.id)}
        className="accent-orange-500 shrink-0 mt-1"
        aria-label={`Select ${conn.label} as a deploy target`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-100 truncate">{conn.label || hostOf(conn.console_url)}</span>
          {conn.is_default && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2 py-0.5 text-[10px] font-semibold">
              <Star className="w-2.5 h-2.5 fill-orange-400" /> Default
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">{conn.console_url}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            {conn.has_token ? <KeyRound className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3 text-yellow-400" />}
            {conn.has_token ? 'API token stored' : 'no token'}
          </span>
          {conn.sdl_xdr_url && (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-green-400" />
              SDL: <span className="font-mono">{hostOf(conn.sdl_xdr_url)}</span>
            </span>
          )}
          {conn.updated_at && <span className="text-slate-600">Updated {formatTime(conn.updated_at)}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {!conn.is_default && (
            <button onClick={() => onSetDefault(conn.id)} disabled={busy} className="btn-ghost text-[11px] px-2 py-1 disabled:opacity-40">
              <Star className="w-3 h-3" /> Set default
            </button>
          )}
          <button onClick={() => onEdit(conn)} disabled={busy} className="btn-ghost text-[11px] px-2 py-1 disabled:opacity-40">
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button
            onClick={() => onRemove(conn.id)}
            disabled={busy}
            className="btn-ghost text-[11px] px-2 py-1 text-red-400 hover:text-red-300 hover:border-red-500/30 disabled:opacity-40"
          >
            <Unlink className="w-3 h-3" /> Remove
          </button>
        </div>
      </div>
    </div>
  )
}

function ConnectionsManager({
  connections, targets, busyId,
  onToggleTarget, onSetDefault, onEdit, onRemove, onAdd,
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#2d1b4e] bg-white/[0.02] px-3 py-2.5 text-xs text-slate-400 flex items-start gap-2.5">
        <Info className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
        <span>
          Select one or more consoles below as deploy targets — the same SentinelOne assets are pushed to
          every checked target in one run. Add as many connections as you like; no need to disconnect to switch.
        </span>
      </div>

      <div className="rounded-xl border border-[#2d1b4e] overflow-hidden">
        <div className="px-4 py-2.5 bg-[#1a0a2e] border-b border-[#2d1b4e] flex items-center gap-2">
          <Server className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Your SentinelOne consoles</span>
          <span className="text-xs font-mono text-slate-500 ml-auto">{targets.size} of {connections.length} selected</span>
        </div>
        <div>
          {connections.map((conn) => (
            <ConnectionRow
              key={conn.id}
              conn={conn}
              checked={targets.has(conn.id)}
              busy={busyId === conn.id}
              onToggleTarget={onToggleTarget}
              onSetDefault={onSetDefault}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          ))}
        </div>
      </div>

      <button onClick={onAdd} className="btn-ghost text-xs">
        <Plus className="w-3.5 h-3.5" /> Add connection
      </button>
    </div>
  )
}

function ConfigForm({
  isEdit, hasStoredToken,
  label, setLabel,
  consoleUrl, setConsoleUrl,
  apiToken, setApiToken,
  sdlXdrUrl, setSdlXdrUrl,
  makeDefault, setMakeDefault, showMakeDefault,
  saveError, onSubmit,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <form id="deploy-config-form" onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg border border-[#2d1b4e] bg-white/[0.02] p-3 flex gap-2.5">
        <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 leading-relaxed space-y-1.5">
          <p>
            In your SentinelOne console: <strong className="text-slate-300">Settings → Users → Service Users → Create New Service User</strong> (or
            pick an existing one) and give its role these permissions, scoped to your site:
          </p>
          <ul className="space-y-0.5 pl-0.5">
            <li><span className="text-slate-300 font-semibold">STAR Custom Rules</span> — deploy detections</li>
            <li><span className="text-slate-300 font-semibold">Hyperautomation</span> — import &amp; activate workflows</li>
            <li><span className="text-slate-300 font-semibold">SDL Dashboards</span> + <span className="text-slate-300 font-semibold">SDL Configuration Files</span> — deploy dashboards <span className="text-slate-500">(optional)</span></li>
          </ul>
          <p>
            Then copy its API token. <strong className="text-slate-300">One service-user token covers all three</strong> — it also does SDL config, so no
            separate SDL key is needed. The token is stored securely server-side and is never shown back to you or anyone else.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Label <span className="text-slate-600 normal-case font-normal">— optional</span></label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Acme prod · Partner tenant (defaults to the console host)"
          className="w-full rounded-lg bg-[#12081f] border border-[#2d1b4e] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500/50"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Console URL</label>
        <input
          type="url"
          required
          autoFocus
          value={consoleUrl}
          onChange={(e) => setConsoleUrl(e.target.value)}
          placeholder="https://usea1-yourcompany.sentinelone.net"
          className="w-full rounded-lg bg-[#12081f] border border-[#2d1b4e] px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-orange-500/50"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">API Token</label>
        <input
          type="password"
          required={!isEdit || !hasStoredToken}
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          placeholder={isEdit && hasStoredToken ? '•••••••• (leave blank to keep current token)' : 'Paste your S1 API token'}
          className="w-full rounded-lg bg-[#12081f] border border-[#2d1b4e] px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-orange-500/50"
        />
      </div>

      {showMakeDefault && (
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={(e) => setMakeDefault(e.target.checked)}
            className="accent-orange-500"
          />
          Make this the default deploy target
        </label>
      )}

      <div className="collapsible-section">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="collapsible-header w-full text-left"
        >
          <span className="text-xs font-semibold text-slate-300">Advanced — SDL dashboard region (optional)</span>
          {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showAdvanced && (
          <div className="collapsible-body space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              Dashboards deploy with the <span className="text-slate-400">same service-user token</span> — no separate key. We auto-detect your SDL
              region from the Console URL, so leave this blank unless auto-detection fails.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">SDL XDR URL <span className="text-slate-600 normal-case font-normal">— override</span></label>
              <input
                type="url"
                value={sdlXdrUrl}
                onChange={(e) => setSdlXdrUrl(e.target.value)}
                placeholder="auto-detected · e.g. https://xdr.us1.sentinelone.net"
                className="w-full rounded-lg bg-[#12081f] border border-[#2d1b4e] px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-orange-500/50"
              />
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Your SDL/XDR host — the address of your Singularity Data Lake console (e.g. <span className="font-mono">xdr.us1.sentinelone.net</span>),
                also listed under SentinelOne's “Endpoint URLs by Region.”
              </p>
            </div>
          </div>
        )}
      </div>

      {saveError && <p className="text-xs text-red-400">{saveError}</p>}
    </form>
  )
}

// ── Step 2: Validate — one card per selected target ──────────────────────────

function TargetValidateCard({ result }) {
  const caps = result.capabilities || {}
  const site = result.site || {}
  return (
    <div className="rounded-xl border border-[#2d1b4e] overflow-hidden">
      <div className="px-4 py-2.5 bg-[#1a0a2e] border-b border-[#2d1b4e] flex items-center gap-2 flex-wrap">
        {result.loading
          ? <Loader2 className="w-4 h-4 text-orange-400 animate-spin shrink-0" />
          : result.ok
            ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
        <span className="text-sm font-semibold text-slate-100 truncate">{result.label || hostOf(result.console_url)}</span>
        <span className="text-[11px] font-mono text-slate-500 truncate">{hostOf(result.console_url)}</span>
      </div>

      {result.loading ? (
        <div className="px-4 py-4 text-xs text-slate-400 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Validating connection...
        </div>
      ) : result.error ? (
        <div className="px-4 py-3 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{result.error}</p>
        </div>
      ) : (
        <>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs border-b border-[#1e1235]">
            <div>
              <p className="text-slate-500 uppercase tracking-wider mb-0.5">Site</p>
              <p className="text-slate-200 font-mono truncate">{site.name || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wider mb-0.5">Site ID</p>
              <p className="text-slate-200 font-mono truncate">{site.id || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wider mb-0.5">Account ID</p>
              <p className="text-slate-200 font-mono truncate">{site.accountId || '—'}</p>
            </div>
          </div>
          <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {CAPABILITY_ROWS.map((row) => {
              const ok = !!caps[row.key]
              return (
                <span key={row.key} className="flex items-center gap-1.5 text-xs">
                  {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                  <span className={ok ? 'text-slate-200' : 'text-slate-500'}>{row.label}</span>
                </span>
              )
            })}
          </div>
          {Array.isArray(result.messages) && result.messages.length > 0 && (
            <div className="px-4 pb-3 space-y-1">
              {result.messages.map((m, i) => (
                <p key={i} className="text-[11px] text-slate-500 flex items-start gap-1.5">
                  <Info className="w-3 h-3 text-slate-600 shrink-0 mt-0.5" /> {m}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ValidateStepView({ validating, results }) {
  if (!results.length) return <ErrorBlock text="No targets selected to validate." />
  const anyOk = results.some((r) => r.ok)
  const okCount = results.filter((r) => r.ok).length
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#2d1b4e] bg-white/[0.02] px-3 py-2.5 text-xs text-slate-400 flex items-center gap-2.5">
        <Info className="w-3.5 h-3.5 text-orange-400 shrink-0" />
        <span>
          {validating
            ? 'Validating each selected console...'
            : anyOk
              ? `${okCount} of ${results.length} target${results.length === 1 ? '' : 's'} validated — deploy will run against the validated ones.`
              : 'No target validated. Fix the console URL / API token in Configure and retry.'}
        </span>
      </div>
      {results.map((r) => <TargetValidateCard key={r.connection_id} result={r} />)}
    </div>
  )
}

// ── Step 3: Select ───────────────────────────────────────────────────────────

function DetectionChip({ item }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Badge type="severity" value={item.severity} />
      <span className="text-[11px] font-mono text-slate-600">{item.queryType}</span>
    </div>
  )
}

function HaChip({ item }) {
  return <span className="text-[11px] font-mono text-slate-500 shrink-0">{item.connections?.length || 0} connections</span>
}

function DashboardChip({ item }) {
  return <span className="text-[11px] font-mono text-slate-500 shrink-0">{item.tabs} tab{item.tabs === 1 ? '' : 's'}</span>
}

function ItemRow({ group, item, checked, disabled, onToggle }) {
  const id = idFor(group.type, item.key)
  const detail = group.type === 'detection' ? item.description : group.type === 'ha' ? item.detail : item.description
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-[#1e1235] last:border-0 transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.02] cursor-pointer'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onToggle(group, item)}
        className="accent-orange-500 disabled:opacity-40 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200 truncate">{item.name}</p>
        {detail && <p className="text-xs text-slate-500 truncate">{detail}</p>}
      </div>
      {group.type === 'detection' && <DetectionChip item={item} />}
      {group.type === 'ha' && <HaChip item={item} />}
      {group.type === 'dashboard' && <DashboardChip item={item} />}
    </label>
  )
}

function GroupSection({ group, capabilities, selected, onToggleItem, onToggleGroup }) {
  const Icon = GROUP_ICON[group.type]
  const enabled = !!capabilities?.[CAP_KEY[group.type]]
  const itemIds = group.items.map((it) => idFor(group.type, it.key))
  const selectedCount = itemIds.filter((id) => selected.has(id)).length
  const allSelected = itemIds.length > 0 && selectedCount === itemIds.length

  return (
    <div className={`rounded-xl border overflow-hidden ${enabled ? 'border-[#2d1b4e]' : 'border-[#2d1b4e]/50'}`}>
      <div className="px-4 py-3 bg-[#1a0a2e] border-b border-[#2d1b4e] flex items-center gap-3 flex-wrap">
        <Icon className={`w-4 h-4 shrink-0 ${enabled ? 'text-orange-400' : 'text-slate-600'}`} />
        <span className={`text-sm font-semibold ${enabled ? 'text-slate-200' : 'text-slate-500'}`}>{group.label}</span>
        <span className="text-xs font-mono text-slate-500">{selectedCount}/{itemIds.length} selected</span>
        <button
          type="button"
          onClick={() => onToggleGroup(group)}
          disabled={!enabled}
          className="btn-ghost text-xs px-2 py-1 ml-auto disabled:opacity-30"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      {!enabled && (
        <div className="px-4 py-2 bg-yellow-500/5 border-b border-yellow-500/10 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-400/80">
            {group.type === 'dashboard'
              ? 'Set the SDL XDR URL in Configure (or grant your token SDL Dashboards + SDL Configuration Files) to enable dashboards. When multiple targets are selected, every target must support this.'
              : `Not every selected target reported the "${CAP_KEY[group.type]}" capability as available.`}
          </p>
        </div>
      )}
      <div>
        {group.items.map((item) => (
          <ItemRow
            key={item.key}
            group={group}
            item={item}
            checked={selected.has(idFor(group.type, item.key))}
            disabled={!enabled}
            onToggle={onToggleItem}
          />
        ))}
      </div>
    </div>
  )
}

// ── Step 4: Deploy — results grouped per target ──────────────────────────────

function ResultRow({ result }) {
  const item = ITEM_BY_ID[idFor(result.type, result.key)]
  const status = result.status
  const icon = status === 'deployed'
    ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
    : status === 'skipped'
      ? <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
      : <XCircle className="w-4 h-4 text-red-400 shrink-0" />
  const statusClass = status === 'deployed'
    ? 'bg-green-500/15 text-green-400 border border-green-500/30'
    : status === 'skipped'
      ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
      : 'bg-red-500/15 text-red-400 border border-red-500/30'

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b border-[#1e1235] last:border-0">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-200 truncate">{item?.name || result.key}</span>
          <span className={`inline-flex items-center rounded-full font-semibold px-2 py-0.5 text-[11px] shrink-0 ${statusClass}`}>
            {status}
          </span>
        </div>
        {result.id && <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">id: {result.id}</p>}
        {result.message && <p className="text-xs text-slate-500 mt-0.5">{result.message}</p>}
      </div>
    </div>
  )
}

function TargetDeployCard({ target }) {
  const results = target.results || []
  const deployed = results.filter((r) => r.status === 'deployed').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const failed = results.filter((r) => r.status !== 'deployed' && r.status !== 'skipped').length
  return (
    <div className="rounded-xl border border-[#2d1b4e] overflow-hidden">
      <div className="px-4 py-2.5 bg-[#1a0a2e] border-b border-[#2d1b4e] flex items-center gap-2 flex-wrap">
        {target.loading
          ? <Loader2 className="w-4 h-4 text-orange-400 animate-spin shrink-0" />
          : target.error
            ? <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            : <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
        <span className="text-sm font-semibold text-slate-100 truncate">{target.label || hostOf(target.console_url)}</span>
        <span className="text-[11px] font-mono text-slate-500 truncate">{hostOf(target.console_url)}</span>
        {!target.loading && !target.error && (
          <span className="text-[11px] text-slate-500 ml-auto">{deployed} deployed · {skipped} skipped · {failed} failed</span>
        )}
      </div>
      {target.loading ? (
        <div className="px-4 py-4 text-xs text-slate-400 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Deploying...
        </div>
      ) : target.error ? (
        <div className="px-4 py-3 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{target.error}</p>
        </div>
      ) : (
        <div>{results.map((r, i) => <ResultRow key={`${r.type}:${r.key}:${i}`} result={r} />)}</div>
      )}
    </div>
  )
}

function DeployStepView({ deployPhase, targets }) {
  if (!targets.length) return <ErrorBlock text="No deploy results yet." />
  const anyLoading = targets.some((t) => t.loading)
  const totals = targets.reduce((acc, t) => {
    for (const r of t.results || []) {
      if (r.status === 'deployed') acc.deployed++
      else if (r.status === 'skipped') acc.skipped++
      else acc.failed++
    }
    if (t.error) acc.targetErrors++
    return acc
  }, { deployed: 0, skipped: 0, failed: 0, targetErrors: 0 })

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#2d1b4e] bg-white/[0.02] px-3 py-2.5 text-xs text-slate-400 flex items-center gap-2.5">
        <Info className="w-3.5 h-3.5 text-orange-400 shrink-0" />
        <span>
          {anyLoading
            ? (deployPhase || 'Deploying...')
            : `Across ${targets.length} target${targets.length === 1 ? '' : 's'}: ${totals.deployed} deployed · ${totals.skipped} skipped · ${totals.failed} failed${totals.targetErrors ? ` · ${totals.targetErrors} target error${totals.targetErrors === 1 ? '' : 's'}` : ''}`}
        </span>
      </div>
      {targets.map((t) => <TargetDeployCard key={t.connection_id} target={t} />)}
      <p className="text-xs text-slate-500 leading-relaxed">
        Deployed detections are enabled (Active) immediately. Hyperautomation workflows are imported and
        activated (Active + visible in your console). Dashboards are written to your SDL config store.
      </p>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function DeployKnowledgeObjects() {
  const [open, setOpen] = useState(false)
  const [gate, setGate] = useState('none') // none | signin | readonly

  const [step, setStep] = useState('configure')

  // Configure
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState('')
  const [config, setConfig] = useState(null) // {configured, connections:[...], default_id}
  const [targets, setTargets] = useState(() => new Set()) // connection ids chosen to deploy to
  const [busyId, setBusyId] = useState(null) // a connection id undergoing set-default / remove
  const [editingId, setEditingId] = useState(null) // null=closed | 'new' | <connection id>
  const [labelInput, setLabelInput] = useState('')
  const [consoleUrlInput, setConsoleUrlInput] = useState('')
  const [apiTokenInput, setApiTokenInput] = useState('')
  const [sdlXdrUrlInput, setSdlXdrUrlInput] = useState('')
  const [makeDefaultInput, setMakeDefaultInput] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  // Validate — one entry per selected target
  const [validating, setValidating] = useState(false)
  const [validateResults, setValidateResults] = useState([])

  // Select
  const [selected, setSelected] = useState(() => new Set())

  // Deploy — one entry per validated target
  const [deploying, setDeploying] = useState(false)
  const [deployPhase, setDeployPhase] = useState('')
  const [deployTargets, setDeployTargets] = useState([])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    setGate('none')
    setStep('configure')
    setConfig(null)
    setConfigError('')
    setTargets(new Set())
    setBusyId(null)
    resetForm()
    setValidateResults([])
    setValidating(false)
    setSelected(new Set())
    setDeployTargets([])
    initGate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function resetForm() {
    setEditingId(null)
    setLabelInput('')
    setConsoleUrlInput('')
    setApiTokenInput('')
    setSdlXdrUrlInput('')
    setMakeDefaultInput(false)
    setSaveError('')
  }

  // Gate on the caller's ACTUAL role up front (not by inferring from a stray 403):
  // logged-out → sign in; viewer → read-only; admin AND user → proceed. Deploy is
  // NOT admin-only — any non-viewer can push to their own console(s).
  async function initGate() {
    setConfigLoading(true)
    try {
      const meRes = await fetch('/api/auth/me')
      if (meRes.status === 401) { setGate('signin'); setConfigLoading(false); return }
      const me = await meRes.json().catch(() => ({}))
      if (me?.role === 'viewer') { setGate('readonly'); setConfigLoading(false); return }
    } catch {
      // fall through — fetchConfig will surface any reachability error
    }
    fetchConfig()
  }

  // Apply a fresh {configured, connections, default_id} config: keep any still-valid
  // target selections, and default-select the default connection when nothing is picked.
  function applyConfig(data) {
    setConfig(data)
    const ids = new Set((data.connections || []).map((c) => c.id))
    setTargets((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)))
      if (next.size === 0 && data.default_id && ids.has(data.default_id)) next.add(data.default_id)
      return next
    })
  }

  async function fetchConfig() {
    setConfigLoading(true)
    setConfigError('')
    try {
      const res = await fetch('/api/deploy/config')
      if (res.status === 401) { setGate('signin'); return }
      if (res.status === 403) { setConfigError('Your role cannot configure deployment.'); return }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setConfigError(data.error || data.detail || `Failed to load configuration (HTTP ${res.status})`)
        return
      }
      applyConfig(data)
      // No connections yet → open the add form straight away.
      if (!(data.connections || []).length) setEditingId('new')
      else resetForm()
    } catch {
      setConfigError('Could not reach backend.')
    } finally {
      setConfigLoading(false)
    }
  }

  function openAdd() {
    resetForm()
    setEditingId('new')
  }

  function openEdit(conn) {
    setEditingId(conn.id)
    setLabelInput(conn.label || '')
    setConsoleUrlInput(conn.console_url || '')
    setApiTokenInput('')
    setSdlXdrUrlInput(conn.sdl_xdr_url || '')
    setMakeDefaultInput(false)
    setSaveError('')
  }

  async function handleSaveConfig(e) {
    e.preventDefault()
    setSaveError('')
    const url = consoleUrlInput.trim()
    if (!url) { setSaveError('Console URL is required.'); return }
    const token = apiTokenInput.trim()
    const isEdit = editingId && editingId !== 'new'
    const editingConn = isEdit ? (config?.connections || []).find((c) => c.id === editingId) : null
    if (!token && !(isEdit && editingConn?.has_token)) {
      setSaveError('API token is required.')
      return
    }
    setSaving(true)
    try {
      const body = {
        console_url: url,
        api_token: token || (isEdit ? null : undefined),
        sdl_xdr_url: sdlXdrUrlInput.trim(), // '' clears the override
        label: labelInput.trim() || null,
      }
      if (isEdit) body.id = editingId
      if (makeDefaultInput) body.make_default = true
      const res = await fetch('/api/deploy/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401) { setGate('signin'); return }
      const rawText = await res.text()
      let data = {}
      try { data = JSON.parse(rawText) } catch { /* non-JSON body */ }
      if (!res.ok) {
        setSaveError(describeHttpError(res.status, data, rawText, 'Save'))
        return
      }
      // New connections auto-select as a target so the user can deploy immediately.
      const before = new Set((config?.connections || []).map((c) => c.id))
      applyConfig(data)
      if (!isEdit) {
        const added = (data.connections || []).find((c) => !before.has(c.id))
        if (added) setTargets((prev) => new Set([...prev, added.id]))
      }
      resetForm()
    } catch {
      setSaveError('Could not reach backend.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSetDefault(id) {
    setBusyId(id)
    try {
      const res = await fetch('/api/deploy/config/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.status === 401) { setGate('signin'); return }
      const data = await res.json().catch(() => ({}))
      if (res.ok) applyConfig(data)
    } catch {
      // best-effort — next load reflects real state
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemoveConnection(id) {
    const conn = (config?.connections || []).find((c) => c.id === id)
    const name = conn?.label || hostOf(conn?.console_url) || 'this connection'
    if (!window.confirm(`Remove ${name}? You will need to re-enter its API token to deploy to it again.`)) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/deploy/config?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (res.status === 401) { setGate('signin'); return }
      const data = await res.json().catch(() => ({}))
      setTargets((prev) => { const next = new Set(prev); next.delete(id); return next })
      if (res.ok && data.connections) {
        applyConfig(data)
        if (!(data.connections || []).length) setEditingId('new')
      }
    } catch {
      // best-effort
    } finally {
      setBusyId(null)
    }
  }

  function toggleTarget(id) {
    setTargets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Validate every selected target in parallel, updating each card as it resolves.
  async function runValidateTargets() {
    const conns = (config?.connections || []).filter((c) => targets.has(c.id))
    if (!conns.length) return
    setStep('validate')
    setValidating(true)
    setValidateResults(conns.map((c) => ({
      connection_id: c.id, label: c.label, console_url: c.console_url,
      loading: true, error: '', ok: false, capabilities: {}, site: {}, messages: [],
    })))
    await Promise.all(conns.map(async (c) => {
      try {
        const res = await fetch('/api/deploy/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection_id: c.id }),
        })
        if (res.status === 401) { setGate('signin'); return }
        const rawText = await res.text()
        let data = {}
        try { data = JSON.parse(rawText) } catch { /* non-JSON body */ }
        setValidateResults((prev) => prev.map((r) => r.connection_id !== c.id ? r : (
          res.ok
            ? { ...r, loading: false, ok: !!data.ok, site: data.site || {}, capabilities: data.capabilities || {}, messages: data.messages || [] }
            : { ...r, loading: false, ok: false, error: describeHttpError(res.status, data, rawText, 'Validation') }
        )))
      } catch {
        setValidateResults((prev) => prev.map((r) => r.connection_id !== c.id
          ? r : { ...r, loading: false, ok: false, error: 'Could not reach backend.' }))
      }
    }))
    setValidating(false)
  }

  // Preselect every deployable item whose type is supported by ALL validated targets.
  function goToSelect() {
    const okCaps = validateResults.filter((r) => r.ok).map((r) => r.capabilities)
    const caps = intersectCaps(okCaps)
    const next = new Set()
    for (const group of KNOWLEDGE_OBJECT_GROUPS) {
      if (!caps[CAP_KEY[group.type]]) continue
      for (const item of group.items) next.add(idFor(group.type, item.key))
    }
    setSelected(next)
    setStep('select')
  }

  function handleToggleItem(group, item) {
    const id = idFor(group.type, item.key)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleToggleGroup(group) {
    const itemIds = group.items.map((it) => idFor(group.type, it.key))
    setSelected((prev) => {
      const allSelected = itemIds.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allSelected) itemIds.forEach((id) => next.delete(id))
      else itemIds.forEach((id) => next.add(id))
      return next
    })
  }

  // UTF-8-safe base64 of a JSON payload. We send artifacts base64-encoded so the
  // raw SQLi/XSS/traversal/injection signatures inside detection rules + workflows
  // don't trip the Cloudflare zone's WAF managed rules on the deploy POST.
  function b64Payload(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj))
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
  }

  async function buildDeployObjects() {
    const objects = []
    for (const group of KNOWLEDGE_OBJECT_GROUPS) {
      for (const item of group.items) {
        if (!selected.has(idFor(group.type, item.key))) continue
        let payload
        if (group.type === 'ha') payload = await loadHaWorkflowJson(item.key)
        else if (group.type === 'detection') payload = item.rule
        else if (group.type === 'dashboard') payload = item.dashboard
        else continue
        objects.push({ type: group.type, key: item.key, payload_b64: b64Payload(payload) })
      }
    }
    return objects
  }

  // Fan out the deploy: one /api/deploy/run per validated target, in parallel.
  async function handleDeploy() {
    const okTargets = validateResults.filter((r) => r.ok)
    if (!okTargets.length) return
    setStep('deploy')
    setDeploying(true)
    setDeployPhase('Preparing definitions...')
    setDeployTargets(okTargets.map((t) => ({
      connection_id: t.connection_id, label: t.label, console_url: t.console_url,
      loading: true, error: '', results: null,
    })))
    try {
      const objects = await buildDeployObjects()
      setDeployPhase(`Deploying ${objects.length} object${objects.length === 1 ? '' : 's'} to ${okTargets.length} target${okTargets.length === 1 ? '' : 's'}...`)
      await Promise.all(okTargets.map(async (t) => {
        try {
          const res = await fetch('/api/deploy/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objects, connection_id: t.connection_id }),
          })
          if (res.status === 401) { setGate('signin'); return }
          const rawText = await res.text()
          let data = {}
          try { data = JSON.parse(rawText) } catch { /* non-JSON body (edge / Access / proxy) */ }
          setDeployTargets((prev) => prev.map((d) => d.connection_id !== t.connection_id ? d : (
            res.ok
              ? { ...d, loading: false, results: data.results || [], site: data.site }
              : { ...d, loading: false, error: describeHttpError(res.status, data, rawText, 'Deploy') }
          )))
        } catch {
          setDeployTargets((prev) => prev.map((d) => d.connection_id !== t.connection_id
            ? d : { ...d, loading: false, error: 'Could not reach the backend — check your connection and try again.' }))
        }
      }))
    } finally {
      setDeploying(false)
      setDeployPhase('')
    }
  }

  function requestClose() { setOpen(false) }

  const connections = config?.connections || []
  const showConfigForm = editingId !== null
  const editingConn = editingId && editingId !== 'new' ? connections.find((c) => c.id === editingId) : null
  const okValidatedCount = validateResults.filter((r) => r.ok).length
  const anyCapsAvailable = CAP_KEYS.some((k) => intersectCaps(validateResults.filter((r) => r.ok).map((r) => r.capabilities))[k])

  return (
    <>
      <div className="rounded-xl border border-orange-500/25 bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
            <Rocket className="w-5 h-5 text-orange-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-100">Add detections, workflows, and dashboards to console</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Deploy the lab's SentinelOne assets to one or more of your own consoles.
            </p>
          </div>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary shrink-0">
          <Rocket className="w-4 h-4" />
          Add to console
        </button>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={requestClose}>
          <div
            className="modal-content"
            style={{ maxWidth: '720px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deploy-wizard-title"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2d1b4e]">
              <h3 id="deploy-wizard-title" className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Rocket className="w-4 h-4 text-orange-400" /> Deploy SentinelOne assets
              </h3>
              <button
                onClick={requestClose}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Close deploy wizard"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {gate === 'none' && <Stepper activeId={step} />}

            <div className="overflow-y-auto p-5 flex-1">
              {gate !== 'none' && <GateScreen kind={gate} />}

              {gate === 'none' && step === 'configure' && (
                configLoading ? <LoadingBlock text="Loading configuration..." /> :
                configError ? <ErrorBlock text={configError} onRetry={fetchConfig} /> :
                showConfigForm ? (
                  <ConfigForm
                    isEdit={!!editingConn}
                    hasStoredToken={!!editingConn?.has_token}
                    label={labelInput} setLabel={setLabelInput}
                    consoleUrl={consoleUrlInput} setConsoleUrl={setConsoleUrlInput}
                    apiToken={apiTokenInput} setApiToken={setApiTokenInput}
                    sdlXdrUrl={sdlXdrUrlInput} setSdlXdrUrl={setSdlXdrUrlInput}
                    makeDefault={makeDefaultInput} setMakeDefault={setMakeDefaultInput}
                    showMakeDefault={connections.length > 0}
                    saveError={saveError}
                    onSubmit={handleSaveConfig}
                  />
                ) : (
                  <ConnectionsManager
                    connections={connections}
                    targets={targets}
                    busyId={busyId}
                    onToggleTarget={toggleTarget}
                    onSetDefault={handleSetDefault}
                    onEdit={openEdit}
                    onRemove={handleRemoveConnection}
                    onAdd={openAdd}
                  />
                )
              )}

              {gate === 'none' && step === 'validate' && (
                <ValidateStepView validating={validating} results={validateResults} />
              )}

              {gate === 'none' && step === 'select' && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[#2d1b4e] bg-white/[0.02] px-3 py-2.5 text-xs text-slate-400 flex items-start gap-2.5">
                    <Info className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                    <span>
                      Selected assets deploy to all {okValidatedCount} validated target{okValidatedCount === 1 ? '' : 's'}. Detections are
                      enabled (Active) immediately, and Hyperautomation workflows are imported and activated.
                    </span>
                  </div>
                  {KNOWLEDGE_OBJECT_GROUPS.map((group) => (
                    <GroupSection
                      key={group.type}
                      group={group}
                      capabilities={intersectCaps(validateResults.filter((r) => r.ok).map((r) => r.capabilities))}
                      selected={selected}
                      onToggleItem={handleToggleItem}
                      onToggleGroup={handleToggleGroup}
                    />
                  ))}
                </div>
              )}

              {gate === 'none' && step === 'deploy' && (
                <DeployStepView deployPhase={deployPhase} targets={deployTargets} />
              )}
            </div>

            <div className="px-5 py-3 border-t border-[#2d1b4e] flex items-center justify-between gap-3">
              {gate !== 'none' && (
                <button onClick={requestClose} className="btn-ghost text-xs ml-auto">Close</button>
              )}

              {gate === 'none' && step === 'configure' && showConfigForm && (
                <>
                  {connections.length > 0 && (
                    <button type="button" onClick={resetForm} className="btn-ghost text-xs">
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    form="deploy-config-form"
                    disabled={saving}
                    className="btn-primary text-xs ml-auto disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {saving ? 'Saving...' : editingConn ? 'Save changes' : 'Add connection'}
                  </button>
                </>
              )}

              {gate === 'none' && step === 'configure' && !showConfigForm && (
                <button
                  onClick={runValidateTargets}
                  disabled={targets.size === 0}
                  className="btn-primary text-xs ml-auto disabled:opacity-40"
                >
                  <ServerCog className="w-3.5 h-3.5" /> Validate {targets.size} target{targets.size === 1 ? '' : 's'}
                </button>
              )}

              {gate === 'none' && step === 'validate' && (
                <>
                  <button onClick={() => setStep('configure')} className="btn-ghost text-xs">Back</button>
                  <div className="flex items-center gap-2 ml-auto">
                    <button onClick={runValidateTargets} disabled={validating} className="btn-ghost text-xs disabled:opacity-40">
                      <RefreshCw className={`w-3.5 h-3.5 ${validating ? 'animate-spin' : ''}`} /> Retry
                    </button>
                    <button
                      onClick={goToSelect}
                      disabled={validating || okValidatedCount === 0 || !anyCapsAvailable}
                      className="btn-primary text-xs disabled:opacity-40"
                    >
                      Continue to Select
                    </button>
                  </div>
                </>
              )}

              {gate === 'none' && step === 'select' && (
                <>
                  <button onClick={() => setStep('validate')} className="btn-ghost text-xs">Back</button>
                  <button
                    onClick={handleDeploy}
                    disabled={selected.size === 0}
                    className="btn-primary text-xs ml-auto disabled:opacity-40"
                  >
                    <Rocket className="w-3.5 h-3.5" /> Deploy {selected.size} object{selected.size === 1 ? '' : 's'} to {okValidatedCount} target{okValidatedCount === 1 ? '' : 's'}
                  </button>
                </>
              )}

              {gate === 'none' && step === 'deploy' && (
                deploying ? (
                  <span className="text-xs text-slate-500 flex items-center gap-2 ml-auto">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Deploying...
                  </span>
                ) : (
                  <>
                    <button onClick={() => { setStep('select'); setDeployTargets([]) }} className="btn-ghost text-xs">
                      Deploy more
                    </button>
                    <button onClick={requestClose} className="btn-primary text-xs ml-auto">Done</button>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
