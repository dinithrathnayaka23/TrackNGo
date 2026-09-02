import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDays,
  faBan,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faComments,
  faDownload,
  faEllipsisVertical,
  faIdCard,
  faMagnifyingGlass,
  faSackDollar,
  faSpinner,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { fetchAdminUsers, updateAdminUserStatus, type AdminUser, type AdminUserStatus } from '../../services/userService'
import {
  fetchAdminDriver,
  fetchAdminDriverAssignment,
  fetchAdminDriverEarnings,
  type AdminDriver,
  type AdminDriverAssignment,
  type AdminDriverEarningsResponse,
} from '../../services/driverService'
import { getAdminChatPath } from '../../utils/adminChatNavigation'

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
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMenu, setActionMenu] = useState<{ userId: string; top: number; right: number } | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [statusActionError, setStatusActionError] = useState<string | null>(null)
  const [earningsUser, setEarningsUser] = useState<UserRecord | null>(null)
  const [earnings, setEarnings] = useState<AdminDriverEarningsResponse | null>(null)
  const [earningsLoading, setEarningsLoading] = useState(false)
  const [earningsError, setEarningsError] = useState<string | null>(null)
  const [detailsUser, setDetailsUser] = useState<UserRecord | null>(null)
  const [driverDetails, setDriverDetails] = useState<AdminDriver | null>(null)
  const [driverAssignment, setDriverAssignment] = useState<AdminDriverAssignment | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
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

  const viewDriverDetails = (user: UserRecord) => {
    const driverId = Number(user.uid)
    setActionMenu(null)
    setDetailsUser(user)
    setDriverDetails(null)
    setDriverAssignment(null)
    setDetailsError(null)
    if (!Number.isInteger(driverId)) {
      setDetailsError('This driver does not have a valid account ID.')
      return
    }
    setDetailsLoading(true)
    Promise.all([fetchAdminDriver(driverId), fetchAdminDriverAssignment(driverId)])
      .then(([driver, assignment]) => {
        setDriverDetails(driver)
        setDriverAssignment(assignment)
      })
      .catch((requestError) => {
        setDetailsError(requestError instanceof Error ? requestError.message : 'Could not load driver details.')
      })
      .finally(() => setDetailsLoading(false))
  }

  const viewDriverEarnings = (user: UserRecord) => {
    const driverId = Number(user.uid)
    setActionMenu(null)
    setEarningsUser(user)
    setEarnings(null)
    setEarningsError(null)
    if (!Number.isInteger(driverId)) {
      setEarningsError('This driver does not have a valid account ID.')
      return
    }
    setEarningsLoading(true)
    fetchAdminDriverEarnings(driverId)
      .then(setEarnings)
      .catch((requestError) => {
        setEarningsError(requestError instanceof Error ? requestError.message : 'Could not load driver earnings.')
      })
      .finally(() => setEarningsLoading(false))
  const openUserChat = (user: UserRecord) => {
    const path = getAdminChatPath(user.uid, user.role)
    if (path) navigate(path)
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4 md:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Users Management</h1>
          <p className="mt-1 text-sm text-[#64748b]">Live passenger, driver, and corporate accounts from TrackNGo.</p>
        </div>
        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 md:w-auto md:gap-3">
          <button type="button" onClick={() => navigate('/dashboard/passenger')} className="rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold transition hover:bg-[#f1f5f9] text-[#3156c2]">Passenger</button>
          <button type="button" onClick={() => navigate('/dashboard/driver')} className="rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold transition hover:bg-[#f1f5f9] text-[#0f766e]">Driver</button>
          <button type="button" onClick={() => navigate('/dashboard/corporate')} className="rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold transition hover:bg-[#f1f5f9] text-[#7e22ce]">Corporate</button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9]"><FontAwesomeIcon icon={faDownload} className="text-xs" />Export Users</button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, phone..." className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition placeholder:text-[#94a3b8] focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]" />
        </div>
        <div className="relative">
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'All' | Role)} className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155] outline-none transition focus:border-[#2642a6]"><option value="All">All Roles</option><option value="Passenger">Passenger</option><option value="Driver">Driver</option><option value="Corporate">Corporate</option></select>
          <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All Status' | Status)} className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155] outline-none transition focus:border-[#2642a6]"><option value="All Status">All Status</option><option value="Active">Active</option><option value="Suspended">Suspended</option><option value="Inactive">Inactive</option><option value="Pending">Pending</option><option value="On Leave">On Leave</option></select>
          <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-3 py-2">
          <FontAwesomeIcon icon={faCalendarDays} className="text-sm text-[#94a3b8]" />
          <input type="date" value={registrationDate} onChange={(event) => setRegistrationDate(event.target.value)} className="border-none bg-transparent text-sm text-[#334155] outline-none" aria-label="Registration Date" />
        </div>
        <button type="button" onClick={clearFilters} className="px-1 text-sm font-semibold text-[#64748b] transition hover:text-[#334155]">Clear All</button>
      </div>

      {statusActionError ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{statusActionError}</p> : null}

      <article className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-[#e5e7eb] bg-[#f9fbff] text-left text-xs font-semibold uppercase tracking-wide text-[#64748b]"><tr><th className="py-3 pl-5 pr-4">User</th><th className="px-4 py-3">Contact Info</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#64748b]"><FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />Loading users...</td></tr>}
              {!loading && error && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#dc2626]">{error}</td></tr>}
              {!loading && !error && visibleUsers.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#64748b]">No users match the selected filters.</td></tr>}
              {!loading && !error && visibleUsers.map((user) => (
                <tr key={user.uid} className="border-b border-[#e5e7eb] bg-white text-sm transition hover:bg-[#f8fafc]"><td className="py-3 pl-5 pr-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#dbeafe] text-xs font-semibold text-[#1e3a8a]">{user.avatar}</div><div><p className="font-semibold text-[#111827]">{user.name}{user.verified ? <span className="ml-2 text-[#2563eb]" title="Email verified">✓</span> : null}</p><div className="mt-1 flex flex-wrap items-center gap-2"><p className="text-xs text-[#64748b]">ID: {user.idTag}</p>{getAdminChatPath(user.uid, user.role) ? <button type="button" onClick={() => openUserChat(user)} className="inline-flex items-center gap-1 rounded-md border border-[#d6dbe6] bg-white px-2 py-1 text-xs font-semibold text-[#2642a6] transition hover:bg-[#eef2ff]" aria-label={`Chat with ${user.name}`}><FontAwesomeIcon icon={faComments} className="text-[10px]" />Chat</button> : null}</div></div></div></td><td className="px-4 py-3"><p className="text-[#334155]">{user.email}</p><p className="text-xs text-[#64748b]">{user.phone}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${roleBadgeClass(user.role)}`}>{user.role}</span></td><td className="px-4 py-3"><span className="inline-flex items-center gap-2 text-[#334155]"><span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(user.status)}`} />{user.status}</span></td><td className="px-4 py-3 text-[#334155]">{formatDate(user.joinedAt)}</td><td className="px-4 py-3 text-right text-[#94a3b8]"><button type="button" onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setActionMenu((current) => current?.userId === user.uid ? null : { userId: user.uid, top: rect.bottom + 6, right: Math.max(12, window.innerWidth - rect.right) }) }} className="rounded p-2 hover:bg-[#eef2f8]" aria-label={`Actions for ${user.name}`} aria-expanded={actionMenu?.userId === user.uid}><FontAwesomeIcon icon={faEllipsisVertical} /></button></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3 text-sm"><p className="text-[#334155]">Showing <span className="font-semibold text-[#111827]">{firstVisible}-{lastVisible} of {filteredUsers.length}</span></p><div className="flex items-center gap-3 text-[#334155]"><span>Rows per page: {pageSize}</span><div className="inline-flex overflow-hidden rounded-md border border-[#d6dbe6]"><button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="grid h-8 w-8 place-items-center bg-white text-[#334155] disabled:text-[#cbd5e1]" aria-label="Previous page"><FontAwesomeIcon icon={faChevronLeft} /></button><span className="grid h-8 min-w-8 place-items-center bg-[#2642a6] px-2 text-white">{page} / {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="grid h-8 w-8 place-items-center bg-white text-[#334155] disabled:text-[#cbd5e1]" aria-label="Next page"><FontAwesomeIcon icon={faChevronRight} /></button></div></div></div>
      </article>

      {actionMenu ? (() => {
        const actionUser = users.find((user) => user.uid === actionMenu.userId)
        if (!actionUser) return null
        const nextStatus: AdminUserStatus = actionUser.status === 'Active' ? 'suspended' : 'active'
        const isUpdating = updatingUserId === actionUser.uid
        return <div className="fixed z-50 w-56 overflow-hidden rounded-xl border border-[#d6dbe6] bg-white p-1.5 shadow-xl" style={{ top: actionMenu.top, right: actionMenu.right }} onPointerDown={(event) => event.stopPropagation()}>
          {actionUser.role === 'Driver' ? (
            <>
              <p className="px-3 pb-1.5 pt-2 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Driver</p>
              <button type="button" onClick={() => viewDriverDetails(actionUser)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#334155] hover:bg-[#f1f5f9]">
                <FontAwesomeIcon icon={faIdCard} className="w-4" />
                View driver details
              </button>
              <button type="button" onClick={() => viewDriverEarnings(actionUser)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#334155] hover:bg-[#f1f5f9]">
                <FontAwesomeIcon icon={faSackDollar} className="w-4" />
                View earnings
              </button>
            </>
          ) : null}
          <p className="px-3 pb-1.5 pt-2 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Account status</p>
          <button type="button" disabled={isUpdating} onClick={() => void changeUserStatus(actionUser, nextStatus)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${nextStatus === 'suspended' ? 'text-[#b91c1c] hover:bg-red-50' : 'text-[#047857] hover:bg-emerald-50'}`}>
            <FontAwesomeIcon icon={nextStatus === 'suspended' ? faBan : faCircleCheck} className="w-4" />
            {isUpdating ? 'Updating...' : nextStatus === 'suspended' ? 'Suspend user' : 'Reactivate user'}
          </button>
        </div>
      })() : null}

      {earningsUser ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setEarningsUser(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#111827]">{earningsUser.name}&apos;s earnings</h2>
                <p className="text-xs text-[#64748b]">ID: {earningsUser.idTag}</p>
              </div>
              <button type="button" onClick={() => setEarningsUser(null)} className="rounded p-2 text-[#64748b] hover:bg-[#f1f5f9]" aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button>
            </div>

            {earningsLoading ? <p className="mt-6 text-center text-sm text-[#64748b]"><FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />Loading earnings...</p> : null}
            {!earningsLoading && earningsError ? <p className="mt-6 text-center text-sm text-[#dc2626]">{earningsError}</p> : null}

            {!earningsLoading && !earningsError && earnings ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-[#f0fdf4] p-3"><p className="text-xs font-semibold text-[#166534]">Total</p><p className="mt-1 text-sm font-bold text-[#111827]">LKR {earnings.totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p></div>
                  <div className="rounded-xl bg-[#eff6ff] p-3"><p className="text-xs font-semibold text-[#1d4ed8]">This month</p><p className="mt-1 text-sm font-bold text-[#111827]">LKR {earnings.monthlyEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p></div>
                  <div className="rounded-xl bg-[#fefce8] p-3"><p className="text-xs font-semibold text-[#a16207]">This week</p><p className="mt-1 text-sm font-bold text-[#111827]">LKR {earnings.weeklyEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p></div>
                  <div className="rounded-xl bg-[#f5f3ff] p-3"><p className="text-xs font-semibold text-[#6d28d9]">Vs last week</p><p className={`mt-1 text-sm font-bold ${earnings.percentageChange < 0 ? 'text-[#b91c1c]' : 'text-[#047857]'}`}>{earnings.percentageChange > 0 ? '+' : ''}{earnings.percentageChange.toFixed(1)}%</p></div>
                </div>

                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Recent trips</p>
                {earnings.earnings.length === 0 ? (
                  <p className="mt-2 text-sm text-[#64748b]">No completed, paid trips yet.</p>
                ) : (
                  <div className="mt-2 divide-y divide-[#e5e7eb] overflow-hidden rounded-xl border border-[#e5e7eb]">
                    {earnings.earnings.slice(0, 10).map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                        <div>
                          <p className="font-semibold text-[#111827]">{item.route}</p>
                          <p className="text-xs text-[#64748b]">{item.bookingReference} · {item.date}</p>
                        </div>
                        <p className="font-semibold text-[#047857]">LKR {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {detailsUser ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setDetailsUser(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#111827]">{detailsUser.name}&apos;s details</h2>
                <p className="text-xs text-[#64748b]">ID: {detailsUser.idTag}</p>
              </div>
              <button type="button" onClick={() => setDetailsUser(null)} className="rounded p-2 text-[#64748b] hover:bg-[#f1f5f9]" aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button>
            </div>

            {detailsLoading ? <p className="mt-6 text-center text-sm text-[#64748b]"><FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />Loading driver details...</p> : null}
            {!detailsLoading && detailsError ? <p className="mt-6 text-center text-sm text-[#dc2626]">{detailsError}</p> : null}

            {!detailsLoading && !detailsError && driverDetails ? (
              <>
                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Professional details</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <DetailField label="License number" value={driverDetails.licenseNumber} />
                  <DetailField label="License expiry" value={formatDate(driverDetails.licenceExpiry)} />
                  <DetailField label="Years of experience" value={String(driverDetails.yearsOfExperience)} />
                  <DetailField label="Average rating" value={`${driverDetails.averageRating.toFixed(1)} / 5`} />
                  <DetailField label="Completed trips" value={String(driverDetails.driverTrips)} />
                  <DetailField label="Joined" value={formatDate(driverDetails.joinedDate)} />
                  <DetailField label="Bank" value={driverDetails.bankName || '—'} />
                  <DetailField label="Account number" value={driverDetails.accountNumber || '—'} />
                  <DetailField label="Email verified" value={driverDetails.isVerified ? 'Yes' : 'No'} />
                  <DetailField label="Phone verified" value={driverDetails.isPhoneVerified ? 'Yes' : 'No'} />
                </div>

                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Current assignment</p>
                {driverAssignment ? (
                  <div className="mt-2 rounded-xl border border-[#e5e7eb] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-[#111827]">{driverAssignment.busNumber} · {driverAssignment.busBrand || 'Unknown brand'}</p>
                      <span className="rounded-full bg-[#eef2f8] px-2.5 py-0.5 text-xs font-bold capitalize text-[#334155]">{driverAssignment.status || 'unknown'}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#64748b]">{driverAssignment.routeName || 'No route assigned'} · {driverAssignment.registrationNumber}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <DetailField label="Outbound" value={formatScheduleRange(driverAssignment.startTime, driverAssignment.endTime)} />
                      <DetailField label="Return" value={formatScheduleRange(driverAssignment.returnStartTime, driverAssignment.returnEndTime)} />
                      <DetailField label="Seat capacity" value={String(driverAssignment.seatCapacity)} />
                      <DetailField label="Bus type" value={driverAssignment.busType || '—'} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[#64748b]">Not currently assigned to a bus.</p>
                )}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#94a3b8]">{label}</p>
      <p className="text-sm font-semibold text-[#111827]">{value || '—'}</p>
    </div>
  )
}

function formatScheduleRange(start: string | null, end: string | null) {
  if (!start && !end) return 'Not scheduled'
  const trim = (t: string) => t.slice(0, 5)
  return `${start ? trim(start) : '—'} - ${end ? trim(end) : '—'}`
}

export default Users
