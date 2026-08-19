import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faBan,
  faBus,
  faCalendarDays,
  faCircleCheck,
  faClipboardList,
  faClock,
  faDollarSign,
  faEnvelope,
  faFileInvoiceDollar,
  faLocationDot,
  faMoneyBill,
  faPhone,
  faSpinner,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { fetchAdminUsers, updateAdminUserStatus, type AdminUser, type AdminUserStatus } from '../../services/userService'
import {
  fetchCorporateContracts,
  fetchCorporateInvoices,
  fetchCorporateProfile,
  type CorporateContract,
  type CorporateInvoice,
  type CorporateProfile,
} from '../../services/corporateService'

type Tab = 'overview' | 'contracts' | 'billing'

function cleanText(value: string | null | undefined) {
  return value?.trim() || 'Not available'
}

function displayName(profile: CorporateProfile, account: AdminUser) {
  return cleanText(profile.companyName || account.companyName || profile.fullName || account.email)
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'CO'
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not available'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not available'
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(parsed)
}

function formatTime(value: string | null) {
  if (!value) return 'Not set'
  return value.slice(0, 5)
}

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value ?? 0)
  return `Rs. ${Number.isFinite(amount) ? amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`
}

function label(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/_/g, ' ')
  if (!normalized) return 'Not available'
  return normalized.replace(/\b\w/g, (character) => character.toUpperCase())
}

function statusClass(value: string | null | undefined) {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized === 'active' || normalized === 'paid') return 'bg-[#dcfce7] text-[#047857]'
  if (normalized === 'pending' || normalized === 'pending_verification') return 'bg-[#fef3c7] text-[#b45309]'
  if (normalized === 'overdue' || normalized === 'suspended' || normalized === 'cancelled') return 'bg-[#fee2e2] text-[#b91c1c]'
  return 'bg-[#f1f5f9] text-[#334155]'
}

