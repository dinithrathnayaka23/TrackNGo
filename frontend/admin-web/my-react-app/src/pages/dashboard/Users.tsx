import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDays,
  faBan,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faDownload,
  faEllipsisVertical,
  faMagnifyingGlass,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'
import { fetchAdminUsers, updateAdminUserStatus, type AdminUser, type AdminUserStatus } from '../../services/userService'

type Role = 'Passenger' | 'Driver' | 'Corporate' | 'Unknown'
type Status = 'Active' | 'Suspended' | 'Inactive' | 'Pending' | 'On Leave' | 'Unknown'

type UserRecord = {
  uid: string
  name: string
  idTag: string
  email: string
  phone: string
  role: Role
  status: Status
  joinedAt: string | null
  avatar: string
  verified: boolean
}

function displayName(user: AdminUser) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return name || user.email || 'Unknown user'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(date)
}

function mapUser(user: AdminUser): UserRecord | null {
  const normalizedRole = String(user.userType ?? user.role ?? '').trim().toLowerCase()
  if (normalizedRole === 'admin') return null

  const name = displayName(user)
  const normalizedStatus = String(user.status ?? '').trim().toLowerCase().replace(/_/g, ' ')
  const status: Status = normalizedStatus === 'active'
    ? 'Active'
    : normalizedStatus === 'suspended'
      ? 'Suspended'
      : normalizedStatus === 'pending' || normalizedStatus === 'pending verification'
        ? 'Pending'
        : normalizedStatus === 'on leave'
          ? 'On Leave'
          : normalizedStatus === 'inactive'
            ? 'Inactive'
            : 'Unknown'
  const role: Role = normalizedRole === 'passenger'
    ? 'Passenger'
    : normalizedRole === 'driver'
      ? 'Driver'
      : normalizedRole === 'corporate'
        ? 'Corporate'
        : 'Unknown'
  const email = user.email || '-'

  return {
    uid: String(user.id ?? `${email}-${name}`),
    name,
    idTag: `#${role === 'Corporate' ? 'CORP' : 'USR'}-${user.id ?? '—'}`,
    email,
    phone: user.phone || '—',
    role,
    status,
    joinedAt: user.joinedAt ?? null,
    avatar: initials(name),
    verified: Boolean(user.emailVerified),
  }
}

function roleBadgeClass(role: Role) {
  if (role === 'Passenger') return 'bg-[#dbeafe] text-[#1d4ed8]'
  if (role === 'Driver') return 'bg-[#ccfbf1] text-[#0f766e]'
  return 'bg-[#f3e8ff] text-[#7e22ce]'
}

function statusDotClass(status: Status) {
  if (status === 'Active') return 'bg-[#10b981]'
  if (status === 'Pending') return 'bg-[#f59e0b]'
  return 'bg-[#ef4444]'
}

function isSameCalendarDate(sourceDateText: string | null, selectedDate: string) {
  if (!sourceDateText) return false
  const source = new Date(sourceDateText)
  const selected = new Date(`${selectedDate}T00:00:00`)
  if (Number.isNaN(source.getTime()) || Number.isNaN(selected.getTime())) return false
  return source.getFullYear() === selected.getFullYear() && source.getMonth() === selected.getMonth() && source.getDate() === selected.getDate()
}

