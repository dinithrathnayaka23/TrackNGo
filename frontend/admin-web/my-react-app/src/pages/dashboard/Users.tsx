import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  faArrowLeft,
  faBan,
  faBook,
  faBus,
  faCalendar,
  faChartColumn,
  faChartSimple,
  faComment,
  faDownload,
  faEnvelope,
  faFileContract,
  faFileInvoice,
  faLocationDot,
  faPen,
  faPhone,
  faPlus,
  faRoute,
  faTrash,
  faTriangleExclamation,
  faUsers,
  faWallet,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import oshadiImage from '../../assets/images/oshadi.jpeg'
import Navbar from '../../components/layout/Navbar'
import Sidebar, { type SidebarMenuItem } from '../../components/layout/Sidebar'
import { logoutToLogin } from '../../utils/authSession'

type ContractStatus = 'Active' | 'Expiring Soon'

type Contract = {
  id: string
  name: string
  status: ContractStatus
  buses: string
  validity: string
  monthly: string
}

type Invoice = {
  id: string
  date: string
  amount: string
  status: 'Paid'
}

type DetailTab = 'overview' | 'contracts' | 'billing'

const mainMenu: SidebarMenuItem[] = [
  { label: 'Dashboard', icon: faChartSimple },
  { label: 'Users', icon: faUsers, active: true, path: '/dashboard/users' },
  { label: 'Buses', icon: faBus, path: '/dashboard/buses' },
  { label: 'Routes', icon: faRoute, path: '/dashboard/routes' },
  { label: 'Bookings', icon: faBook },
]

const systemMenu: SidebarMenuItem[] = [
  { label: 'Complaints', icon: faTriangleExclamation },
  { label: 'Analytics', icon: faChartColumn, path: '/dashboard/analytics' },
  { label: 'Chat', icon: faComment },
]

const initialContracts: Contract[] = [
  {
    id: '#CNT-2023-001',
    name: 'North Industrial Route',
    status: 'Active',
    buses: '1 Assigned',
    validity: 'Jan 1 - Dec 31, 2024',
    monthly: 'Rs.10,500',
  },
  {
    id: '#CNT-2023-045',
    name: 'Employee Shuttle - CBD',
    status: 'Expiring Soon',
    buses: '1 Assigned',
    validity: 'Mar 15 - Mar 14, 2024',
    monthly: 'Rs.12,500',
  },
  {
    id: '#CNT-2023-089',
    name: 'Night Shift Transport',
    status: 'Active',
    buses: '1 Assigned',
    validity: 'Jun 1 - May 31, 2025',
    monthly: 'Rs.22,000',
  },
]

const initialInvoices: Invoice[] = [
  { id: '#INV-00821', date: 'Oct 01, 2023', amount: 'Rs.45,000.00', status: 'Paid' },
  { id: '#INV-00754', date: 'Sep 01, 2023', amount: 'Rs.45,000.00', status: 'Paid' },
  { id: '#INV-00688', date: 'Aug 01, 2023', amount: 'Rs.41,200.00', status: 'Paid' },
]

