import { useEffect, useState, type ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBus,
  faLocationDot,
  faShieldHalved,
  faRoute,
  faChartLine,
} from '@fortawesome/free-solid-svg-icons'
import { fetchPublicStats, type PublicStats } from '../../services/publicStatsService'

type AuthLayoutProps = {
  children: ReactNode
}

function AuthLayout({ children }: AuthLayoutProps) {
  // The branding panel reports live counts; nothing is rendered for a figure
  // we could not load, so a failed request drops the stat instead of faking it.
  const [stats, setStats] = useState<PublicStats | null>(null)

  useEffect(() => {
    let active = true
    void fetchPublicStats().then((next) => {
      if (active) setStats(next)
    })
    return () => {
      active = false
    }
  }, [])

  const liveStats = [
    { value: stats?.buses ?? null, label: 'Buses' },
    { value: stats?.routes ?? null, label: 'Routes' },
    { value: stats?.drivers ?? null, label: 'Drivers' },
  ].filter((stat): stat is { value: number; label: string } => stat.value !== null)

  return (
    // Shared shell for login/signup screens with a branded left panel.
    <div className="flex min-h-screen items-center justify-center bg-[#ececec] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <div className="animate-auth-card mx-auto flex min-h-[580px] w-full max-w-[940px] overflow-hidden rounded-3xl border border-[#1f2f8d]/60 bg-[#f7f7f7] shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
        <div className="animate-auth-left relative hidden w-[42%] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#020a1a] via-[#0d1d54] to-[#2642a6] p-6 text-white md:flex">

          {/* Decorative background dots */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          {/* Glowing orbs */}
          <div className="animate-auth-float pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#2f5ce6]/20 blur-3xl" />
          <div className="animate-auth-float pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-[#0ea5e9]/15 blur-3xl" style={{ animationDelay: '1.5s' }} />

          {/* Route line SVG illustration */}
          <svg className="animate-auth-fade-up pointer-events-none absolute left-6 top-8 h-full w-12 opacity-20" viewBox="0 0 48 600" fill="none">
            <path d="M24 0 V600" stroke="url(#routeGrad)" strokeWidth="2" strokeDasharray="8 6" />
            <circle cx="24" cy="80" r="5" fill="#60a5fa" />
            <circle cx="24" cy="240" r="5" fill="#34d399" />
            <circle cx="24" cy="420" r="5" fill="#a78bfa" />
            <circle cx="24" cy="560" r="5" fill="#fbbf24" />
            <defs>
              <linearGradient id="routeGrad" x1="0" y1="0" x2="0" y2="600" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0" />
                <stop offset="15%" stopColor="#60a5fa" />
                <stop offset="85%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* App icon */}
            <div className="animate-auth-float mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 shadow-lg shadow-black/20 ring-1 ring-white/20 backdrop-blur-sm">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white">
                <FontAwesomeIcon icon={faBus} className="text-lg text-[#2642a6]" />
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#10b981] ring-2 ring-[#0d1d54]">
                  <FontAwesomeIcon icon={faLocationDot} className="text-2xs text-white" />
                </span>
              </div>
            </div>

            <h1 className="text-xl font-extrabold tracking-tight">TrackNGo</h1>
            <p className="mt-1 text-sm font-medium text-white/70">Smart Transport Admin Panel</p>

            {/* Divider */}
            <div className="my-5 h-px w-24 bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            {/* Feature highlights */}
            <div className="w-full max-w-[220px] space-y-2.5">
              {[
                { icon: faRoute, label: 'Live Route Tracking', color: 'text-sky-400', bg: 'bg-sky-400/10' },
                { icon: faChartLine, label: 'Revenue Analytics', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                { icon: faShieldHalved, label: 'Secure Admin Access', color: 'text-violet-400', bg: 'bg-violet-400/10' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="animate-auth-fade-up flex items-center gap-3 rounded-xl bg-white/[0.06] px-3.5 py-2 ring-1 ring-white/[0.08] backdrop-blur-sm"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
                    <FontAwesomeIcon icon={item.icon} className={`text-xs ${item.color}`} />
                  </span>
                  <span className="text-xs font-semibold text-white/85">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Stats row - live counts, hidden until they load */}
            {stats === null ? (
              <div className="mt-6 flex gap-6 text-center" aria-hidden="true">
                {['Buses', 'Routes', 'Drivers'].map((label) => (
                  <div key={label}>
                    <p className="text-lg font-extrabold text-white/30">--</p>
                    <p className="text-xs font-medium text-white/30">{label}</p>
                  </div>
                ))}
              </div>
            ) : liveStats.length > 0 ? (
              <div className="mt-6 flex gap-6 text-center">
                {liveStats.map((stat) => (
                  <div key={stat.label} className="animate-auth-fade-up">
                    <p className="text-lg font-extrabold text-white">{stat.value.toLocaleString()}</p>
                    <p className="text-xs font-medium text-white/50">{stat.label}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="animate-auth-fade-up flex w-full items-center justify-center p-6 md:w-[58%] md:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