function Users() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'All' | Role>('All')
  const [statusFilter, setStatusFilter] = useState<'All Status' | Status>('All Status')
  const [registrationDate, setRegistrationDate] = useState('')
  const [users, setUsers] = useState<UserRecord[]>([])
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMenu, setActionMenu] = useState<{ userId: string; top: number; right: number } | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [statusActionError, setStatusActionError] = useState<string | null>(null)
  const pageSize = 50

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetchAdminUsers()
      .then((data) => {
        if (active) setUsers(data.map(mapUser).filter((user): user is UserRecord => user !== null))
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load users')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users.filter((user) => {
      const roleMatch = roleFilter === 'All' || user.role === roleFilter
      const statusMatch = statusFilter === 'All Status' || user.status === statusFilter
      const dateMatch = registrationDate === '' || isSameCalendarDate(user.joinedAt, registrationDate)
      const searchMatch = !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query) || user.phone.toLowerCase().includes(query)
      return roleMatch && statusMatch && dateMatch && searchMatch
    })
  }, [registrationDate, roleFilter, search, statusFilter, users])

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const visibleUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [registrationDate, roleFilter, search, statusFilter])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  useEffect(() => {
    if (!actionMenu) return
    const closeMenu = () => setActionMenu(null)
    document.addEventListener('pointerdown', closeMenu)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [actionMenu])

  const allVisibleSelected = visibleUsers.length > 0 && visibleUsers.every((user) => selectedRows.includes(user.uid))
  const toggleSelection = (uid: string) => {
    setSelectedRows((current) => current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid])
  }
  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedRows((current) => current.filter((id) => !visibleUsers.some((user) => user.uid === id)))
    } else {
      setSelectedRows((current) => Array.from(new Set([...current, ...visibleUsers.map((user) => user.uid)])))
    }
  }
  const clearFilters = () => {
    setSearch('')
    setRoleFilter('All')
    setStatusFilter('All Status')
    setRegistrationDate('')
  }
  const firstVisible = filteredUsers.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastVisible = Math.min(page * pageSize, filteredUsers.length)

  const changeUserStatus = async (user: UserRecord, status: AdminUserStatus) => {
    const userId = Number(user.uid)
    if (!Number.isInteger(userId)) {
      setStatusActionError('This user does not have a valid account ID.')
      setActionMenu(null)
      return
    }
    setStatusActionError(null)
    setUpdatingUserId(user.uid)
    try {
      const updated = await updateAdminUserStatus(userId, status)
      const mapped = mapUser(updated)
      if (mapped) setUsers((current) => current.map((item) => item.uid === user.uid ? mapped : item))
      setActionMenu(null)
    } catch (requestError) {
      setStatusActionError(requestError instanceof Error ? requestError.message : 'Could not update user status.')
    } finally {
      setUpdatingUserId(null)
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1320px]">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4 md:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Users Management</h1>
          <p className="mt-1 text-sm text-[#64748b]">Live passenger, driver, and corporate accounts from TrackNGo.</p>
        </div>
        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 md:w-auto md:gap-3">
          <button type="button" onClick={() => navigate('/dashboard/passenger')} className="rounded-lg border border-[#cfd8ea] bg-white px-4 py-2 text-sm font-semibold text-[#3156c2]">Passenger</button>
          <button type="button" onClick={() => navigate('/dashboard/driver')} className="rounded-lg border border-[#cfd8ea] bg-white px-4 py-2 text-sm font-semibold text-[#0f766e]">Driver</button>
          <button type="button" onClick={() => navigate('/dashboard/corporate')} className="rounded-lg border border-[#cfd8ea] bg-white px-4 py-2 text-sm font-semibold text-[#7e22ce]">Corporate</button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-4 text-sm font-semibold text-[#334155]"><FontAwesomeIcon icon={faDownload} />Export Users</button>
        </div>
      </header>

      <article className="rounded-2xl border border-[#e5e7eb] bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[2fr_0.6fr_0.6fr_0.9fr_auto]">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-[#d6dbe6] px-3 text-sm text-[#94a3b8]"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, phone..." className="w-full bg-transparent text-[#334155] placeholder:text-[#94a3b8] outline-none" /></label>
          <label className="inline-flex h-11 items-center justify-between rounded-xl border border-[#d6dbe6] px-3 text-sm text-[#334155]"><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'All' | Role)} className="w-full bg-transparent outline-none"><option value="All">All Roles</option><option value="Passenger">Passenger</option><option value="Driver">Driver</option><option value="Corporate">Corporate</option></select></label>
          <label className="inline-flex h-11 items-center justify-between rounded-xl border border-[#d6dbe6] px-3 text-sm text-[#334155]"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All Status' | Status)} className="w-full bg-transparent outline-none"><option value="All Status">All Status</option><option value="Active">Active</option><option value="Suspended">Suspended</option><option value="Inactive">Inactive</option><option value="Pending">Pending</option><option value="On Leave">On Leave</option></select></label>
          <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d6dbe6] px-3 text-sm text-[#334155]"><FontAwesomeIcon icon={faCalendarDays} /><input type="date" value={registrationDate} onChange={(event) => setRegistrationDate(event.target.value)} className="w-full bg-transparent outline-none" aria-label="Registration Date" /></label>
          <button type="button" onClick={clearFilters} className="px-1 text-left text-sm font-semibold text-[#64748b]">Clear All</button>
        </div>
      </article>

      {statusActionError ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{statusActionError}</p> : null}

      <article className="mt-4 overflow-hidden rounded-2xl border border-[#d6dbe6] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d6dbe6] bg-[#f7f9fc] px-4 py-3"><p className="inline-flex items-center gap-3 text-sm font-medium text-[#334155]"><span className="rounded-md bg-[#22449d] px-2 py-0.5 text-xs font-semibold text-white">{selectedRows.length}</span>items selected</p><button type="button" onClick={() => setSelectedRows([])} className="text-sm text-[#64748b]">Clear selection</button></div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-[#e5e7eb] bg-[#f9fbff] text-left text-xs font-semibold text-[#64748b]"><tr><th className="w-12 px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="h-4 w-4 rounded border-[#bfd0f2] text-[#22449d] focus:ring-[#22449d]" /></th><th className="px-4 py-3">User</th><th className="px-4 py-3">Contact Info</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-[#64748b]"><FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />Loading users...</td></tr>}
              {!loading && error && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-[#dc2626]">{error}</td></tr>}
              {!loading && !error && visibleUsers.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-[#64748b]">No users match the selected filters.</td></tr>}
              {!loading && !error && visibleUsers.map((user) => {
                const isSelected = selectedRows.includes(user.uid)
                return <tr key={user.uid} className={`border-b border-[#e5e7eb] text-sm ${isSelected ? 'bg-[#f5f8ff]' : 'bg-white'}`}><td className="px-4 py-3"><input type="checkbox" checked={isSelected} onChange={() => toggleSelection(user.uid)} className="h-4 w-4 rounded border-[#bfd0f2] text-[#22449d] focus:ring-[#22449d]" /></td><td className="px-4 py-3"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#dbeafe] text-xs font-semibold text-[#1e3a8a]">{user.avatar}</div><div><p className="font-semibold text-[#111827]">{user.name}{user.verified ? <span className="ml-2 text-[#2563eb]" title="Email verified">✓</span> : null}</p><p className="text-xs text-[#64748b]">ID: {user.idTag}</p></div></div></td><td className="px-4 py-3"><p className="text-[#334155]">{user.email}</p><p className="text-xs text-[#64748b]">{user.phone}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadgeClass(user.role)}`}>{user.role}</span></td><td className="px-4 py-3"><span className="inline-flex items-center gap-2 text-[15px] text-[#334155]"><span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(user.status)}`} />{user.status}</span></td><td className="px-4 py-3 text-[#334155]">{formatDate(user.joinedAt)}</td><td className="px-4 py-3 text-right text-[#94a3b8]"><button type="button" onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setActionMenu((current) => current?.userId === user.uid ? null : { userId: user.uid, top: rect.bottom + 6, right: Math.max(12, window.innerWidth - rect.right) }) }} className="rounded p-2 hover:bg-[#eef2f8]" aria-label={`Actions for ${user.name}`} aria-expanded={actionMenu?.userId === user.uid}><FontAwesomeIcon icon={faEllipsisVertical} /></button></td></tr>
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3 text-sm"><p className="text-[#334155]">Showing <span className="font-semibold text-[#111827]">{firstVisible}-{lastVisible} of {filteredUsers.length}</span></p><div className="flex items-center gap-3 text-[#334155]"><span>Rows per page: {pageSize}</span><div className="inline-flex overflow-hidden rounded-md border border-[#cfd8ea]"><button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="grid h-8 w-8 place-items-center bg-white text-[#334155] disabled:text-[#cbd5e1]" aria-label="Previous page"><FontAwesomeIcon icon={faChevronLeft} /></button><span className="grid h-8 min-w-8 place-items-center bg-[#21409a] px-2 text-white">{page} / {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="grid h-8 w-8 place-items-center bg-white text-[#334155] disabled:text-[#cbd5e1]" aria-label="Next page"><FontAwesomeIcon icon={faChevronRight} /></button></div></div></div>
      </article>

      {actionMenu ? (() => {
        const actionUser = users.find((user) => user.uid === actionMenu.userId)
        if (!actionUser) return null
        const nextStatus: AdminUserStatus = actionUser.status === 'Active' ? 'suspended' : 'active'
        const isUpdating = updatingUserId === actionUser.uid
        return <div className="fixed z-50 w-56 overflow-hidden rounded-xl border border-[#d6dbe6] bg-white p-1.5 shadow-xl" style={{ top: actionMenu.top, right: actionMenu.right }} onPointerDown={(event) => event.stopPropagation()}>
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">Account status</p>
          <button type="button" disabled={isUpdating} onClick={() => void changeUserStatus(actionUser, nextStatus)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${nextStatus === 'suspended' ? 'text-[#b91c1c] hover:bg-red-50' : 'text-[#047857] hover:bg-emerald-50'}`}>
            <FontAwesomeIcon icon={nextStatus === 'suspended' ? faBan : faCircleCheck} className="w-4" />
            {isUpdating ? 'Updating...' : nextStatus === 'suspended' ? 'Suspend user' : 'Reactivate user'}
          </button>
        </div>
      })() : null}
    </section>
  )
}

export default Users
