import { useState, useEffect } from 'react'
import { History as HistoryIcon, Trash2, Eye, X, Clock, CheckCircle, XCircle } from 'lucide-react'
import Badge from '../components/Badge.jsx'
import { SCENARIOS } from '../data/scenarios.js'

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('oneflare_run_history') || '[]').reverse()
  } catch {
    return []
  }
}

function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function getScenario(id) {
  return SCENARIOS.find(s => s.id === id)
}

export default function History() {
  const [history, setHistory] = useState([])
  const [viewEntry, setViewEntry] = useState(null)

  useEffect(() => {
    setHistory(getHistory())
  }, [])

  function clearHistory() {
    if (confirm('Clear all run history?')) {
      localStorage.removeItem('oneflare_run_history')
      setHistory([])
    }
  }

  const scenario = viewEntry ? getScenario(viewEntry.scenario) : null

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Run History</h1>
          <p className="text-sm text-slate-400 mt-0.5">All past attack scenario runs — stored in your browser</p>
        </div>
        {history.length > 0 && (
          <button onClick={clearHistory} className="btn-ghost text-red-400 hover:text-red-300 hover:border-red-500/30">
            <Trash2 className="w-4 h-4" />
            Clear History
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="rounded-xl border border-[#2d1b4e] bg-[#1a0a2e] p-16 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <HistoryIcon className="w-7 h-7 text-slate-500" />
          </div>
          <div className="text-center">
            <p className="text-slate-300 font-medium">No runs yet</p>
            <p className="text-sm text-slate-500 mt-1">Run an attack from the Scenario Detail page to see history here.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[#2d1b4e] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-3 bg-[#1a0a2e] border-b border-[#2d1b4e] text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>#</span>
            <span>Scenario</span>
            <span>Timestamp</span>
            <span>Status</span>
            <span className="hidden sm:block">Lines</span>
            <span>Log</span>
          </div>

          {history.map((entry, i) => {
            const sc = getScenario(entry.scenario)
            const success = entry.exitCode === 0
            return (
              <div
                key={entry.id || i}
                className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-3.5 border-b border-[#1e1235] last:border-0 hover:bg-white/[0.02] transition-colors items-center"
              >
                <span className="text-xs font-mono text-slate-600">{history.length - i}</span>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-200">{entry.title}</span>
                    {sc && <Badge type="category" value={sc.category} />}
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{entry.scenario}</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono whitespace-nowrap">
                  <Clock className="w-3 h-3 text-slate-600" />
                  {formatTime(entry.timestamp)}
                </div>

                <div>
                  {success ? (
                    <div className="flex items-center gap-1 text-green-400 text-xs">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Done</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-400 text-xs">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Error</span>
                    </div>
                  )}
                </div>

                <span className="hidden sm:block text-xs font-mono text-slate-500">
                  {entry.lines?.length ?? 0}
                </span>

                <button
                  onClick={() => setViewEntry(entry)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-orange-400 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">View</span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Log modal */}
      {viewEntry && (
        <div className="modal-backdrop" onClick={() => setViewEntry(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2d1b4e]">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{viewEntry.title}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{formatTime(viewEntry.timestamp)}</p>
              </div>
              <button onClick={() => setViewEntry(null)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Log content */}
            <div
              className="terminal-scroll overflow-y-auto p-4 flex-1"
              style={{ background: '#0a0a0a', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}
            >
              {viewEntry.lines?.map((line, i) => (
                <div key={i} className="text-slate-300 leading-5 whitespace-pre-wrap break-all">
                  {line || '\u00A0'}
                </div>
              ))}
              {!viewEntry.lines?.length && (
                <span className="text-slate-600">No output recorded.</span>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[#2d1b4e] flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                {viewEntry.lines?.length ?? 0} lines — exit code {viewEntry.exitCode}
              </span>
              <button
                onClick={() => {
                  const text = viewEntry.lines?.join('\n') || ''
                  navigator.clipboard.writeText(text)
                }}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Copy all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
