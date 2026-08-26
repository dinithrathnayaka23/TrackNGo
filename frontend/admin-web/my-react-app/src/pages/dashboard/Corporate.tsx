import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faBuildingUser, faChevronDown, faChevronLeft, faChevronRight, faClipboardCheck, faFileLines, faMagnifyingGlass, faMoneyBillWave, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { fetchAdminUsers, type AdminUser } from '../../services/userService'

type VerificationStatus = 'Verified' | 'Pending' | 'Suspended' | 'Inactive'
type CorporateClient = {
  id: string
  company: string
  regNo: string
  status: VerificationStatus
  contracts: number
  revenue: number
  manager: string
  role: string
  initials: string
}

function mapStatus(value: string | null | undefined): VerificationStatus {
  const status = String(value ?? '').toLowerCase()
  if (status === 'pending' || status === 'pending_verification') return 'Pending'
  if (status === 'suspended') return 'Suspended'
  if (status === 'inactive') return 'Inactive'
  return 'Verified'
}

function mapCorporate(user: AdminUser): CorporateClient {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Unknown contact'
  const company = user.companyName || name
  return { id: String(user.id ?? ''), company, regNo: user.businessRegistrationNumber || 'Not provided', status: mapStatus(user.status), contracts: Number(user.activeContracts ?? 0), revenue: Number(user.corporateRevenue ?? 0), manager: user.contactPersonName || name, role: user.contactPersonDesignation || 'Corporate contact', initials: company.split(/\s+/).map((part) => part[0] ?? '').slice(0, 2).join('').toUpperCase() || 'CO' }
}

function formatRevenue(value: number) {
  return `Rs.${Number.isFinite(value) ? value.toLocaleString('en-US') : '0'}`
}

function statusClass(status: VerificationStatus) {
  if (status === 'Verified') return 'bg-[#dcfce7] text-[#047857]'
  if (status === 'Pending') return 'bg-[#fef3c7] text-[#b45309]'
  if (status === 'Suspended') return 'bg-[#fee2e2] text-[#b91c1c]'
  return 'bg-[#f1f5f9] text-[#334155]'
}

