import { faBell, faSignOutAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ReactNode } from 'react'

type NavbarProps = {
  breadcrumbs: string[]
  onLogout: () => void
  unreadCount?: number
  onToggleNotifications?: () => void
  notificationPanel?: ReactNode
  rightSlot?: ReactNode
}

function Navbar({
  breadcrumbs,
  onLogout,
  unreadCount = 0,
  onToggleNotifications,
  notificationPanel,
  rightSlot,
}: NavbarProps) {
  return (
    // Reusable top bar used across dashboard pages.
    <header
      className="animate-dash-in z-10 flex h-16 shrink-0 items-center justify-between border-b border-[#e5e7eb] bg-[#f7f7fa] px-6"
      style={{ animationDelay: '40ms' }}
    >
      <div className="flex flex-nowrap items-center gap-3 text-sm text-[#6a7284] whitespace-nowrap">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1
          return (
            <div key={`${item}-${index}`} className="flex items-center gap-3">
              <span className={isLast ? 'whitespace-nowrap font-bold text-[#2b3448]' : 'whitespace-nowrap'}>{item}</span>
              {!isLast ? <span>{'>'}</span> : null}
            </div>
          )
        })}
      </div>

      <div className="relative flex items-center gap-8">
        {rightSlot}
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-1.5 text-xs font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#203b96]"
        >
          <FontAwesomeIcon icon={faSignOutAlt} />
          Logout
        </button>
        <button
          type="button"
          onClick={onToggleNotifications}
          className="relative text-sm text-[#3b4253] transition duration-200 hover:scale-105"
          aria-label="Notifications"
        >
          <FontAwesomeIcon icon={faBell} />
          {unreadCount > 0 ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#f24f4f]" /> : null}
        </button>

        {notificationPanel}
      </div>
    </header>
  )
}

export default Navbar
