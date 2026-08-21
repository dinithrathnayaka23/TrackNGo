import { NavLink, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBook,
  faBus,
  faChartColumn,
  faChartSimple,
  faComment,
  faGear,
  faLocationDot,
  faPercent,
  faSignOutAlt,
  faTriangleExclamation,
  faUsers,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useUnreadSupportCount } from '../../hooks/useUnreadSupportCount'
const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: faChartSimple },
  {
    to: '/dashboard/users',
    label: 'Users',
    icon: faUsers,
    activeOn: ['/dashboard/users', '/dashboard/passenger', '/dashboard/driver', '/dashboard/corporate', '/dashboard/users/corporate-users', '/dashboard/corporate/contracts', '/dashboard/corporate/pricing-settings'],
  },
  { to: '/dashboard/buses', label: 'Buses', icon: faBus, activeOn: ['/dashboard/buses'] },
  { to: '/dashboard/routes', label: 'Routes', icon: faLocationDot },
  { to: '/dashboard/booking?view=bookings', label: 'Bookings', icon: faBook },
  { to: '/dashboard/promotions', label: 'Promotions', icon: faPercent },
  { to: '/dashboard/complaints', label: 'Complaints', icon: faTriangleExclamation },
  { to: '/dashboard/analytics', label: 'Analytics', icon: faChartColumn },
  { to: '/dashboard/chat', label: 'Chat', icon: faComment, badge: 'support-chat' },
  { to: '/dashboard/settings', label: 'Settings', icon: faGear },
]

type SidebarProps = {
  mobileOpen?: boolean
  onMobileClose?: () => void
  onLogout: () => void
}

function Sidebar({ mobileOpen = false, onMobileClose, onLogout }: SidebarProps) {
  const location = useLocation()
  const unreadChatCount = useUnreadSupportCount()

  const linkClasses = (isActive: boolean) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition duration-200 ${
      isActive ? 'bg-[#2642a6] text-white shadow-[0_8px_16px_rgba(23,38,96,0.35)]' : 'text-[#d6dded] hover:bg-[#243456]'
    }`

  const isItemActive = (to: string, activeOn?: string[]) => {
    if (activeOn && activeOn.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))) return true

    const [path, search = ''] = to.split('?')
    if (location.pathname !== path) return false
    if (!search) return location.search === ''
    return location.search === `?${search}`
  }

  const sidebarContent = (
    <>
      <div className="animate-dash-in border-b border-[#2f3f61] px-4 py-3" style={{ animationDelay: '20ms' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-[#2b4cad] text-white">
              <FontAwesomeIcon icon={faBus} className="text-sm" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-white">TrackNGo</span>
          </div>
          {onMobileClose && (
            <button type="button" onClick={onMobileClose} className="grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-[#243456] lg:hidden">
              <FontAwesomeIcon icon={faXmark} className="text-lg" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="animate-dash-in space-y-1.5" style={{ animationDelay: '80ms' }}>
          {navItems.map((item) => (
            <NavLink
              key={`${item.to}-${item.label}`}
              to={item.to}
              onClick={onMobileClose}
              className={linkClasses(isItemActive(item.to, item.activeOn))}
            >
              <FontAwesomeIcon icon={item.icon} className="text-sm" />
              <span>{item.label}</span>
              {item.badge === 'support-chat' && unreadChatCount > 0 ? (
                <span className="ml-auto min-w-5 rounded-full bg-[#f24f4f] px-1.5 text-center text-2xs font-extrabold leading-5 text-white">
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="animate-dash-in border-t border-[#2f3f61] p-3" style={{ animationDelay: '150ms' }}>
        <button
          type="button"
          onClick={() => {
            onMobileClose?.()
            onLogout()
          }}
          className="flex w-full items-center gap-3 rounded-lg border border-[#334568] bg-[#243456] px-3 py-2.5 text-sm font-semibold text-[#d6dded] transition duration-200 hover:bg-[#2d4168] hover:text-white"
        >
          <FontAwesomeIcon icon={faSignOutAlt} className="text-sm" />
          <span>Logout</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[#2f3f61] bg-[#1c2a44] text-white lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={onMobileClose} />
          <aside className="fixed inset-y-0 left-0 z-50 flex h-screen w-60 flex-col bg-[#1c2a44] text-white shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}

export default Sidebar
