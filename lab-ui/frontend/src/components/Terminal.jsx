import { useEffect, useRef, useState } from 'react'
import { Copy, Check, Terminal as TerminalIcon } from 'lucide-react'

function classifyLine(line) {
  if (!line) return 'text-slate-500'
  const l = line.toUpperCase()
  if (l.includes('403') || l.includes('BLOCKED') || l.includes('✔') || l.includes('[BLOCK]') || l.includes('PASS'))
    return 'text-green-400'
  if (l.includes('ERROR') || l.includes('FAILED') || l.includes('EXCEPTION'))
    return 'text-red-400'
  if (l.includes('200') || l.includes('ALLOWED') || l.includes('✖') || l.includes('[ALLOW]') || l.includes('BYPASS'))
    return 'text-yellow-400'
  if (l.includes('RUNNING') || l.includes('►') || l.includes('STARTING') || l.includes('[*]') || l.includes('SENDING') || l.includes('SCENARIO'))
    return 'text-cyan-400'
  if (l.includes('WARNING') || l.includes('WARN'))
    return 'text-yellow-500'
  if (l.startsWith('[+]') || l.startsWith('✓'))
    return 'text-green-400'
  if (l.startsWith('[-]') || l.startsWith('✗'))
    return 'text-red-400'
  return 'text-slate-300'
}

export default function Terminal({ lines = [], isRunning = false, title = 'Terminal' }) {
  const bottomRef = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  const handleCopy = () => {
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-xl overflow-hidden border border-[#1e1235]" style={{ fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace' }}>
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f0f0f] border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <TerminalIcon className="w-3 h-3" />
            <span>{title}</span>
          </div>
          {isRunning && (
            <div className="flex items-center gap-1 text-cyan-400 text-xs">
              <span className="inline-block w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
              running
            </div>
          )}
        </div>
        <button
          onClick={handleCopy}
          disabled={lines.length === 0}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {copied ? (
            <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copied</span></>
          ) : (
            <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>
          )}
        </button>
      </div>

      {/* Terminal body */}
      <div
        className="terminal-scroll overflow-y-auto overflow-x-auto p-4 text-sm leading-relaxed"
        style={{ background: '#0a0a0a', minHeight: '280px', maxHeight: '480px' }}
      >
        {lines.length === 0 ? (
          <div className="flex items-center gap-2 text-slate-600 text-xs">
            <span className="text-slate-700">$</span>
            <span>Waiting for attack to start...</span>
            {isRunning && <span className="inline-block w-2 h-3.5 bg-slate-500 animate-[blink_1s_step-end_infinite]" />}
          </div>
        ) : (
          <>
            {lines.map((line, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap break-all text-xs leading-5 ${classifyLine(line)}`}
              >
                {line || '\u00A0'}
              </div>
            ))}
          </>
        )}
        {isRunning && lines.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-slate-600 text-xs">$</span>
            <span
              className="inline-block w-2 h-3.5 bg-green-400/70"
              style={{ animation: 'blink 1s step-end infinite' }}
            />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
