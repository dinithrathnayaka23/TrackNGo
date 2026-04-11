import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faBell, faChevronRight, faMagnifyingGlass, faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import Sidebar from './Sidebar'

type DashboardLayoutProps = {
  children: ReactNode
}

function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const segment = location.pathname.split('/')[2] || 'dashboard'
  const labelBySegment: Record<string, string> = {
    dashboard: 'Dashboard',
    analytics: 'Analytics',
    chat: 'Chat',
    users: 'Users',
    passenger: 'Passenger',
    driver: 'Driver',
    corporate: 'Corporate',
    buses: 'Buses',
    booking: 'Bookings',
    complaints: 'Complaints',
  }
  const breadcrumbTrail =
    segment === 'passenger' || segment === 'driver' || segment === 'corporate'
      ? ['Users', labelBySegment[segment] ?? 'Dashboard']
      : [labelBySegment[segment] ?? 'Dashboard']

  return (
    <div className="min-h-screen bg-[#f3f4f8] text-[#111827]">
      <div className="flex w-full">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

        <div className="min-h-screen flex-1 min-w-0">
          <header className="sticky top-0 z-10 border-b border-[#dfe3ea] bg-[#f9fafc]">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6">
              <div className="flex items-center gap-2 text-sm text-[#6b7280]">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="mr-1 grid h-9 w-9 place-items-center rounded-lg text-[#374151] hover:bg-[#eef2ff] lg:hidden"
                >
                  <FontAwesomeIcon icon={faBars} />
                </button>
                <span className="hidden sm:inline">Home</span>
                {breadcrumbTrail.map((crumb) => (
                  <div key={crumb} className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
                    <span className="font-semibold text-[#374151]">{crumb}</span>
                  </div>
                ))}
              </div>

              <label className="order-last flex h-12 w-full items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f1f3f7] px-3 text-sm text-[#9ca3af] sm:order-none sm:w-auto sm:max-w-[560px] sm:flex-1">
                <FontAwesomeIcon icon={faMagnifyingGlass} />
                <input
                  type="text"
                  placeholder="Search buses, drivers, or routes..."
                  className="w-full bg-transparent text-[#4b5563] placeholder:text-[#9ca3af] outline-none"
                />
              </label>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#21409a] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#1b357f]"
                >
                  <FontAwesomeIcon icon={faRightFromBracket} />
                  Logout
                </button>
                <button
                  type="button"
                  className="relative text-sm text-[#6b7280] transition hover:scale-105"
                >
                  <FontAwesomeIcon icon={faBell} />
                </button>
              </div>
            </div>
          </header>

          <main className="p-5">{children}</main>
        </div>
      </div>
    </div>
  )
}

export default DashboardLayout
