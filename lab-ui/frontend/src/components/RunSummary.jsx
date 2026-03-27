import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'

function parseStats(lines) {
  let blocked = 0
  let passed = 0

  for (const line of lines) {
    const l = line.toUpperCase()
    if (l.includes('403') || l.includes('BLOCKED') || l.includes('[BLOCK]')) blocked++
    if (l.includes('200') || l.includes('ALLOWED') || l.includes('[ALLOW]') || l.includes('BYPASS')) passed++
  }

  return { blocked, passed }
}

export default function RunSummary({ lines = [], exitCode, duration, scenario }) {
  const { blocked, passed } = parseStats(lines)
  const success = exitCode === 0
  const total = blocked + passed

  return (
    <div className={`
      rounded-xl border p-5 mt-4 animate-[slideUp_0.3s_ease-out]
      ${success
        ? 'bg-green-500/5 border-green-500/20'
        : 'bg-red-500/5 border-red-500/20'
      }
    `}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {success ? (
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
        )}
        <div>
          <h4 className="text-sm font-semibold text-slate-100">
            {success ? 'Attack completed' : 'Attack exited with error'}
          </h4>
          <p className="text-xs text-slate-400 font-mono">
            {scenario} — exit code {exitCode}
          </p>
        </div>
        {duration && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5" />
            {duration}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
          <div className="text-2xl font-bold font-mono text-slate-100">{total || lines.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">Total Requests</div>
        </div>
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
          <div className="text-2xl font-bold font-mono text-green-400">{blocked}</div>
          <div className="text-xs text-green-400/70 mt-0.5">Blocked (403)</div>
        </div>
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-center">
          <div className="text-2xl font-bold font-mono text-yellow-400">{passed}</div>
          <div className="text-xs text-yellow-400/70 mt-0.5">Passed (200)</div>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Block rate</span>
            <span className="font-mono text-green-400">{Math.round((blocked / total) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-700"
              style={{ width: `${Math.round((blocked / total) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
