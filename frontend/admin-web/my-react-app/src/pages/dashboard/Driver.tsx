import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft, faBus, faChevronDown, faChevronLeft, faChevronRight,
  faFloppyDisk, faPen, faPlus, faSearch, faSpinner, faStar, faTrash, faUser, faXmark,
} from '@fortawesome/free-solid-svg-icons'
import {
  createAdminDriver, deleteAdminDriverProfilePicture, fetchAdminDrivers, updateAdminDriver,
  validateAdminDriverRequest, type AdminDriver, type SaveAdminDriverRequest,
} from '../../services/driverService'

type Tab = 'all' | 'verified' | 'not-verified'
type Driver = AdminDriver & { name: string; initials: string }
type DriverForm = SaveAdminDriverRequest

function today() { return new Date().toISOString().slice(0, 10) }
function defaultExpiry() { const date = new Date(); date.setFullYear(date.getFullYear() + 1); return date.toISOString().slice(0, 10) }
function emptyForm(): DriverForm {
  return { firstName: '', lastName: '', email: '', password: '', phoneNumber: '', licenseNumber: '', licenceExpiry: defaultExpiry(), yearsOfExperience: 0, accountNumber: '', bankName: '', status: 'active', isVerified: false, isPhoneVerified: false, joinedDate: today() }
}
function mapDriver(driver: AdminDriver): Driver {
  const name = [driver.firstName, driver.lastName].filter(Boolean).join(' ').trim() || driver.email
  return { ...driver, name, initials: name.split(/\s+/).map((part) => part[0] ?? '').slice(0, 2).join('').toUpperCase() }
}
function formFromDriver(driver: Driver): DriverForm {
  return { firstName: driver.firstName, lastName: driver.lastName ?? '', email: driver.email, password: '', phoneNumber: driver.phoneNumber, licenseNumber: driver.licenseNumber, licenceExpiry: driver.licenceExpiry, yearsOfExperience: driver.yearsOfExperience, accountNumber: driver.accountNumber ?? '', bankName: driver.bankName ?? '', status: driver.status, isVerified: driver.isVerified, isPhoneVerified: driver.isPhoneVerified, joinedDate: driver.joinedDate ?? today(), profilePhoto: driver.profilePhoto }
}
function statusLabel(status: string) { return status === 'on_leave' ? 'On leave' : status.charAt(0).toUpperCase() + status.slice(1) }
function statusBadge(status: string) { return status === 'active' ? 'bg-[#dcfce7] text-[#047857]' : status === 'on_leave' ? 'bg-[#fef3c7] text-[#b45309]' : 'bg-[#fee2e2] text-[#dc2626]' }

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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<DriverForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [removingPhoto, setRemovingPhoto] = useState(false)
  const [formError, setFormError] = useState('')
  const pageSize = 10

  async function loadDrivers() {
    try { setLoading(true); setError(null); setDrivers((await fetchAdminDrivers()).map(mapDriver)) }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not load drivers') }
    finally { setLoading(false) }
  }
  useEffect(() => { void loadDrivers() }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return drivers.filter((driver) => {
      if (tab === 'verified' && !driver.isVerified) return false
      if (tab === 'not-verified' && driver.isVerified) return false
      if (query && !driver.name.toLowerCase().includes(query) && !driver.licenseNumber.toLowerCase().includes(query) && !driver.phoneNumber.includes(query)) return false
      if (busFilter === 'Assigned' && !driver.assignedBus) return false
      if (busFilter === 'Unassigned' && driver.assignedBus) return false
      if (experience === '0-2' && driver.yearsOfExperience > 2) return false
      if (experience === '3-5' && (driver.yearsOfExperience < 3 || driver.yearsOfExperience > 5)) return false
      if (experience === '6+' && driver.yearsOfExperience < 6) return false
      return minRating === 0 || driver.averageRating >= minRating
    })
  }, [busFilter, drivers, experience, minRating, search, tab])
  useEffect(() => { setPage(1) }, [busFilter, experience, minRating, search, tab])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const tabs: { key: Tab; label: string }[] = [{ key: 'all', label: 'All Drivers' }, { key: 'verified', label: 'Verified' }, { key: 'not-verified', label: 'Not Verified' }]

  function updateField<K extends keyof DriverForm>(field: K, value: DriverForm[K]) { setDraft((current) => ({ ...current, [field]: value })) }
  function openCreate() { setEditingId(null); setDraft(emptyForm()); setFormError(''); setIsModalOpen(true) }
  function openEdit(driver: Driver) { setEditingId(driver.id); setDraft(formFromDriver(driver)); setFormError(''); setIsModalOpen(true) }

  async function saveDriver() {
    setFormError('')
    const validationError = validateAdminDriverRequest(draft, !editingId)
    if (validationError) { setFormError(`${validationError.field}: ${validationError.message}`); return }
    try {
      setSaving(true)
      const saved = editingId ? await updateAdminDriver(editingId, draft) : await createAdminDriver(draft)
      const mapped = mapDriver(saved)
      setDrivers((current) => editingId ? current.map((driver) => driver.id === editingId ? mapped : driver) : [mapped, ...current])
      setIsModalOpen(false)
    } catch (saveError) { setFormError(saveError instanceof Error ? saveError.message : 'Could not save driver') }
    finally { setSaving(false) }
  }

  async function removeDriverPhoto() {
    if (!editingId) return
    if (!window.confirm('Remove this driver profile picture? This cannot be undone.')) return
    setFormError('')
    try {
      setRemovingPhoto(true)
      await deleteAdminDriverProfilePicture(editingId)
      setDraft((current) => ({ ...current, profilePhoto: null }))
      setDrivers((current) => current.map((driver) => driver.id === editingId ? { ...driver, profilePhoto: null } : driver))
    } catch (removeError) { setFormError(removeError instanceof Error ? removeError.message : 'Could not remove the profile picture') }
    finally { setRemovingPhoto(false) }
  }

  return <section className="mx-auto w-full max-w-7xl space-y-5">
    <button type="button" onClick={() => navigate('/dashboard/users')} className="grid h-9 w-9 place-items-center rounded-lg border border-[#d6dbe6] bg-white text-[#334155] hover:bg-[#f1f5f9]"><FontAwesomeIcon icon={faArrowLeft} /></button>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Driver Management</h1><p className="mt-1 text-sm text-[#64748b]">Create and maintain the driver accounts used by the driver app.</p></div><button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#203b96]"><FontAwesomeIcon icon={faPlus} /> Add driver</button></header>
    <article className="rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
      <div className="border-b border-[#e5e7eb] px-5 pt-4"><nav className="-mb-px flex gap-6">{tabs.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`border-b-2 pb-2.5 text-sm font-semibold ${tab === item.key ? 'border-[#2642a6] text-[#2642a6]' : 'border-transparent text-[#64748b]'}`}>{item.label}</button>)}</nav></div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e7eb] px-5 py-3"><div className="relative min-w-[220px] flex-1"><FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, license number, or phone" className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]" /></div><label className="relative"><select value={busFilter} onChange={(event) => setBusFilter(event.target.value)} className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155]"><option value="All">Assignment Bus</option><option value="Assigned">Assigned</option><option value="Unassigned">Unassigned</option></select><FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" /></label><label className="relative"><select value={experience} onChange={(event) => setExperience(event.target.value)} className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155]"><option value="All">Experience</option><option value="0-2">0-2 years</option><option value="3-5">3-5 years</option><option value="6+">6+ years</option></select><FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" /></label><div className="flex items-center gap-2 rounded-lg border border-[#d6dbe6] px-3 py-2"><span className="text-sm text-[#64748b]">Rating: {minRating > 0 ? `${minRating}+` : 'All'}</span><input type="range" min={0} max={5} step={0.5} value={minRating} onChange={(event) => setMinRating(Number(event.target.value))} className="h-1.5 w-24 accent-[#2642a6]" /></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead><tr className="border-b border-[#e5e7eb] text-left text-xs font-semibold uppercase tracking-wide text-[#64748b]"><th className="py-3 pl-5 pr-2">Driver Details</th><th className="px-2 py-3">License / Phone</th><th className="px-2 py-3">Assignment</th><th className="px-2 py-3">Stats</th><th className="px-2 py-3">Status</th><th className="px-2 py-3 text-right">Actions</th></tr></thead><tbody>{loading && <tr><td colSpan={6} className="py-10 text-center text-sm text-[#64748b]"><FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />Loading drivers...</td></tr>}{!loading && error && <tr><td colSpan={6} className="py-10 text-center text-sm text-red-600">{error}</td></tr>}{!loading && !error && visible.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-sm text-[#64748b]">No drivers match your filters.</td></tr>}{!loading && !error && visible.map((driver) => <tr key={driver.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]"><td className="py-3.5 pl-5 pr-2"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#e0e7ff] text-xs font-bold text-[#3b5998]">{driver.initials}</div><div><p className="font-semibold text-[#111827]">{driver.name}</p><p className="text-xs text-[#94a3b8]">ID: #DRV-{driver.id}</p></div></div></td><td className="px-2 py-3.5"><p className="font-semibold text-[#111827]">{driver.licenseNumber}</p><p className="text-xs text-[#94a3b8]">{driver.phoneNumber}</p></td><td className="px-2 py-3.5"><FontAwesomeIcon icon={faBus} className="mr-1.5 text-xs text-[#94a3b8]" />{driver.assignedBus ?? 'Unassigned'}</td><td className="px-2 py-3.5">{driver.averageRating > 0 && <div className="flex items-center gap-1"><FontAwesomeIcon icon={faStar} className="text-xs text-[#eab308]" /><span className="font-semibold">{driver.averageRating.toFixed(1)}</span></div>}<p className="text-xs text-[#94a3b8]">{driver.yearsOfExperience}yr Exp · {driver.driverTrips.toLocaleString()} Trips</p></td><td className="px-2 py-3.5"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadge(driver.status)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabel(driver.status)}</span></td><td className="px-2 py-3.5 text-right"><button type="button" onClick={() => openEdit(driver)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d6dbe6] px-3 py-2 text-xs font-semibold text-[#334155] hover:bg-[#eef2ff] hover:text-[#2642a6]"><FontAwesomeIcon icon={faPen} /> Edit</button></td></tr>)}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-5 py-3 text-sm text-[#64748b]"><span>Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} drivers</span><div className="flex items-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-[#d6dbe6] px-3 py-2 disabled:opacity-40"><FontAwesomeIcon icon={faChevronLeft} /></button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-[#d6dbe6] px-3 py-2 disabled:opacity-40"><FontAwesomeIcon icon={faChevronRight} /></button></div></div>
    </article>
    {isModalOpen ? <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#101426]/50 p-3 sm:items-center sm:p-4"><div className="my-2 flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#d6dbe6] bg-white shadow-[0_28px_80px_rgba(17,27,52,0.32)] sm:my-6 sm:max-h-[calc(100vh-3rem)]"><div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-4 py-4 sm:px-6"><div className="min-w-0 pr-3"><h2 className="text-lg font-extrabold text-[#111827]">{editingId ? 'Edit driver' : 'Create driver account'}</h2><p className="mt-1 text-sm text-[#64748b]">These values are stored in the driver account used by the mobile app.</p></div><button type="button" onClick={() => setIsModalOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#64748b] hover:bg-white" aria-label="Close driver form"><FontAwesomeIcon icon={faXmark} /></button></div><div className="min-h-0 flex-1 overflow-y-auto"><div className="grid gap-4 px-4 py-5 sm:px-6 md:grid-cols-2"><label className="text-sm font-semibold text-[#334155]">First name<input value={draft.firstName} onChange={(event) => updateField('firstName', event.target.value)} className="form-input" /></label><label className="text-sm font-semibold text-[#334155]">Last name<input value={draft.lastName} onChange={(event) => updateField('lastName', event.target.value)} className="form-input" /></label><label className="text-sm font-semibold text-[#334155]">Email<input type="email" value={draft.email} onChange={(event) => updateField('email', event.target.value)} className="form-input" /></label><label className="text-sm font-semibold text-[#334155]">{editingId ? 'Reset password (optional)' : 'Initial password'}<input type="password" value={draft.password ?? ''} onChange={(event) => updateField('password', event.target.value)} className="form-input" placeholder={editingId ? 'Leave blank to keep current' : ''} /></label><label className="text-sm font-semibold text-[#334155]">Phone number<input inputMode="numeric" maxLength={10} value={draft.phoneNumber} onChange={(event) => updateField('phoneNumber', event.target.value.replace(/\D/g, '').slice(0, 10))} className="form-input" placeholder="0XXXXXXXXX" /></label><label className="text-sm font-semibold text-[#334155]">License number<input maxLength={8} value={draft.licenseNumber} onChange={(event) => updateField('licenseNumber', event.target.value.toUpperCase().replace(/[^B0-9]/g, '').slice(0, 8))} className="form-input" placeholder="B1234567" /></label><label className="text-sm font-semibold text-[#334155]">License expiry<input type="date" value={draft.licenceExpiry} onChange={(event) => updateField('licenceExpiry', event.target.value)} className="form-input" /></label><label className="text-sm font-semibold text-[#334155]">Joined date<input type="date" value={draft.joinedDate} onChange={(event) => updateField('joinedDate', event.target.value)} className="form-input" /></label><label className="text-sm font-semibold text-[#334155]">Years of experience<input type="number" min={0} value={draft.yearsOfExperience} onChange={(event) => updateField('yearsOfExperience', Number(event.target.value))} className="form-input" /></label><label className="text-sm font-semibold text-[#334155]">Status<select value={draft.status} onChange={(event) => updateField('status', event.target.value)} className="form-input"><option value="active">Active</option><option value="on_leave">On leave</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select></label><label className="text-sm font-semibold text-[#334155]">Bank account number<input value={draft.accountNumber} onChange={(event) => updateField('accountNumber', event.target.value)} className="form-input" /></label><label className="text-sm font-semibold text-[#334155]">Bank name<input value={draft.bankName} onChange={(event) => updateField('bankName', event.target.value)} className="form-input" /></label><label className="inline-flex items-center gap-2 text-sm font-semibold text-[#334155]"><input type="checkbox" checked={draft.isVerified} onChange={(event) => updateField('isVerified', event.target.checked)} className="h-4 w-4 accent-[#2642a6]" /> License verified</label><label className="inline-flex items-center gap-2 text-sm font-semibold text-[#334155]"><input type="checkbox" checked={draft.isPhoneVerified} onChange={(event) => updateField('isPhoneVerified', event.target.checked)} className="h-4 w-4 accent-[#2642a6]" /> Phone verified</label>{editingId ? <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4 md:col-span-2"><div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#e0e7ff] text-[#3b5998] shadow-[0_0_0_1px_#cfd8f5]">{draft.profilePhoto ? <img src={draft.profilePhoto} alt="" className="h-full w-full object-cover" /> : <FontAwesomeIcon icon={faUser} />}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#334155]">Profile picture</p><p className="mt-0.5 text-xs text-[#64748b]">{draft.profilePhoto ? 'Drivers cannot change their own picture, so it is removed from here.' : 'This driver has no profile picture.'}</p></div>{draft.profilePhoto ? <button type="button" onClick={() => void removeDriverPhoto()} disabled={removingPhoto} className="inline-flex items-center gap-2 rounded-lg border border-[#fecaca] bg-white px-3 py-2 text-xs font-semibold text-[#dc2626] transition hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60"><FontAwesomeIcon icon={removingPhoto ? faSpinner : faTrash} className={removingPhoto ? 'animate-spin' : ''} />{removingPhoto ? 'Removing...' : 'Remove photo'}</button> : null}</div> : null}</div></div><div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[#e5e7eb] px-4 py-4 sm:px-6">{formError ? <p className="mr-auto min-w-0 basis-full text-sm font-semibold text-[#d14343] sm:basis-auto">{formError}</p> : null}<button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-[#d6dbe6] bg-white px-5 py-2 text-sm font-semibold text-[#334155]">Cancel</button><button type="button" onClick={() => void saveDriver()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"><FontAwesomeIcon icon={saving ? faSpinner : faFloppyDisk} className={saving ? 'animate-spin' : ''} />{saving ? 'Saving...' : editingId ? 'Save changes' : 'Create driver'}</button></div></div></div> : null}
  </section>
}

export default Driver