function Users() {
  const navigate = useNavigate()
  // Page-level state for tabs, searchable data, notifications, and contract creation.
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [isSuspended, setIsSuspended] = useState(false)
  const [topSearch, setTopSearch] = useState('')
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [showAllInvoices, setShowAllInvoices] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(1)
  const [isContractModalOpen, setIsContractModalOpen] = useState(false)
  const [contractDraft, setContractDraft] = useState({
    name: '',
    status: 'Active' as ContractStatus,
    buses: '1 Assigned',
    validFrom: '',
    validTo: '',
    monthly: '',
  })

  const handleLogout = () => {
    logoutToLogin(navigate)
  }

  const showToast = (message: string) => setToastMessage(message)

  // Lightweight search over local contract rows.
  const filteredContracts = useMemo(() => {
    const normalized = topSearch.trim().toLowerCase()
    if (!normalized) return contracts
    return contracts.filter((contract) =>
      contract.name.toLowerCase().includes(normalized) || contract.id.toLowerCase().includes(normalized),
    )
  }, [contracts, topSearch])

  const visibleInvoices = showAllInvoices ? invoices : invoices.slice(0, 3)

  const downloadInvoice = (invoice: Invoice) => {
    // Dummy CSV export to simulate reporting behavior.
    const csv = `Invoice,Date,Amount,Status\n${invoice.id},${invoice.date},${invoice.amount},${invoice.status}\n`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = `${invoice.id.replace('#', '')}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showToast(`Downloaded ${invoice.id}.`)
  }

  const openContractModal = () => {
    // Prefill defaults every time the modal opens.
    setContractDraft({
      name: '',
      status: contracts.length % 2 === 0 ? 'Active' : 'Expiring Soon',
      buses: '1 Assigned',
      validFrom: '',
      validTo: '',
      monthly: '',
    })
    setIsContractModalOpen(true)
  }

  const createContract = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!contractDraft.name.trim()) {
      showToast('Please enter a contract name.')
      return
    }

    if (!contractDraft.validFrom || !contractDraft.validTo) {
      showToast('Please select both valid from and valid to dates.')
      return
    }

    if (contractDraft.validFrom > contractDraft.validTo) {
      showToast('Valid from date must be before valid to date.')
      return
    }

    const monthlyRaw = contractDraft.monthly.trim().replace(/^rs\.?/i, '')
    if (!monthlyRaw || !/^\d+(\.\d+)?$/.test(monthlyRaw) || Number(monthlyRaw) <= 0) {
      showToast('Monthly value must be a positive number.')
      return
    }

    const formatDate = (dateText: string) =>
      dateText
        ? new Date(dateText).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'N/A'

    const fromLabel = formatDate(contractDraft.validFrom)
    const toLabel = formatDate(contractDraft.validTo)
    const monthlyValue = `Rs.${monthlyRaw}`

    const newContract: Contract = {
      id: `#CNT-2024-${String(contracts.length + 101).padStart(3, '0')}`,
      name: contractDraft.name.trim(),
      status: contractDraft.status,
      buses: contractDraft.buses.trim() || '1 Assigned',
      validity: `${fromLabel} - ${toLabel}`,
      monthly: monthlyValue,
    }

    setContracts((current) => [newContract, ...current])
    setIsContractModalOpen(false)
    showToast('New contract created.')
  }

  const deleteContract = (id: string) => {
    setContracts((current) => current.filter((contract) => contract.id !== id))
    showToast(`Contract ${id} deleted.`)
  }

  const generateInvoice = () => {
    const newInvoice: Invoice = {
      id: `#INV-${String(9000 + invoices.length + 1)}`,
      date: 'Nov 01, 2023',
      amount: 'Rs.39,500.00',
      status: 'Paid',
    }
    setInvoices((current) => [newInvoice, ...current])
    showToast(`Generated ${newInvoice.id}.`)
    setActiveTab('billing')
  }

  return (
    <div className="h-screen bg-[#efeff4]" style={{ fontFamily: 'Manrope, Segoe UI, sans-serif' }}>
      <Sidebar mainMenu={mainMenu} systemMenu={systemMenu} onMenuAction={showToast} />

      <div className="ml-[314px] flex h-screen flex-col">
        <Navbar
          breadcrumbs={['Co-operate', 'Co-operate Details']}
          onLogout={handleLogout}
          searchValue={topSearch}
          onSearchChange={setTopSearch}
          unreadCount={unreadCount}
          onToggleNotifications={() => setNotificationOpen((v) => !v)}
          notificationPanel={notificationOpen ? (
            <div className="absolute right-0 top-12 z-30 w-72 rounded-xl border border-[#dce1eb] bg-white p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-[#2b3448]">Notifications</p>
                <button type="button" className="text-xs font-semibold text-[#2642a6]" onClick={() => setUnreadCount(0)}>
                  Mark all read
                </button>
              </div>
              <p className="rounded-md bg-[#f2f5fb] p-2 text-sm text-[#546078]">1 contract expires next month.</p>
            </div>
          ) : null}
        />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-[1700px] space-y-5">
            <section className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm" style={{ animationDelay: '80ms' }}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-[48px] font-extrabold tracking-tight text-[#1f2737]">MAS Holdings</h1>
                    <span className={['rounded-full px-3 py-1 text-xs font-bold', isSuspended ? 'bg-[#fde8e8] text-[#e04747]' : 'bg-[#def7eb] text-[#149f69]'].join(' ')}>
                      {isSuspended ? 'Suspended' : 'Active'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#6c768d]">Corporate ID: #CORP-8832 - Created: Jan 12, 2022</p>
                </div>

                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => navigate(-1)} className="rounded-lg border border-[#d7dde9] bg-white px-4 py-2 text-sm font-semibold text-[#3a445b]">
                    <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
                    Back
                  </button>
                  <button type="button" onClick={() => showToast('Edit details opened (dummy).')} className="rounded-lg border border-[#d7dde9] bg-white px-4 py-2 text-sm font-semibold text-[#3a445b]">
                    <FontAwesomeIcon icon={faPen} className="mr-2" />
                    Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSuspended((value) => !value)
                      showToast(isSuspended ? 'Account activated.' : 'Account suspended.')
                    }}
                    className={['rounded-lg border px-4 py-2 text-sm font-semibold', isSuspended ? 'border-[#b9e3ce] bg-[#e9f8ef] text-[#1b9e67]' : 'border-[#f5c7c7] bg-[#fff0f0] text-[#e04747]'].join(' ')}
                  >
                    <FontAwesomeIcon icon={faBan} className="mr-2" />
                    {isSuspended ? 'Activate Account' : 'Suspend Account'}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-6 border-b border-[#e5e8ef]">
                {[
                  ['overview', 'Overview'],
                  ['contracts', 'Contracts'],
                  ['billing', 'Billing'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveTab(value as DetailTab)}
                    className={[
                      'border-b-2 pb-3 text-sm font-bold transition duration-200',
                      activeTab === value ? 'border-[#2642a6] text-[#2642a6]' : 'border-transparent text-[#71809c]',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {activeTab === 'overview' ? (
              <>
                <section className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
                  <article className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] shadow-sm" style={{ animationDelay: '120ms' }}>
                    <div className="flex items-center justify-between border-b border-[#e3e7f0] px-5 py-4">
                      <h2 className="text-3xl font-bold text-[#1f2737]">Company Information</h2>
                      <button type="button" className="text-sm font-semibold text-[#2642a6]" onClick={() => showToast('Opened full profile (dummy).')}>View Full Profile</button>
                    </div>

                    <div className="grid grid-cols-1 gap-6 px-5 py-5 md:grid-cols-2">
                      <div>
                        <p className="text-sm text-[#7a8498]">Registered Name</p>
                        <p className="mt-1 text-xl font-bold text-[#1f2737]">MAS Holdings</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#7a8498]">Industry</p>
                        <p className="mt-1 text-xl font-bold text-[#1f2737]">Textile and Apparel Industry</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#7a8498]">Address</p>
                        <p className="mt-1 text-xl font-bold text-[#1f2737]"><FontAwesomeIcon icon={faLocationDot} className="mr-2 text-sm" />Bambalapitiya, Colombo</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#7a8498]">Total Passenger Count</p>
                        <p className="mt-1 text-xl font-bold text-[#1f2737]">500</p>
                      </div>
                    </div>

                    <div className="border-t border-[#e3e7f0] px-5 py-5">
                      <p className="text-lg font-bold text-[#1f2737]">Primary Contact</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <img src={oshadiImage} alt="Primary contact avatar" className="h-12 w-12 rounded-md object-cover" />
                          <div>
                            <p className="text-xl font-bold text-[#1f2737]">Oshadi Liyanage</p>
                            <p className="text-sm text-[#7a8498]">Management Lead</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-5 text-sm font-semibold text-[#4d5870]">
                          <span><FontAwesomeIcon icon={faPhone} className="mr-2" />0763589127</span>
                          <span><FontAwesomeIcon icon={faEnvelope} className="mr-2" />mas@gmail.com</span>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm" style={{ animationDelay: '160ms' }}>
                    <h2 className="text-3xl font-bold text-[#1f2737]">Contracts Summary</h2>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-3 rounded-xl border border-[#e3e7f0] bg-[#f9fafd] p-4">
                        <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#e8eeff] text-[#2f4fb5]">
                          <FontAwesomeIcon icon={faFileContract} />
                        </div>
                        <div>
                          <p className="text-sm text-[#7a8498]">Active Contracts</p>
                          <p className="text-4xl font-extrabold text-[#1f2737]">{contracts.length}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e7f0] bg-[#f9fafd] p-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#CBC3E3] bg-[#CBC3E3]">
                            <FontAwesomeIcon icon={faBus} className="text-[#8b3fd9]" />
                          </div>
                          <div>
                            <p className="text-sm text-[#7a8498]">Buses Allocated</p>
                            <p className="text-4xl font-extrabold text-[#1f2737]">12</p>
                          </div>
                        </div>
                        <button type="button" className="text-sm font-semibold text-[#2642a6]" onClick={() => showToast('Opened bus allocation details.')}>
                          View Details
                        </button>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-[#e3e7f0] bg-[#f9fafd] p-4">
                        <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#e6f7ee] text-[#1aa56e]">
                          <FontAwesomeIcon icon={faWallet} />
                        </div>
                        <div>
                          <p className="text-sm text-[#7a8498]">Monthly Value</p>
                          <p className="text-4xl font-extrabold text-[#1f2737]">Rs.45,000</p>
                        </div>
                      </div>
                    </div>
                  </article>
                </section>

                <section className="animate-dash-in" style={{ animationDelay: '200ms' }}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-[#1f2737]">Active Contracts</h2>
                    <button type="button" className="rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white" onClick={openContractModal}>
                      <FontAwesomeIcon icon={faPlus} className="mr-2" />
                      New Contract
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    {filteredContracts.map((contract) => (
                      <article key={contract.id} className="dashboard-card rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-[#8a94a8]">Contract ID: {contract.id}</p>
                          <span className={['rounded-full px-2 py-1 text-xs font-bold', contract.status === 'Active' ? 'bg-[#def7eb] text-[#149f69]' : 'bg-[#fff4dd] text-[#db8a0f]'].join(' ')}>
                            {contract.status}
                          </span>
                        </div>
                        <h3 className="mt-2 text-[28px] font-extrabold text-[#1f2737]">{contract.name}</h3>
                        <div className="mt-3 space-y-2 text-sm text-[#546078]">
                          <p><FontAwesomeIcon icon={faBus} className="mr-2" />Buses <span className="float-right font-semibold text-[#1f2737]">{contract.buses}</span></p>
                          <p><FontAwesomeIcon icon={faCalendar} className="mr-2" />Valid <span className="float-right font-semibold text-[#1f2737]">{contract.validity}</span></p>
                          <p><FontAwesomeIcon icon={faWallet} className="mr-2" />Monthly <span className="float-right font-semibold text-[#1f2737]">{contract.monthly}</span></p>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-[#e5e8ef] pt-3">
                          <button type="button" className="text-sm font-semibold text-[#2642a6]" onClick={() => showToast(`Opened ${contract.id} details.`)}>
                            View Details
                          </button>
                          <div className="flex items-center gap-3 text-[#707b91]">
                            <button type="button" onClick={() => showToast(`Edit ${contract.id} (dummy).`)}><FontAwesomeIcon icon={faPen} /></button>
                            <button type="button" onClick={() => deleteContract(contract.id)}><FontAwesomeIcon icon={faTrash} /></button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  {filteredContracts.length === 0 ? (
                    <p className="mt-4 rounded-lg border border-[#dce2ee] bg-[#f7f9fd] p-4 text-sm font-semibold text-[#627089]">
                      No contracts match your search.
                    </p>
                  ) : null}
                </section>

                <section className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm" style={{ animationDelay: '240ms' }}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-[#1f2737]">Latest Invoices</h2>
                    <button type="button" className="text-sm font-bold text-[#2642a6]" onClick={() => setShowAllInvoices((value) => !value)}>
                      {showAllInvoices ? 'Show Less' : 'View All'}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                      <thead>
                        <tr className="bg-[#f1f4fa] text-left text-sm text-[#616f88]">
                          <th className="px-4 py-3 font-semibold">Invoice</th>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Amount</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleInvoices.map((invoice) => (
                          <tr key={invoice.id} className="border-b border-[#e8ebf2] text-[#2a3448]">
                            <td className="px-4 py-4 text-sm font-semibold">{invoice.id}</td>
                            <td className="px-4 py-4 text-sm">{invoice.date}</td>
                            <td className="px-4 py-4 text-sm">{invoice.amount}</td>
                            <td className="px-4 py-4 text-sm">
                              <span className="rounded-full bg-[#def7eb] px-2 py-1 text-xs font-bold text-[#149f69]">{invoice.status}</span>
                            </td>
                            <td className="px-4 py-4 text-sm">
                              <button type="button" className="text-[#6f7890]" onClick={() => downloadInvoice(invoice)}><FontAwesomeIcon icon={faDownload} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}

            {activeTab === 'contracts' ? (
              <section className="dashboard-card rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-8 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-4xl font-extrabold text-[#1f2737]">Contracts</h2>
                  <button type="button" className="rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white" onClick={openContractModal}>
                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                    Add Contract
                  </button>
                </div>
                <p className="mb-4 text-[#6c768d]">Manage contract records with dummy actions.</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="bg-[#f1f4fa] text-left text-sm text-[#616f88]">
                        <th className="px-4 py-3 font-semibold">Contract ID</th>
                        <th className="px-4 py-3 font-semibold">Name</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Monthly</th>
                        <th className="px-4 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContracts.map((contract) => (
                        <tr key={contract.id} className="border-b border-[#e8ebf2] text-[#2a3448]">
                          <td className="px-4 py-4 text-sm font-semibold">{contract.id}</td>
                          <td className="px-4 py-4 text-sm">{contract.name}</td>
                          <td className="px-4 py-4 text-sm">{contract.status}</td>
                          <td className="px-4 py-4 text-sm">{contract.monthly}</td>
                          <td className="px-4 py-4 text-sm">
                            <button type="button" className="mr-3 text-[#2642a6]" onClick={() => showToast(`Opened ${contract.id}.`)}>Open</button>
                            <button type="button" className="text-[#d74949]" onClick={() => deleteContract(contract.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {activeTab === 'billing' ? (
              <section className="dashboard-card rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-8 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-4xl font-extrabold text-[#1f2737]">Billing</h2>
                  <button type="button" className="rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white" onClick={generateInvoice}>
                    <FontAwesomeIcon icon={faFileInvoice} className="mr-2" />
                    Generate Invoice
                  </button>
                </div>
                <p className="mb-4 text-[#6c768d]">Billing records with dummy generation and download.</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="bg-[#f1f4fa] text-left text-sm text-[#616f88]">
                        <th className="px-4 py-3 font-semibold">Invoice</th>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Amount</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-[#e8ebf2] text-[#2a3448]">
                          <td className="px-4 py-4 text-sm font-semibold">{invoice.id}</td>
                          <td className="px-4 py-4 text-sm">{invoice.date}</td>
                          <td className="px-4 py-4 text-sm">{invoice.amount}</td>
                          <td className="px-4 py-4 text-sm">{invoice.status}</td>
                          <td className="px-4 py-4 text-sm">
                            <button type="button" className="text-[#2642a6]" onClick={() => downloadInvoice(invoice)}>Download</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>

      {isContractModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#101426]/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[#d8deea] bg-[#f7f8fc] shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="flex items-center justify-between border-b border-[#e1e5ef] px-6 py-4">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1f2737]">New Contract</h2>
                <p className="text-sm text-[#6d778e]">Create a contract with dummy details.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsContractModalOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-md text-[#6d778e] transition duration-200 hover:bg-[#eceff7] hover:text-[#1f2737]"
                aria-label="Close new contract modal"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <form onSubmit={createContract} className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="contract-name">
                  Contract Name
                </label>
                <input
                  id="contract-name"
                  required
                  value={contractDraft.name}
                  onChange={(event) => setContractDraft((prev) => ({ ...prev, name: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                  placeholder="Employee Shuttle - Tech Park"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="contract-status">
                  Status
                </label>
                <select
                  id="contract-status"
                  value={contractDraft.status}
                  onChange={(event) => setContractDraft((prev) => ({ ...prev, status: event.target.value as ContractStatus }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Expiring Soon">Expiring Soon</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="contract-buses">
                  Buses
                </label>
                <input
                  id="contract-buses"
                  value={contractDraft.buses}
                  onChange={(event) => setContractDraft((prev) => ({ ...prev, buses: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                  placeholder="1 Assigned"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="contract-from">
                  Valid From
                </label>
                <input
                  id="contract-from"
                  type="date"
                  value={contractDraft.validFrom}
                  onChange={(event) => setContractDraft((prev) => ({ ...prev, validFrom: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="contract-to">
                  Valid To
                </label>
                <input
                  id="contract-to"
                  type="date"
                  value={contractDraft.validTo}
                  onChange={(event) => setContractDraft((prev) => ({ ...prev, validTo: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="contract-monthly">
                  Monthly Value
                </label>
                <input
                  id="contract-monthly"
                  value={contractDraft.monthly}
                  onChange={(event) => setContractDraft((prev) => ({ ...prev, monthly: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                  placeholder="12500"
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-end gap-3 border-t border-[#e1e5ef] pt-4">
                <button
                  type="button"
                  onClick={() => setIsContractModalOpen(false)}
                  className="rounded-lg border border-[#d3d9e6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#e9edf7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-bold text-white transition duration-200 hover:bg-[#203b96]"
                >
                  Create Contract
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-[#d8deea] bg-white px-4 py-3 shadow-lg">
          <p className="text-sm font-semibold text-[#2f394d]">{toastMessage}</p>
          <button type="button" onClick={() => setToastMessage(null)} className="text-[#5f6b82]">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default Users
