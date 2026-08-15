import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faBus, faChevronDown, faChevronLeft, faChevronRight, faSearch, faSpinner, faStar } from '@fortawesome/free-solid-svg-icons'
import { fetchAdminUsers, type AdminUser } from '../../services/userService'

type VerificationStatus = 'Verified' | 'Not Verified'
type Tab = 'all' | 'verified' | 'not-verified'
type Driver = {
  id: string
  driverId: string
  name: string
  initials: string
  licenseNo: string
  phone: string
  assignedBus: string | null
  rating: number | null
  years: number
  trips: number
  status: VerificationStatus
}

function mapDriver(user: AdminUser): Driver {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Unknown driver'
  const id = String(user.id ?? '')
  return { id, driverId: `#DRV-${id || 'UNKNOWN'}`, name, initials: name.split(/\s+/).map((part) => part[0] ?? '').slice(0, 2).join('').toUpperCase(), licenseNo: user.licenseNumber || 'Not provided', phone: user.phone || '-', assignedBus: user.assignedBus || null, rating: user.driverRating == null ? null : Number(user.driverRating), years: Number(user.yearsOfExperience ?? 0), trips: Number(user.driverTrips ?? 0), status: user.driverVerified ? 'Verified' : 'Not Verified' }
}

function statusBadge(status: VerificationStatus) {
  return status === 'Verified' ? 'bg-[#dcfce7] text-[#047857]' : 'bg-[#fee2e2] text-[#dc2626]'
}

function Driver() {
  const navigate = useNavigate()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [busFilter, setBusFilter] = useState('All')
  const [experience, setExperience] = useState('All')
  const [minRating, setMinRating] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 10

  useEffect(() => {
    let active = true
    fetchAdminUsers()
      .then((users) => active && setDrivers(users.filter((user) => String(user.userType ?? user.role ?? '').toLowerCase() === 'driver').map(mapDriver)))
      .catch((requestError) => active && setError(requestError instanceof Error ? requestError.message : 'Could not load drivers'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return drivers.filter((driver) => {
      if (tab === 'verified' && driver.status !== 'Verified') return false
      if (tab === 'not-verified' && driver.status !== 'Not Verified') return false
      if (query && !driver.name.toLowerCase().includes(query) && !driver.licenseNo.toLowerCase().includes(query) && !driver.phone.includes(query)) return false
      if (busFilter === 'Assigned' && !driver.assignedBus) return false
      if (busFilter === 'Unassigned' && driver.assignedBus) return false
      if (experience === '0-2' && driver.years > 2) return false
      if (experience === '3-5' && (driver.years < 3 || driver.years > 5)) return false
      if (experience === '6+' && driver.years < 6) return false
      return minRating === 0 || (driver.rating !== null && driver.rating >= minRating)
    })
  }, [busFilter, drivers, experience, minRating, search, tab])

  useEffect(() => { setPage(1) }, [busFilter, experience, minRating, search, tab])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const tabs: { key: Tab; label: string }[] = [{ key: 'all', label: 'All Drivers' }, { key: 'verified', label: 'Verified' }, { key: 'not-verified', label: 'Not Verified' }]

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      <button type="button" onClick={() => navigate('/dashboard/users')} className="grid h-9 w-9 place-items-center rounded-lg border border-[#d6dbe6] bg-white text-[#475569] hover:bg-[#f1f5f9]"><FontAwesomeIcon icon={faArrowLeft} /></button>
      <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Driver Management</h1><p className="mt-1 text-sm text-[#64748b]">Total Drivers: <span className="font-bold text-[#111827]">{drivers.length}</span></p></div><p className="text-sm text-[#64748b]">Live database records</p></header>
      <article className="rounded-xl border border-[#e5e7eb] bg-white">
        <div className="border-b border-[#e5e7eb] px-5 pt-4"><nav className="-mb-px flex gap-6">{tabs.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`border-b-2 pb-2.5 text-sm font-semibold ${tab === item.key ? 'border-[#2642a6] text-[#2642a6]' : 'border-transparent text-[#64748b]'}`}>{item.label}</button>)}</nav></div>
        <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e7eb] px-5 py-3"><div className="relative min-w-[220px] flex-1"><FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, license number, or phone" className="w-full rounded-lg border border-[#d6dbe6] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#2642a6]" /></div><label className="relative"><select value={busFilter} onChange={(event) => setBusFilter(event.target.value)} className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155]"><option value="All">Assignment Bus</option><option value="Assigned">Assigned</option><option value="Unassigned">Unassigned</option></select><FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" /></label><label className="relative"><select value={experience} onChange={(event) => setExperience(event.target.value)} className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155]"><option value="All">Experience</option><option value="0-2">0-2 years</option><option value="3-5">3-5 years</option><option value="6+">6+ years</option></select><FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" /></label><div className="flex items-center gap-2 rounded-lg border border-[#d6dbe6] px-3 py-2"><span className="text-sm text-[#64748b]">Rating: {minRating > 0 ? `${minRating}+` : 'All'}</span><input type="range" min={0} max={5} step={0.5} value={minRating} onChange={(event) => setMinRating(Number(event.target.value))} className="h-1.5 w-24 accent-[#2642a6]" /></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b border-[#e5e7eb] text-left text-xs font-semibold text-[#64748b]"><th className="py-3 pl-5 pr-2">Driver Details</th><th className="px-2 py-3">License / Phone</th><th className="px-2 py-3">Assignment</th><th className="px-2 py-3">Stats</th><th className="px-2 py-3">Status</th></tr></thead><tbody>{loading && <tr><td colSpan={5} className="py-10 text-center text-sm text-[#64748b]"><FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />Loading drivers...</td></tr>}{!loading && error && <tr><td colSpan={5} className="py-10 text-center text-sm text-red-600">{error}</td></tr>}{!loading && !error && visible.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-sm text-[#64748b]">No drivers match your filters.</td></tr>}{!loading && !error && visible.map((driver) => <tr key={driver.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]"><td className="py-3.5 pl-5 pr-2"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#e0e7ff] text-xs font-bold text-[#3b5998]">{driver.initials}</div><div><p className="font-semibold text-[#111827]">{driver.name}</p><p className="text-xs text-[#94a3b8]">ID: {driver.driverId}</p></div></div></td><td className="px-2 py-3.5"><p className="font-semibold text-[#111827]">{driver.licenseNo}</p><p className="text-xs text-[#94a3b8]">{driver.phone}</p></td><td className="px-2 py-3.5"><FontAwesomeIcon icon={faBus} className="mr-1.5 text-xs text-[#94a3b8]" />{driver.assignedBus ?? 'Unassigned'}</td><td className="px-2 py-3.5">{driver.rating !== null && <div className="flex items-center gap-1"><FontAwesomeIcon icon={faStar} className="text-xs text-[#eab308]" /><span className="font-semibold">{driver.rating.toFixed(1)}</span></div>}<p className="text-xs text-[#94a3b8]">{driver.years}yr Exp · {driver.trips.toLocaleString()} Trips</p></td><td className="px-2 py-3.5"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(driver.status)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{driver.status}</span></td></tr>)}</tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-5 py-3 text-sm text-[#64748b]"><span>Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} drivers</span><div className="flex items-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-[#d6dbe6] px-3 py-2 disabled:opacity-40"><FontAwesomeIcon icon={faChevronLeft} /></button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-[#d6dbe6] px-3 py-2 disabled:opacity-40"><FontAwesomeIcon icon={faChevronRight} /></button></div></div>
      </article>
    </section>
  )
}

export default Driver