function Corporate() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<CorporateClient[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'All' | VerificationStatus>('All')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 9

  useEffect(() => {
    let active = true
    fetchAdminUsers()
      .then((users) => active && setClients(users.filter((user) => String(user.userType ?? user.role ?? '').toLowerCase() === 'corporate').map(mapCorporate)))
      .catch((requestError) => active && setError(requestError instanceof Error ? requestError.message : 'Could not load corporate accounts'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return clients.filter((client) => {
      const matchesStatus = status === 'All' || client.status === status
      const matchesQuery = !normalizedQuery || client.company.toLowerCase().includes(normalizedQuery) || client.regNo.toLowerCase().includes(normalizedQuery) || client.manager.toLowerCase().includes(normalizedQuery)
      return matchesStatus && matchesQuery
    })
  }, [clients, query, status])

  useEffect(() => { setPage(1) }, [query, status])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const totalRevenue = clients.reduce((sum, client) => sum + client.revenue, 0)
  const pending = clients.filter((client) => client.status === 'Pending').length

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      <button type="button" onClick={() => navigate('/dashboard/users')} className="grid h-9 w-9 place-items-center rounded-lg border border-[#d6dbe6] bg-white text-[#334155] transition hover:bg-[#f1f5f9]"><FontAwesomeIcon icon={faArrowLeft} /></button>
      <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Corporate Accounts</h1><p className="mt-1 text-sm text-[#64748b]">Live corporate accounts, contracts, and billing totals from TrackNGo.</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => navigate('/dashboard/corporate/contracts')} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#2642a6] px-4 text-sm font-semibold text-white transition hover:bg-[#203b96]">Contract Requests</button><button type="button" onClick={() => navigate('/dashboard/corporate/pricing-settings')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9]">Pricing Settings</button></div></header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4"><div><p className="text-sm text-[#64748b] font-semibold">Total Clients</p><p className="mt-1 text-2xl font-extrabold text-[#111827]">{clients.length}</p></div><div className="grid h-10 w-10 place-items-center rounded-lg bg-[#f1f5f9] text-[#334155]"><FontAwesomeIcon icon={faBuildingUser} /></div></article><article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4"><div><p className="text-sm text-[#64748b] font-semibold">Contract Revenue</p><p className="mt-1 text-2xl font-extrabold text-[#0f766e]">{formatRevenue(totalRevenue)}</p></div><div className="grid h-10 w-10 place-items-center rounded-lg bg-[#dcfce7] text-[#0f766e]"><FontAwesomeIcon icon={faMoneyBillWave} /></div></article><article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4"><div><p className="text-sm text-[#64748b] font-semibold">Pending Verifications</p><p className="mt-1 text-2xl font-extrabold text-[#f59e0b]">{pending}</p></div><div className="grid h-10 w-10 place-items-center rounded-lg bg-[#fef3c7] text-[#f59e0b]"><FontAwesomeIcon icon={faClipboardCheck} /></div></article></div>
      <div className="flex flex-wrap items-center gap-3"><div className="relative min-w-[220px] flex-1"><FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by company, registration no, or manager" className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition placeholder:text-[#94a3b8] focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]" /></div><div className="relative"><select value={status} onChange={(event) => setStatus(event.target.value as 'All' | VerificationStatus)} className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155] outline-none transition focus:border-[#2642a6]"><option value="All">All Statuses</option><option value="Verified">Verified</option><option value="Pending">Pending</option><option value="Suspended">Suspended</option><option value="Inactive">Inactive</option></select><FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" /></div><button type="button" onClick={() => { setQuery(''); setStatus('All') }} className="px-1 text-sm font-semibold text-[#64748b] transition hover:text-[#334155]">Clear Filters</button></div>
      {loading && <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-12 text-center text-sm text-[#64748b]"><FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />Loading corporate accounts...</div>}
      {!loading && error && <div className="rounded-2xl border border-red-200 bg-white px-4 py-12 text-center text-sm text-red-600">{error}</div>}
      {!loading && !error && visible.length === 0 && <div className="rounded-2xl border border-dashed border-[#d6dbe6] bg-white px-4 py-12 text-center text-sm text-[#64748b]">No corporate accounts match your filters.</div>}
      {!loading && !error && visible.length > 0 && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((client) => <article key={client.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,23,42,0.12)]"><div className="flex-1 p-5"><div className="flex items-start justify-between gap-3"><div className="grid h-14 w-14 place-items-center rounded-md border border-[#d6dbe6] bg-[#f8fafc] text-sm font-bold text-[#334155]">{client.initials}</div><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusClass(client.status)}`}>{client.status}</span></div><h3 className="mt-4 text-sm font-bold text-[#111827]">{client.company}</h3><p className="mt-1 text-sm font-semibold tracking-wide text-[#64748b]">REG: {client.regNo}</p><div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#e5e7eb] pt-4"><div><p className="text-sm font-semibold text-[#64748b]"><FontAwesomeIcon icon={faFileLines} className="mr-2" />Contracts</p><p className="mt-1 text-sm font-bold text-[#111827]">{client.contracts} Active</p></div><div><p className="text-sm font-semibold text-[#64748b]"><FontAwesomeIcon icon={faMoneyBillWave} className="mr-2" />Revenue</p><p className="mt-1 text-sm font-bold text-[#0f766e]">{formatRevenue(client.revenue)}</p></div></div><div className="mt-4 flex items-center gap-3 border-t border-[#e5e7eb] pt-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#e5e7eb] text-sm font-semibold text-[#334155]">{client.manager.split(/\s+/).map((part) => part[0] ?? '').slice(0, 2).join('').toUpperCase()}</div><div><p className="text-sm font-semibold text-[#111827]">{client.manager}</p><p className="text-sm text-[#64748b]">{client.role}</p></div></div></div><div className="border-t border-[#e5e7eb] px-5 py-4"><button type="button" onClick={() => navigate(`/dashboard/corporate/${client.id}`)} className="text-sm font-semibold text-[#2642a6]">View Details</button></div></article>)}</div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#64748b]"><span>Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} corporate accounts</span><div className="flex items-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-[#d6dbe6] px-3 py-2 disabled:opacity-40"><FontAwesomeIcon icon={faChevronLeft} /></button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-[#d6dbe6] px-3 py-2 disabled:opacity-40"><FontAwesomeIcon icon={faChevronRight} /></button></div></div>
    </section>
  )
}

export default Corporate
