import { faBell, faMagnifyingGlass, faSignOutAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ChangeEvent, ReactNode } from 'react'

type NavbarProps = {
  breadcrumbs: string[]
  onLogout: () => void
  showSearch?: boolean
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  unreadCount?: number
  onToggleNotifications?: () => void
  notificationPanel?: ReactNode
  rightSlot?: ReactNode
}

function Navbar({
  breadcrumbs,
  onLogout,
  showSearch = true,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search buses, drivers, or routes...',
  unreadCount = 0,
  onToggleNotifications,
  notificationPanel,
  rightSlot,
}: NavbarProps) {
  return (
    <header
      className="animate-dash-in z-10 flex h-[78px] shrink-0 items-center justify-between border-b border-[#dfe1e8] bg-[#f7f7fa] px-8"
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

      {showSearch ? (
        <div className="w-full max-w-[560px] px-6">
          <div className="flex h-12 items-center gap-3 rounded-xl bg-[#eef0f5] px-4 text-[#7d8798]">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
              type="text"
              {...(onSearchChange
                ? {
                    value: searchValue,
                    onChange: (event: ChangeEvent<HTMLInputElement>) => onSearchChange(event.target.value),
                  }
                : { defaultValue: searchValue })}
              className="w-full bg-transparent text-sm text-[#2f394d] outline-none"
              placeholder={searchPlaceholder}
            />
          </div>
        </div>
      ) : (
        <div className="w-full" />
      )}

      <div className="relative flex items-center gap-8">
        {rightSlot}
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#203b96]"
        >
          <FontAwesomeIcon icon={faSignOutAlt} />
          Logout
        </button>
        <button
          type="button"
          onClick={onToggleNotifications}
          className="relative text-lg text-[#3b4253] transition duration-200 hover:scale-105"
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
