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
  faTriangleExclamation,
  faUsers,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import adminProfileImage from '../../assets/images/adminDinith.png'
import authService from '../../services/authService'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: faChartSimple, section: 'Main Menu' },
  {
    to: '/dashboard/users',
    label: 'Users',
    icon: faUsers,
    section: 'Main Menu',
    activeOn: ['/dashboard/users', '/dashboard/passenger', '/dashboard/driver', '/dashboard/corporate', '/dashboard/users/corporate-users'],
  },
  { to: '/dashboard/buses', label: 'Buses', icon: faBus, section: 'Main Menu', activeOn: ['/dashboard/buses'] },
  { to: '/dashboard/routes', label: 'Routes', icon: faLocationDot, section: 'Main Menu' },
  { to: '/dashboard/booking?view=bookings', label: 'Bookings', icon: faBook, section: 'Main Menu' },
  { to: '/dashboard/promotions', label: 'Promotions', icon: faPercent, section: 'Main Menu' },
  { to: '/dashboard/complaints', label: 'Complaints', icon: faTriangleExclamation, section: 'System' },
  { to: '/dashboard/analytics', label: 'Analytics', icon: faChartColumn, section: 'System' },
  { to: '/dashboard/chat', label: 'Chat', icon: faComment, section: 'System' },
  { to: '/dashboard/settings', label: 'Settings', icon: faGear, section: 'System' },
]

type SidebarProps = {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation()
  const adminProfile = authService.getAdminProfile()
  const fallbackEmail = localStorage.getItem('adminEmail') ?? ''
  const mainMenu = navItems.filter((item) => item.section === 'Main Menu')
  const systemMenu = navItems.filter((item) => item.section === 'System')

  const adminFullName = [adminProfile?.firstName, adminProfile?.lastName]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' ')
    .trim()

  const formatFallbackName = (value: string) =>
    value
      .replace(/[._-]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')

  const fallbackNameFromEmail = adminProfile?.email
    ? formatFallbackName(adminProfile.email.split('@')[0])
    : fallbackEmail
      ? formatFallbackName(fallbackEmail.split('@')[0])
      : ''

  const adminDisplayName =
    adminFullName ||
    fallbackNameFromEmail ||
    'Admin User'

  const adminEmail = adminProfile?.email || fallbackEmail
  const adminRoleLabel = adminProfile?.userType?.toLowerCase() === 'admin' ? 'Admin' : 'User'

  const linkClasses = (isActive: boolean) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition duration-200 ${
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

      <div className="flex-1 space-y-2 overflow-y-hidden px-3 py-3">
        <div className="animate-dash-in" style={{ animationDelay: '80ms' }}>
          <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wide text-[#9aa5bc]">Main Menu</p>
          <nav className="space-y-1">
            {mainMenu.map((item) => (
              <NavLink
                key={`${item.to}-${item.label}`}
                to={item.to}
                onClick={onMobileClose}
                className={linkClasses(isItemActive(item.to, item.activeOn))}
              >
                <FontAwesomeIcon icon={item.icon} className="text-sm" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="animate-dash-in" style={{ animationDelay: '120ms' }}>
          <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wide text-[#9aa5bc]">System</p>
          <nav className="space-y-1">
            {systemMenu.map((item) => (
              <NavLink
                key={`${item.to}-${item.label}`}
                to={item.to}
                onClick={onMobileClose}
                className={linkClasses(isItemActive(item.to, item.activeOn))}
              >
                <FontAwesomeIcon icon={item.icon} className="text-sm" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div className="animate-dash-in border-t border-[#2f3f61] p-3" style={{ animationDelay: '150ms' }}>
        <div className="flex items-center gap-2 rounded-lg bg-[#c8cdd8] px-2 py-1.5">
          <img
            src={adminProfileImage}
            alt="Admin profile"
            className="h-9 w-9 rounded-full object-cover"
          />
          <div>
            <p className="text-xs font-bold text-[#222a3b]">{adminDisplayName}</p>
            <p className="text-xs text-[#5c6679]">{adminEmail || adminRoleLabel}</p>
          </div>
        </div>
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
