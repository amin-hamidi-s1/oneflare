import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Zap, Target, AlertTriangle } from 'lucide-react'
import ScenarioCard from '../components/ScenarioCard.jsx'
import { SCENARIOS } from '../data/scenarios.js'

// Industry campaign → badge label
function getCampaignBadge(c) {
  if (c.key === 'ctf') {
    const phases = c.phases?.length || 4
    return { text: `CTF · ${phases} BOXES`, className: 'border-[#b22222]/40 bg-[#7c2d12]/10 text-[#e57373]' }
  }
  const phases = c.phases?.length || c.num_phases || 5
  return { text: `LIVE DRIP · ${phases} PHASES`, className: 'border-orange-500/30 bg-orange-500/10 text-orange-400' }
}

// Campaign card for the Campaigns section — wide banner style
function CampaignCard({ campaign, onOpen }) {
  const badge = getCampaignBadge(campaign)
  const isCTF = campaign.key === 'ctf'
  const accentColor = isCTF ? '#b22222' : '#f38020'
  const borderHover = isCTF
    ? 'hover:border-[#b22222]/50 hover:shadow-[0_0_0_1px_rgba(178,34,34,0.15),0_4px_24px_rgba(178,34,34,0.12)]'
    : 'hover:border-orange-500/40 hover:shadow-[0_0_0_1px_rgba(243,128,32,0.15),0_4px_24px_rgba(243,128,32,0.12)]'

  return (
    <div
      className={`
        rounded-xl border border-[#2d1b4e] bg-[#1a0a2e] p-5 flex gap-4 items-start
        transition-all duration-200 hover:-translate-y-px ${borderHover}
      `}
    >
      {/* Icon */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border"
        style={{ backgroundColor: `${accentColor}14`, borderColor: `${accentColor}30` }}
      >
        {campaign.icon || '🎯'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3 flex-wrap mb-1">
          <span
            className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${badge.className}`}
          >
            {badge.text}
          </span>
          {campaign.campaign && (
            <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
              {campaign.campaign}
            </span>
          )}
        </div>
        <h3 className="text-base font-bold text-slate-100 leading-snug mb-1">
          {campaign.name}
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">
          {campaign.description}
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={() => onOpen(campaign)}
        className={`
          shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
          border hover:-translate-y-px
          ${isCTF
            ? 'border-[#b22222]/40 text-[#e57373] bg-[#7c2d12]/10 hover:bg-[#7c2d12]/20'
            : 'border-orange-500/40 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20'
          }
        `}
        aria-label={`Open ${campaign.name} full console`}
      >
        Open Full Console
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function SectionDivider({ label, accent = false }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`text-[11px] font-mono font-bold uppercase tracking-widest shrink-0 ${
          accent ? 'text-purple-400' : 'text-slate-500'
        }`}
      >
        {label}
      </span>
      <div className={`flex-1 h-px ${accent ? 'bg-purple-500/20' : 'bg-slate-800'}`} />
    </div>
  )
}

export default function Scenarios() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)

  useEffect(() => {
    fetch('/api/campaigns')
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data)
          ? data
          : Object.entries(data || {})
              .filter(([k]) => k !== '_error')
              .map(([key, v]) => ({ key, ...v }))
        setCampaigns(arr)
      })
      .catch(() => setCampaigns([]))
      .finally(() => setLoadingCampaigns(false))
  }, [])

  function handleOpenCampaign(campaign) {
    if (campaign.key === 'ctf') {
      navigate('/threatops?tab=ctf')
    } else {
      navigate(`/threatops?tab=industry&campaign=${campaign.key}`)
    }
  }

  return (
    <div className="page-enter space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Attack Scenarios</h1>
        <p className="text-sm text-slate-400 mt-1">
          Single-technique quick runs and full multi-phase adversary campaigns — choose your depth.
        </p>
      </div>

      {/* Section A — Quick Scenarios */}
      <section className="space-y-4">
        <SectionDivider label="Quick Scenarios · single-technique attacks" />
        <p className="text-xs text-slate-500 -mt-1">
          Focused single-technique attacks with a live WebSocket terminal. Pick one, hit Run, watch the WAF respond.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SCENARIOS.map(scenario => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </div>
      </section>

      {/* Section B — Campaigns */}
      <section className="space-y-4">
        <SectionDivider label="Campaigns · multi-phase adversary storylines" accent />
        <p className="text-xs text-slate-500 -mt-1">
          Live drip pacing, phase timeline, and SOC talking points — opens the full ThreatOps console.
        </p>

        {loadingCampaigns ? (
          <div className="rounded-xl border border-[#2d1b4e] bg-[#1a0a2e] p-8 flex items-center justify-center gap-3 text-slate-500 text-sm font-mono">
            <span className="w-4 h-4 border border-slate-500 border-t-transparent rounded-full animate-spin shrink-0" />
            Loading campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-xl border border-[#2d1b4e] bg-[#1a0a2e] p-8 flex flex-col items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-400" />
            <p className="text-sm text-slate-400 text-center">
              Backend not reachable — start the lab-ui Docker stack to load campaign data.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(campaign => (
              <CampaignCard
                key={campaign.key}
                campaign={campaign}
                onOpen={handleOpenCampaign}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