function ContractCard({ contract }: { contract: CorporateContract }) {
  return <article className="rounded-xl border border-[#e5e7eb] bg-white p-5">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-[#94a3b8]">Contract ID: #{contract.contractId}</p><h3 className="mt-1 truncate text-sm font-bold text-[#111827]">{cleanText(contract.contractName)}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(contract.status)}`}>{label(contract.status)}</span></div>
    <div className="mt-4 space-y-2 text-sm">
      <p className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-[#64748b]"><FontAwesomeIcon icon={faBus} className="w-3" />Bus allocation</span><span className="font-semibold text-[#111827]">{contract.busId ? `Bus #${contract.busId}` : 'Not assigned'}</span></p>
      <p className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-[#64748b]"><FontAwesomeIcon icon={faLocationDot} className="w-3" />Route</span><span className="max-w-[62%] text-right font-semibold text-[#111827]">{cleanText(contract.startingLocation)} → {cleanText(contract.destination)}</span></p>
      <p className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-[#64748b]"><FontAwesomeIcon icon={faCalendarDays} className="w-3" />Valid</span><span className="text-right font-semibold text-[#111827]">{formatDate(contract.startDate)} – {formatDate(contract.endDate)}</span></p>
      <p className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-[#64748b]"><FontAwesomeIcon icon={faClock} className="w-3" />Shift</span><span className="font-semibold text-[#111827]">{formatTime(contract.startShiftTime)} – {formatTime(contract.endShiftTime)}</span></p>
      <p className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-[#64748b]"><FontAwesomeIcon icon={faDollarSign} className="w-3" />Monthly</span><span className="font-semibold text-[#111827]">{formatCurrency(contract.billingAmount)}</span></p>
    </div>
  </article>
}

function InvoiceTable({ invoices }: { invoices: CorporateInvoice[] }) {
  if (invoices.length === 0) return <p className="mt-4 text-sm text-[#64748b]">No invoices are recorded for this corporate account.</p>
  return <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b border-[#e5e7eb] text-left text-xs font-semibold text-[#64748b]"><th className="pb-3">Invoice</th><th className="pb-3">Contract</th><th className="pb-3">Date</th><th className="pb-3">Due date</th><th className="pb-3">Amount</th><th className="pb-3">Status</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={`${invoice.contractId}-${invoice.invoiceNumber}`} className="border-b border-[#f1f5f9] last:border-0"><td className="py-3 font-semibold text-[#111827]">#{invoice.invoiceNumber}</td><td className="py-3 text-[#334155]">#{invoice.contractId}</td><td className="py-3 text-[#334155]">{formatDate(invoice.date)}</td><td className="py-3 text-[#334155]">{formatDate(invoice.dueDate)}</td><td className="py-3 font-semibold text-[#111827]">{formatCurrency(invoice.amount)}</td><td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(invoice.status)}`}>{label(invoice.status)}</span></td></tr>)}</tbody></table></div>
}

function CorporateDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [account, setAccount] = useState<AdminUser | null>(null)
  const [profile, setProfile] = useState<CorporateProfile | null>(null)
  const [contracts, setContracts] = useState<CorporateContract[]>([])
  const [invoices, setInvoices] = useState<CorporateInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)

  useEffect(() => {
    const userId = Number(id)
    if (!Number.isInteger(userId)) {
      setError('This corporate account has an invalid ID.')
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([fetchAdminUsers(), fetchCorporateProfile(userId), fetchCorporateContracts(userId), fetchCorporateInvoices(userId)])
      .then(([users, loadedProfile, loadedContracts, loadedInvoices]) => {
        if (!active) return
        const loadedAccount = users.find((user) => Number(user.id) === userId && String(user.userType ?? user.role ?? '').toLowerCase() === 'corporate')
        if (!loadedAccount) throw new Error('Corporate account not found.')
        setAccount(loadedAccount)
        setProfile(loadedProfile)
        setContracts(Array.isArray(loadedContracts) ? loadedContracts : [])
        setInvoices(Array.isArray(loadedInvoices) ? loadedInvoices : [])
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load corporate account details.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [id])

  const activeContracts = useMemo(() => contracts.filter((contract) => String(contract.status).toLowerCase() === 'active'), [contracts])
  const monthlyValue = useMemo(() => activeContracts.reduce((total, contract) => total + Number(contract.billingAmount || 0), 0), [activeContracts])
  const busesAllocated = useMemo(() => new Set(activeContracts.map((contract) => contract.busId).filter((busId): busId is number => busId !== null && busId !== undefined)).size, [activeContracts])

  const toggleStatus = async () => {
    if (!account?.id) return
    const nextStatus: AdminUserStatus = String(account.status).toLowerCase() === 'suspended' ? 'active' : 'suspended'
    setStatusUpdating(true)
    setStatusError(null)
    try {
      const updated = await updateAdminUserStatus(account.id, nextStatus)
      setAccount(updated)
    } catch (requestError) {
      setStatusError(requestError instanceof Error ? requestError.message : 'Could not update account status.')
    } finally {
      setStatusUpdating(false)
    }
  }

  if (loading) return <section className="mx-auto w-full max-w-[1280px] rounded-2xl border border-[#e5e7eb] bg-white px-5 py-16 text-center text-sm text-[#64748b]"><FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />Loading corporate account details...</section>
  if (error || !account || !profile) return <section className="mx-auto w-full max-w-[1280px] space-y-4 rounded-2xl border border-red-200 bg-white px-5 py-12 text-center"><p className="text-sm font-semibold text-red-700">{error || 'Corporate account details are unavailable.'}</p><button type="button" onClick={() => navigate('/dashboard/corporate')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#22449d]"><FontAwesomeIcon icon={faArrowLeft} />Back to Corporate Accounts</button></section>

  const company = displayName(profile, account)
  const contactName = cleanText(profile.contactPersonName || profile.fullName)
  const contactPhone = cleanText(profile.contactPhone || profile.phoneNumber)
  const contactEmail = cleanText(profile.email || account.email)
  const accountStatus = label(account.status)
  const tabs: Array<{ key: Tab; label: string }> = [{ key: 'overview', label: 'Overview' }, { key: 'contracts', label: 'Contracts' }, { key: 'billing', label: 'Billing' }]

  return <section className="mx-auto w-full max-w-[1280px] space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#e0e7ff] text-sm font-bold text-[#2642a6]">{initials(company)}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h1 className="truncate text-xl font-extrabold tracking-tight text-[#111827]">{company}</h1><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(account.status)}`}>{accountStatus}</span></div><p className="mt-1 text-sm text-[#64748b]">Corporate ID: #CORP-{account.id} <span className="mx-1">•</span> Created: {formatDate(account.joinedAt)}</p></div></div><div className="flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={() => navigate('/dashboard/corporate')} className="inline-flex items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold text-[#334155] hover:bg-[#f1f5f9]"><FontAwesomeIcon icon={faArrowLeft} className="text-xs" />Back</button><button type="button" disabled={statusUpdating} onClick={() => void toggleStatus()} className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${String(account.status).toLowerCase() === 'suspended' ? 'border-[#bbf7d0] bg-white text-[#047857] hover:bg-[#f0fdf4]' : 'border-[#fecaca] bg-white text-[#dc2626] hover:bg-[#fef2f2]'}`}><FontAwesomeIcon icon={String(account.status).toLowerCase() === 'suspended' ? faCircleCheck : faBan} className="text-xs" />{statusUpdating ? 'Updating...' : String(account.status).toLowerCase() === 'suspended' ? 'Reactivate Account' : 'Suspend Account'}</button></div></header>
    {statusError ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert"><FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />{statusError}</p> : null}
    <div className="border-b border-[#e5e7eb]"><nav className="-mb-px flex gap-6 overflow-x-auto">{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition ${activeTab === tab.key ? 'border-[#2642a6] text-[#2642a6]' : 'border-transparent text-[#64748b] hover:text-[#334155]'}`}>{tab.label}</button>)}</nav></div>

    {activeTab === 'overview' ? <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]"><article className="rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6"><h2 className="text-base font-bold text-[#111827]">Company Information</h2><div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2"><div><p className="text-xs font-medium text-[#94a3b8]">Registered Name</p><p className="mt-1 text-sm font-semibold text-[#111827]">{company}</p></div><div><p className="text-xs font-medium text-[#94a3b8]">Industry</p><p className="mt-1 text-sm font-semibold text-[#111827]">{cleanText(profile.industry)}</p></div><div><p className="text-xs font-medium text-[#94a3b8]">Address</p><p className="mt-1 text-sm font-semibold text-[#111827]"><FontAwesomeIcon icon={faLocationDot} className="mr-2 text-[#94a3b8]" />{cleanText(profile.address)}</p></div><div><p className="text-xs font-medium text-[#94a3b8]">Registration Number</p><p className="mt-1 text-sm font-semibold text-[#111827]">{cleanText(profile.businessRegistrationNumber)}</p></div></div><div className="mt-6 border-t border-[#e5e7eb] pt-5"><p className="text-sm font-bold text-[#111827]">Primary Contact</p><div className="mt-3 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[#e0e7ff] text-sm font-bold text-[#3b5998]">{initials(contactName)}</div><div><p className="text-sm font-semibold text-[#111827]">{contactName}</p><p className="text-xs text-[#64748b]">{cleanText(profile.contactPersonDesignation)}</p></div></div><div className="flex flex-wrap items-center gap-4 text-sm text-[#334155]"><span className="inline-flex items-center gap-1.5"><FontAwesomeIcon icon={faPhone} className="text-xs text-[#64748b]" />{contactPhone}</span><span className="inline-flex items-center gap-1.5 break-all"><FontAwesomeIcon icon={faEnvelope} className="text-xs text-[#64748b]" />{contactEmail}</span></div></div></div></article><article className="rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6"><h2 className="text-base font-bold text-[#111827]">Contracts Summary</h2><div className="mt-5 space-y-3"><div className="flex items-center gap-3 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-4 py-4"><div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e0e7ff] text-[#2642a6]"><FontAwesomeIcon icon={faClipboardList} /></div><div><p className="text-xs text-[#64748b]">Active Contracts</p><p className="text-xl font-extrabold text-[#111827]">{activeContracts.length}</p></div></div><button type="button" onClick={() => setActiveTab('contracts')} className="flex w-full items-center justify-between rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-4 py-4 text-left hover:bg-[#f1f5f9]"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#dbeafe] text-[#2563eb]"><FontAwesomeIcon icon={faBus} /></span><span><span className="block text-xs text-[#64748b]">Buses Allocated</span><span className="block text-xl font-extrabold text-[#111827]">{busesAllocated}</span></span></span><span className="text-sm font-semibold text-[#2642a6]">View Details</span></button><div className="flex items-center gap-3 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-4 py-4"><div className="grid h-10 w-10 place-items-center rounded-lg bg-[#dcfce7] text-[#16a34a]"><FontAwesomeIcon icon={faMoneyBill} /></div><div><p className="text-xs text-[#64748b]">Monthly Value</p><p className="text-xl font-extrabold text-[#111827]">{formatCurrency(monthlyValue)}</p></div></div></div></article></div>
      <div><div className="flex items-center justify-between gap-3"><h2 className="text-base font-bold text-[#111827]">Active Contracts</h2><button type="button" onClick={() => setActiveTab('contracts')} className="text-sm font-semibold text-[#2642a6] hover:text-[#1b357f]">View all contracts</button></div><div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{activeContracts.slice(0, 6).map((contract) => <ContractCard key={contract.contractId} contract={contract} />)}{activeContracts.length === 0 ? <p className="col-span-full rounded-xl border border-dashed border-[#d6dbe6] bg-white px-4 py-8 text-center text-sm text-[#64748b]">No active contracts are recorded for this account.</p> : null}</div></div>
      <article className="rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-base font-bold text-[#111827]">Latest Invoices</h2><button type="button" onClick={() => setActiveTab('billing')} className="text-sm font-semibold text-[#2642a6] hover:text-[#1b357f]">View all</button></div><InvoiceTable invoices={invoices.slice(0, 5)} /></article>
    </> : null}
    {activeTab === 'contracts' ? <div><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-[#111827]">All Contracts</h2><p className="mt-1 text-sm text-[#64748b]">Contracts currently stored for this corporate account.</p></div><span className="rounded-full bg-[#eef2ff] px-3 py-1 text-sm font-semibold text-[#2642a6]">{contracts.length} total</span></div><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{contracts.map((contract) => <ContractCard key={contract.contractId} contract={contract} />)}{contracts.length === 0 ? <p className="col-span-full rounded-xl border border-dashed border-[#d6dbe6] bg-white px-4 py-8 text-center text-sm text-[#64748b]">No contracts are recorded for this account.</p> : null}</div></div> : null}
    {activeTab === 'billing' ? <article className="rounded-xl border border-[#e5e7eb] bg-white p-5 sm:p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e0e7ff] text-[#2642a6]"><FontAwesomeIcon icon={faFileInvoiceDollar} /></div><div><h2 className="text-base font-bold text-[#111827]">Billing History</h2><p className="mt-1 text-sm text-[#64748b]">Invoices loaded from the corporate billing records.</p></div></div><InvoiceTable invoices={invoices} /></article> : null}
  </section>
}

export default CorporateDetail
