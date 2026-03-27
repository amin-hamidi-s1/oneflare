import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { BookOpen, Play, ShieldCheck, Target, Zap, Clock } from 'lucide-react'
import ScenarioCard from '../components/ScenarioCard.jsx'
import { SCENARIOS } from '../data/scenarios.js'

function getRunHistory() {
  try {
    return JSON.parse(localStorage.getItem('oneflare_run_history') || '[]')
  } catch {
    return []
  }
}

function formatRelativeTime(isoString) {
  if (!isoString) return 'Never'
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(isoString).toLocaleDateString()
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])

  useEffect(() => {
    setHistory(getRunHistory())
  }, [])

  const today = new Date().toDateString()
  const runsToday = history.filter(r => new Date(r.timestamp).toDateString() === today).length
  const lastRun = history[history.length - 1]?.timestamp

  const categories = [...new Set(SCENARIOS.map(s => s.category))].length

  return (
    <div className="page-enter space-y-10">
      {/* Hero */}
      <section className="relative rounded-2xl overflow-hidden" style={{ minHeight: '320px' }}>
        {/* Background */}
        <div className="absolute inset-0 hero-gradient" />
        {/* Orange glow top-right */}
        <div className="orange-blob" style={{ top: '-80px', right: '-60px', opacity: 0.8 }} />
        {/* Purple glow bottom-left */}
        <div className="purple-blob" style={{ bottom: '-120px', left: '-80px', opacity: 0.7 }} />
        {/* Circuit pattern overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23a855f7' stroke-width='0.5' opacity='0.2'%3E%3Crect x='5' y='5' width='8' height='8'/%3E%3Crect x='25' y='5' width='8' height='8'/%3E%3Crect x='45' y='5' width='8' height='8'/%3E%3Crect x='5' y='25' width='8' height='8'/%3E%3Crect x='25' y='25' width='8' height='8'/%3E%3Crect x='45' y='25' width='8' height='8'/%3E%3Crect x='5' y='45' width='8' height='8'/%3E%3Crect x='25' y='45' width='8' height='8'/%3E%3Crect x='45' y='45' width='8' height='8'/%3E%3Cline x1='13' y1='9' x2='25' y2='9'/%3E%3Cline x1='33' y1='9' x2='45' y2='9'/%3E%3Cline x1='13' y1='29' x2='25' y2='29'/%3E%3Cline x1='33' y1='29' x2='45' y2='29'/%3E%3Cline x1='9' y1='13' x2='9' y2='25'/%3E%3Cline x1='9' y1='33' x2='9' y2='45'/%3E%3Cline x1='29' y1='13' x2='29' y2='25'/%3E%3Cline x1='29' y1='33' x2='29' y2='45'/%3E%3Ccircle cx='13' cy='9' r='1' fill='%23f38020'/%3E%3Ccircle cx='33' cy='9' r='1' fill='%23a855f7'/%3E%3Ccircle cx='9' cy='29' r='1' fill='%23a855f7'/%3E%3Ccircle cx='29' cy='29' r='1' fill='%23f38020'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
            opacity: 0.06,
          }}
        />

        {/* Content */}
        <div className="relative z-10 p-8 md:p-12 flex flex-col gap-6" style={{ minHeight: '320px' }}>
          {/* Brand badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase border border-orange-500/30 bg-orange-500/10 text-orange-400">
              CLOUDFLARE
            </span>
            <span className="text-slate-500">+</span>
            <span className="px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase border border-purple-500/30 bg-purple-500/10 text-purple-400">
              SENTINELONE
            </span>
          </div>

          {/* Headline */}
          <div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none mb-3">
              <span
                style={{
                  background: 'linear-gradient(135deg, #f38020 0%, #fbbf24 40%, #a855f7 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                OneFlare
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-300 font-medium max-w-xl leading-relaxed">
              Cloudflare + SentinelOne Attack Simulation Lab
            </p>
            <p className="text-sm text-slate-400 mt-2 max-w-lg">
              Browse, understand, and trigger real attack scenarios against your Cloudflare-protected lab environment. Watch the WAF, Gateway, and Access controls respond in real time.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                document.getElementById('scenarios-section')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="btn-orange"
            >
              <BookOpen className="w-4 h-4" />
              Browse Scenarios
            </button>
            <button
              onClick={() => navigate('/scenarios/sqli')}
              className="btn-purple-outline"
            >
              <Play className="w-4 h-4" />
              Run All Scenarios
            </button>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: BookOpen,
            value: SCENARIOS.length,
            label: 'Scenarios',
            color: 'text-orange-400',
            iconBg: 'bg-orange-500/10',
          },
          {
            icon: Target,
            value: categories,
            label: 'Attack Categories',
            color: 'text-purple-400',
            iconBg: 'bg-purple-500/10',
          },
          {
            icon: Zap,
            value: runsToday,
            label: 'Runs Today',
            color: 'text-blue-400',
            iconBg: 'bg-blue-500/10',
          },
          {
            icon: Clock,
            value: formatRelativeTime(lastRun),
            label: 'Last Run',
            color: 'text-green-400',
            iconBg: 'bg-green-500/10',
            smallValue: true,
          },
        ].map(({ icon: Icon, value, label, color, iconBg, smallValue }) => (
          <div key={label} className="stat-card p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <div className={`font-bold font-mono ${smallValue ? 'text-lg' : 'text-2xl'} ${color}`}>
                {value}
              </div>
              <div className="text-xs text-slate-400">{label}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Scenario grid */}
      <section id="scenarios-section">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Attack Scenarios</h2>
            <p className="text-sm text-slate-400 mt-0.5">Select a scenario to explore its mechanics, detection logic, and response playbook</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono border border-slate-700/50 rounded-full px-3 py-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            {SCENARIOS.length} total
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SCENARIOS.map(scenario => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </div>
      </section>
    </div>
  )
}
