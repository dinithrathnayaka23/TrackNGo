import { NavLink } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBusSimple,
  faChartColumn,
  faCommentDots,
  faExclamationTriangle,
  faLocationDot,
  faTicketSimple,
  faUsers,
  faTableColumns,
  faCircleUser,
} from '@fortawesome/free-solid-svg-icons'

const navItems = [
  { to: '/dashboard/analytics', label: 'Dashboard', icon: faTableColumns, section: 'Main Menu' },
  { to: '/dashboard/users', label: 'Users', icon: faUsers, section: 'Main Menu' },
  { to: '/dashboard/buses', label: 'Buses', icon: faBusSimple, section: 'Main Menu' },
  { to: '/dashboard/booking', label: 'Routes', icon: faLocationDot, section: 'Main Menu' },
  { to: '/dashboard/booking', label: 'Bookings', icon: faTicketSimple, section: 'Main Menu' },
  { to: '/dashboard/complaints', label: 'Complaints', icon: faExclamationTriangle, section: 'System' },
  { to: '/dashboard/analytics', label: 'Analytics', icon: faChartColumn, section: 'System' },
  { to: '/dashboard/users', label: 'Chat', icon: faCommentDots, section: 'System' },
]

function Sidebar() {
  const mainMenu = navItems.filter((item) => item.section === 'Main Menu')
  const systemMenu = navItems.filter((item) => item.section === 'System')

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-[22px] md:text-[15px] transition ${
      isActive ? 'bg-[#28469d] text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
    }`

  return (
    <aside className="sticky top-0 hidden h-screen w-[320px] flex-col border-r border-[#2e3d5f] bg-[#1d2b45] text-white md:flex">
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-6">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-[#2f4da7]">
          <FontAwesomeIcon icon={faBusSimple} />
        </div>
        <p className="text-3xl font-semibold tracking-tight">TrackNGo</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">Main Menu</p>
        <nav className="space-y-1">
          {mainMenu.map((item) => (
            <NavLink key={`${item.to}-${item.label}`} to={item.to} className={linkClasses}>
              <FontAwesomeIcon icon={item.icon} className="w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <p className="mb-3 mt-7 text-xs font-semibold uppercase tracking-wide text-white/50">System</p>
        <nav className="space-y-1">
          {systemMenu.map((item) => (
            <NavLink key={`${item.to}-${item.label}`} to={item.to} className={linkClasses}>
              <FontAwesomeIcon icon={item.icon} className="w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10 p-5">
        <div className="flex items-center gap-3 rounded-xl bg-[#c7ccd4] px-3 py-2 text-[#1f2937]">
          <FontAwesomeIcon icon={faCircleUser} className="text-3xl text-[#f59e0b]" />
          <div>
            <p className="text-sm font-semibold leading-tight">Dinith Rathnayaka</p>
            <p className="text-xs text-[#6b7280]">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
