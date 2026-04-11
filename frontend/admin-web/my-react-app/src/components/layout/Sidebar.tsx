import { NavLink, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBook,
  faBus,
  faBusSimple,
  faChartColumn,
  faChartLine,
  faComment,
  faLocationDot,
  faTriangleExclamation,
  faUsers,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import adminProfileImage from '../../assets/images/adminDinith.png'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: faChartColumn, section: 'Main Menu' },
  {
    to: '/dashboard/users',
    label: 'Users',
    icon: faUsers,
    section: 'Main Menu',
    activeOn: ['/dashboard/users', '/dashboard/passenger', '/dashboard/driver', '/dashboard/corporate'],
  },
  { to: '/dashboard/buses', label: 'Buses', icon: faBus, section: 'Main Menu' },
  { to: '/dashboard/booking?view=routes', label: 'Routes', icon: faLocationDot, section: 'Main Menu' },
  { to: '/dashboard/booking?view=bookings', label: 'Bookings', icon: faBook, section: 'Main Menu' },
  { to: '/dashboard/complaints', label: 'Complaints', icon: faTriangleExclamation, section: 'System' },
  { to: '/dashboard/analytics', label: 'Analytics', icon: faChartLine, section: 'System' },
  { to: '/dashboard/chat', label: 'Chat', icon: faComment, section: 'System' },
]

type SidebarProps = {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation()
  const mainMenu = navItems.filter((item) => item.section === 'Main Menu')
  const systemMenu = navItems.filter((item) => item.section === 'System')

  const linkClasses = (isActive: boolean) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
      isActive ? 'bg-[#28469d] text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
    }`

  const isItemActive = (to: string, activeOn?: string[]) => {
    if (activeOn && activeOn.includes(location.pathname)) return true

    const [path, search = ''] = to.split('?')
    if (location.pathname !== path) return false
    if (!search) return location.search === ''
    return location.search === `?${search}`
  }

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-[#2f4da7]">
            <FontAwesomeIcon icon={faBusSimple} />
          </div>
          <p className="text-lg font-extrabold tracking-tight">TrackNGo</p>
        </div>
        {onMobileClose && (
          <button type="button" onClick={onMobileClose} className="grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden">
            <FontAwesomeIcon icon={faXmark} className="text-lg" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">Main Menu</p>
        <nav className="space-y-1">
          {mainMenu.map((item) => (
            <NavLink
              key={`${item.to}-${item.label}`}
              to={item.to}
              onClick={onMobileClose}
              className={linkClasses(isItemActive(item.to, item.activeOn))}
            >
              <FontAwesomeIcon icon={item.icon} className="w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-white/50">System</p>
        <nav className="space-y-1">
          {systemMenu.map((item) => (
            <NavLink
              key={`${item.to}-${item.label}`}
              to={item.to}
              onClick={onMobileClose}
              className={linkClasses(isItemActive(item.to, item.activeOn))}
            >
              <FontAwesomeIcon icon={item.icon} className="w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 rounded-lg bg-[#c7ccd4] px-2 py-1.5 text-[#1f2937]">
          <img
            src={adminProfileImage}
            alt="Admin profile"
            className="h-9 w-9 rounded-full object-cover"
          />
          <div>
            <p className="text-xs font-bold leading-tight">Dinith Rathnayaka</p>
            <p className="text-xs text-[#6b7280]">Admin</p>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[#2e3d5f] bg-[#1d2b45] text-white lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="fixed inset-y-0 left-0 z-50 flex h-screen w-60 flex-col bg-[#1d2b45] text-white shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}

export default Sidebar
