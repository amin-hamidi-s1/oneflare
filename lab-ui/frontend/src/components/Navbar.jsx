import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  History,
  ShieldAlert,
  Network,
  Settings,
  Flame,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/detections',  label: 'Detections',   icon: ShieldAlert },
  { to: '/history',     label: 'History',      icon: History },
  { to: '/architecture',label: 'Architecture', icon: Network },
  { to: '/settings',    label: 'Settings',     icon: Settings },
]

export default function Navbar() {
  const location = useLocation()

  return (
    <nav className="glass-nav sticky top-0 z-50">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 shrink-0 group">
          <div className="relative flex items-center justify-center w-8 h-8">
            <div className="absolute inset-0 bg-orange-500/20 rounded-lg blur-sm group-hover:bg-orange-500/30 transition-all" />
            <Flame className="relative w-5 h-5 text-orange-400" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-lg tracking-tight">
            <span className="gradient-text-orange">One</span>
            <span className="text-slate-100">Flare</span>
          </span>
          <span className="hidden sm:inline text-xs font-mono text-slate-600 ml-1 border border-slate-700/50 rounded px-1.5 py-0.5">
            LAB
          </span>
        </NavLink>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const isActive = to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(to)
            return (
              <NavLink
                key={to}
                to={to}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-orange-400 bg-orange-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">{label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-px bg-gradient-to-r from-orange-500 to-purple-500 rounded-full" />
                )}
              </NavLink>
            )
          })}
        </div>

        {/* Co-brand */}
        <div className="hidden lg:flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-semibold text-orange-400/80 tracking-widest uppercase">
            Cloudflare
          </span>
          <span className="text-slate-600 text-xs">+</span>
          <span className="text-xs font-semibold text-purple-400/80 tracking-wide">
            SentinelOne
          </span>
        </div>
      </div>
    </nav>
  )
}
