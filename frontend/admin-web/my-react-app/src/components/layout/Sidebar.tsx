import { faBus } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link } from 'react-router-dom'
import adminProfileImage from '../../assets/images/adminProfile.png'

export type SidebarMenuItem = {
  label: string
  icon: IconDefinition
  active?: boolean
  path?: string
}

type SidebarProps = {
  mainMenu: SidebarMenuItem[]
  systemMenu: SidebarMenuItem[]
  onMenuAction?: (label: string) => void
  profileName?: string
  profileRole?: string
}

function MenuSection({
  title,
  items,
  onMenuAction,
}: {
  title: string
  items: SidebarMenuItem[]
  onMenuAction?: (label: string) => void
}) {
  return (
    <div>
      <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#9aa5bc]">{title}</p>
      <div className="space-y-1">
        {items.map((item) => {
          const itemClass = [
            'flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-[15px] font-semibold transition duration-200',
            item.active
              ? 'bg-[#2642a6] text-white shadow-[0_8px_16px_rgba(23,38,96,0.35)]'
              : 'text-[#d6dded] hover:bg-[#243456]',
          ].join(' ')

          if (item.path) {
            // Routed items navigate directly via react-router.
            return (
              <Link key={item.label} to={item.path} className={itemClass}>
                <FontAwesomeIcon icon={item.icon} className="text-sm" />
                <span>{item.label}</span>
              </Link>
            )
          }

          return (
            <button
              type="button"
              key={item.label}
              className={itemClass}
              // Non-routed items bubble actions to parent pages for toasts/placeholders.
              onClick={() => onMenuAction?.(item.label)}
            >
              <FontAwesomeIcon icon={item.icon} className="text-sm" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Sidebar({
  mainMenu,
  systemMenu,
  onMenuAction,
  profileName = 'Dinith Rathnayaka',
  profileRole = 'Admin',
}: SidebarProps) {
  return (
    // Left navigation shell shared across dashboard screens.
    <aside className="fixed inset-y-0 left-0 z-20 w-[314px] border-r border-[#2f3f61] bg-[#1c2a44]">
      <div className="flex h-full flex-col">
        <div className="animate-dash-in border-b border-[#2f3f61] px-6 py-5" style={{ animationDelay: '20ms' }}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-[#2b4cad] text-white">
              <FontAwesomeIcon icon={faBus} className="text-lg" />
            </div>
            <span className="text-[32px] font-extrabold tracking-tight text-white">TrackNGo</span>
          </div>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-4 py-5">
          <div className="animate-dash-in" style={{ animationDelay: '80ms' }}>
            <MenuSection title="Main Menu" items={mainMenu} onMenuAction={onMenuAction} />
          </div>
          <div className="animate-dash-in" style={{ animationDelay: '120ms' }}>
            <MenuSection title="System" items={systemMenu} onMenuAction={onMenuAction} />
          </div>
        </div>

        <div className="animate-dash-in border-t border-[#2f3f61] p-4" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-3 rounded-lg bg-[#c8cdd8] px-3 py-2">
            <img
              src={adminProfileImage}
              alt="Administrator profile avatar"
              className="h-12 w-12 rounded-full object-cover"
            />
            <div>
              <p className="text-sm font-bold text-[#222a3b]">{profileName}</p>
              <p className="text-sm text-[#5c6679]">{profileRole}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
