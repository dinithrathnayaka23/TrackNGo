import { faBus, faBars, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
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
  onNavigate,
}: {
  title: string
  items: SidebarMenuItem[]
  onMenuAction?: (label: string) => void
  onNavigate?: () => void
}) {
  return (
    <div>
      <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#9aa5bc]">{title}</p>
      <div className="space-y-1">
        {items.map((item) => {
          const itemClass = [
            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition duration-200',
            item.active
              ? 'bg-[#2642a6] text-white shadow-[0_8px_16px_rgba(23,38,96,0.35)]'
              : 'text-[#d6dded] hover:bg-[#243456]',
          ].join(' ')

          if (item.path) {
            return (
              <Link key={item.label} to={item.path} className={itemClass} onClick={onNavigate}>
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
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close sidebar on route change (link click) for mobile
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      {/* Mobile hamburger button — only visible below lg */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-5 z-30 grid h-10 w-10 place-items-center rounded-lg bg-[#1c2a44] text-white shadow-lg lg:hidden"
        aria-label="Open navigation"
      >
        <FontAwesomeIcon icon={faBars} />
      </button>

      {/* Backdrop for mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-60 border-r border-[#2f3f61] bg-[#1c2a44] transition-transform duration-300 ease-in-out',
          'lg:translate-x-0 lg:z-20',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-full flex-col">
          <div className="animate-dash-in border-b border-[#2f3f61] px-4 py-3" style={{ animationDelay: '20ms' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-[#2b4cad] text-white">
                  <FontAwesomeIcon icon={faBus} className="text-sm" />
                </div>
                <span className="text-lg font-extrabold tracking-tight text-white">TrackNGo</span>
              </div>
              {/* Close button — only visible below lg */}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-[#243456] lg:hidden"
                aria-label="Close navigation"
              >
                <FontAwesomeIcon icon={faXmark} className="text-lg" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-3 py-3">
            <div className="animate-dash-in" style={{ animationDelay: '80ms' }}>
              <MenuSection title="Main Menu" items={mainMenu} onMenuAction={(label) => { onMenuAction?.(label); setMobileOpen(false) }} onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="animate-dash-in" style={{ animationDelay: '120ms' }}>
              <MenuSection title="System" items={systemMenu} onMenuAction={(label) => { onMenuAction?.(label); setMobileOpen(false) }} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>

          <div className="animate-dash-in border-t border-[#2f3f61] p-3" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center gap-2 rounded-lg bg-[#c8cdd8] px-2 py-1.5">
              <img
                src={adminProfileImage}
                alt="Administrator profile avatar"
                className="h-9 w-9 rounded-full object-cover"
              />
              <div>
                <p className="text-xs font-bold text-[#222a3b]">{profileName}</p>
                <p className="text-xs text-[#5c6679]">{profileRole}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
