import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faPen,
  faBan,
  faPlus,
  faBus,
  faCalendarDays,
  faDollarSign,
  faClipboardList,
  faLocationDot,
  faPhone,
  faEnvelope,
  faTrash,
  faDownload,
  faMoneyBill,
} from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

type AccountStatus = 'Active' | 'Pending' | 'Suspended'
type ContractStatus = 'Active' | 'Expiring Soon' | 'Expired'
type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue'

type Contract = {
  contractId: string
  name: string
  status: ContractStatus
  buses: number
  validFrom: string
  validTo: string
  monthly: string
}

type Invoice = {
  id: string
  date: string
  amount: string
  status: InvoiceStatus
}

type CorporateAccount = {
  id: string
  company: string
  corporateId: string
  createdDate: string
  status: AccountStatus
  industry: string
  address: string
  totalPassengers: number
  contactName: string
  contactRole: string
  contactInitials: string
  contactPhone: string
  contactEmail: string
  activeContracts: number
  busesAllocated: number
  monthlyValue: string
  contracts: Contract[]
  invoices: Invoice[]
}

const CORPORATE_ACCOUNTS: CorporateAccount[] = [
  {
    id: 'mas',
    company: 'MAS Holdings',
    corporateId: '#CORP-8832',
    createdDate: 'Jan 12, 2022',
    status: 'Active',
    industry: 'Textile and Apparel Industry',
    address: 'Bambalapitiya, Colombo',
    totalPassengers: 500,
    contactName: 'Oshadi Liyanage',
    contactRole: 'Management Lead',
    contactInitials: 'OL',
    contactPhone: '0763589127',
    contactEmail: 'mas@gmail.com',
    activeContracts: 3,
    busesAllocated: 12,
    monthlyValue: 'Rs.45,000',
    contracts: [
      { contractId: '#CNT-2022-001', name: 'North Industrial Route', status: 'Active', buses: 1, validFrom: 'Jan 1', validTo: 'Dec 31, 2024', monthly: 'Rs.10,500' },
      { contractId: '#CNT-2023-045', name: 'Employee Shuttle - CBD', status: 'Expiring Soon', buses: 1, validFrom: 'Mar 15', validTo: 'Mar 14, 2024', monthly: 'Rs.12,500' },
      { contractId: '#CNT-2023-089', name: 'Night Shift Transport', status: 'Active', buses: 1, validFrom: 'Jun 1', validTo: 'May 31, 2025', monthly: 'Rs.22,000' },
    ],
    invoices: [
      { id: '#INV-00821', date: 'Oct 01, 2023', amount: 'Rs.45,000.00', status: 'Paid' },
      { id: '#INV-00754', date: 'Sep 01, 2023', amount: 'Rs.45,000.00', status: 'Paid' },
      { id: '#INV-00688', date: 'Aug 01, 2023', amount: 'Rs.41,200.00', status: 'Paid' },
    ],
  },
  {
    id: 'brandix',
    company: 'Brandix Co-operation',
    corporateId: '#CORP-9104',
    createdDate: 'Mar 20, 2024',
    status: 'Pending',
    industry: 'Apparel Manufacturing',
    address: 'Seeduwa, Sri Lanka',
    totalPassengers: 320,
    contactName: 'Anjana Lakshan',
    contactRole: 'Logistics Manager',
    contactInitials: 'AL',
    contactPhone: '0771234567',
    contactEmail: 'anjana@brandix.com',
    activeContracts: 1,
    busesAllocated: 4,
    monthlyValue: 'Rs.82,000',
    contracts: [
      { contractId: '#CNT-2024-012', name: 'Factory Shuttle Service', status: 'Active', buses: 4, validFrom: 'Apr 1', validTo: 'Mar 31, 2025', monthly: 'Rs.82,000' },
    ],
    invoices: [
      { id: '#INV-01002', date: 'Apr 01, 2024', amount: 'Rs.82,000.00', status: 'Paid' },
    ],
  },
  {
    id: 'sla',
    company: 'Sri Lankan Airlines',
    corporateId: '#CORP-4451',
    createdDate: 'Sep 10, 2022',
    status: 'Suspended',
    industry: 'Aviation',
    address: 'Bandaranaike Intl Airport, Katunayake',
    totalPassengers: 0,
    contactName: 'Janidu Dasanayaka',
    contactRole: 'Manager',
    contactInitials: 'JD',
    contactPhone: '0112345678',
    contactEmail: 'janidu@srilankan.aero',
    activeContracts: 0,
    busesAllocated: 0,
    monthlyValue: 'Rs.0',
    contracts: [],
    invoices: [],
  },
  {
    id: 'hayleys',
    company: 'Hayleys PLC',
    corporateId: '#CORP-8831',
    createdDate: 'Mar 05, 2023',
    status: 'Active',
    industry: 'Diversified Holdings',
    address: 'Deans Road, Colombo 10',
    totalPassengers: 780,
    contactName: 'Prashani Bhagya',
    contactRole: 'Ops Director',
    contactInitials: 'PB',
    contactPhone: '0115678901',
    contactEmail: 'prashani@hayleys.com',
    activeContracts: 8,
    busesAllocated: 22,
    monthlyValue: 'Rs.328,500',
    contracts: [
      { contractId: '#CNT-2023-030', name: 'Corporate Shuttle', status: 'Active', buses: 10, validFrom: 'Jan 1', validTo: 'Dec 31, 2025', monthly: 'Rs.180,000' },
      { contractId: '#CNT-2023-055', name: 'Executive Transport', status: 'Active', buses: 5, validFrom: 'Mar 1', validTo: 'Feb 28, 2025', monthly: 'Rs.95,000' },
    ],
    invoices: [
      { id: '#INV-01100', date: 'Nov 01, 2023', amount: 'Rs.328,500.00', status: 'Paid' },
      { id: '#INV-01050', date: 'Oct 01, 2023', amount: 'Rs.328,500.00', status: 'Paid' },
    ],
  },
  {
    id: 'john-keells',
    company: 'John Keells Group',
    corporateId: '#CORP-7210',
    createdDate: 'Feb 18, 2024',
    status: 'Active',
    industry: 'Conglomerate',
    address: 'Sir Chittampalam Gardiner Mw, Colombo 02',
    totalPassengers: 600,
    contactName: 'Sandun Pathirana',
    contactRole: 'Transport Manager',
    contactInitials: 'SP',
    contactPhone: '0116789012',
    contactEmail: 'sandun@keells.com',
    activeContracts: 5,
    busesAllocated: 15,
    monthlyValue: 'Rs.225,100',
    contracts: [
      { contractId: '#CNT-2024-001', name: 'Daily Staff Shuttle', status: 'Active', buses: 8, validFrom: 'Jan 1', validTo: 'Dec 31, 2025', monthly: 'Rs.150,000' },
      { contractId: '#CNT-2024-008', name: 'Night Operations', status: 'Active', buses: 3, validFrom: 'Feb 1', validTo: 'Jan 31, 2025', monthly: 'Rs.45,000' },
    ],
    invoices: [
      { id: '#INV-01200', date: 'Mar 01, 2024', amount: 'Rs.225,100.00', status: 'Paid' },
      { id: '#INV-01150', date: 'Feb 01, 2024', amount: 'Rs.225,100.00', status: 'Paid' },
    ],
  },
  {
    id: 'nolimit',
    company: 'Nolimit',
    corporateId: '#CORP-5501',
    createdDate: 'Apr 01, 2024',
    status: 'Pending',
    industry: 'Retail',
    address: 'Galle Road, Dehiwala',
    totalPassengers: 150,
    contactName: 'Geethma Rathnayaka',
    contactRole: 'HR Lead',
    contactInitials: 'GR',
    contactPhone: '0117890123',
    contactEmail: 'geethma@nolimit.lk',
    activeContracts: 1,
    busesAllocated: 2,
    monthlyValue: 'Rs.53,000',
    contracts: [
      { contractId: '#CNT-2024-020', name: 'Branch Staff Transport', status: 'Active', buses: 2, validFrom: 'May 1', validTo: 'Apr 30, 2025', monthly: 'Rs.53,000' },
    ],
    invoices: [
      { id: '#INV-01300', date: 'May 01, 2024', amount: 'Rs.53,000.00', status: 'Pending' },
    ],
  },
]

function statusBadge(status: AccountStatus) {
  if (status === 'Active') return 'bg-[#dcfce7] text-[#047857]'
  if (status === 'Pending') return 'bg-[#fef3c7] text-[#b45309]'
  return 'bg-[#fee2e2] text-[#b91c1c]'
}

function contractStatusBadge(status: ContractStatus) {
  if (status === 'Active') return 'bg-[#dcfce7] text-[#047857]'
  if (status === 'Expiring Soon') return 'bg-[#fef3c7] text-[#b45309]'
  return 'bg-[#fee2e2] text-[#b91c1c]'
}

function invoiceStatusColor(status: InvoiceStatus) {
  if (status === 'Paid') return 'text-[#047857]'
  if (status === 'Pending') return 'text-[#b45309]'
  return 'text-[#b91c1c]'
}

function CorporateDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'overview' | 'contracts' | 'billing'>('overview')
  const account = CORPORATE_ACCOUNTS.find((a) => a.id === id)

  if (!account) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 py-8 text-center">
        <p className="text-sm font-semibold text-[#64748b]">Corporate account not found.</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard/corporate')}
          className="text-sm font-semibold text-[#22449d] hover:text-[#1b357f]"
        >
          Back to Corporate
        </button>
      </div>
    )
  }

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'contracts' as const, label: 'Contracts' },
    { key: 'billing' as const, label: 'Billing' },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <div className="animate-dash-in flex flex-wrap items-start justify-between gap-4" style={{ animationDelay: '80ms' }}>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">{account.company}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(account.status)}`}>
              {account.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#64748b]">
            Corporate ID: {account.corporateId} &bull; Created: {account.createdDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard/corporate')}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9]"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
            Back
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9]"
          >
            <FontAwesomeIcon icon={faPen} className="text-xs" />
            Edit Details
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-[#fecaca] bg-white px-4 py-2 text-sm font-semibold text-[#dc2626] transition hover:bg-[#fef2f2]"
          >
            <FontAwesomeIcon icon={faBan} className="text-xs" />
            Suspend Account
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="animate-dash-in border-b border-[#e5e7eb]" style={{ animationDelay: '100ms' }}>
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 pb-2.5 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'border-[#2642a6] text-[#2642a6]'
                  : 'border-transparent text-[#64748b] hover:text-[#334155]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          <div className="grid gap-5 lg:grid-cols-5">
            {/* Company Information */}
            <article className="animate-dash-in rounded-xl border border-[#e5e7eb] bg-white p-5 lg:col-span-3" style={{ animationDelay: '120ms' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#111827]">Company Information</h2>
                <button type="button" className="text-sm font-semibold text-[#2642a6] hover:text-[#1b357f]">
                  View Full Profile
                </button>
              </div>

              <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-[#94a3b8]">Registered Name</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827]">{account.company}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#94a3b8]">Industry</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827]">{account.industry}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#94a3b8]">Address</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827]">
                    <FontAwesomeIcon icon={faLocationDot} className="mr-1.5 text-[#94a3b8]" />
                    {account.address}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#94a3b8]">Total Passenger Count</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827]">{account.totalPassengers}</p>
                </div>
              </div>

              {/* Primary Contact */}
              <div className="mt-5 border-t border-[#e5e7eb] pt-4">
                <p className="text-sm font-bold text-[#111827]">Primary Contact</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-[#e0e7ff] text-sm font-bold text-[#3b5998]">
                      {account.contactInitials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{account.contactName}</p>
                      <p className="text-xs text-[#64748b]">{account.contactRole}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-sm text-[#334155]">
                    <span className="inline-flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faPhone} className="text-xs text-[#64748b]" />
                      {account.contactPhone}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faEnvelope} className="text-xs text-[#64748b]" />
                      {account.contactEmail}
                    </span>
                  </div>
                </div>
              </div>
            </article>

            {/* Contracts Summary */}
            <article className="animate-dash-in rounded-xl border border-[#e5e7eb] bg-white p-5 lg:col-span-2" style={{ animationDelay: '150ms' }}>
              <h2 className="text-sm font-bold text-[#111827]">Contracts Summary</h2>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 rounded-lg border border-[#e5e7eb] bg-[#f8fafc] px-4 py-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#e0e7ff] text-[#2642a6]">
                    <FontAwesomeIcon icon={faClipboardList} />
                  </div>
                  <div>
                    <p className="text-xs text-[#64748b]">Active Contracts</p>
                    <p className="text-lg font-extrabold text-[#111827]">{account.activeContracts}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[#e5e7eb] bg-[#f8fafc] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#dbeafe] text-[#2563eb]">
                      <FontAwesomeIcon icon={faBus} />
                    </div>
                    <div>
                      <p className="text-xs text-[#64748b]">Buses Allocated</p>
                      <p className="text-lg font-extrabold text-[#111827]">{account.busesAllocated}</p>
                    </div>
                  </div>
                  <button type="button" className="text-sm font-semibold text-[#2642a6] hover:text-[#1b357f]">
                    View Details
                  </button>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-[#e5e7eb] bg-[#f8fafc] px-4 py-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
                    <FontAwesomeIcon icon={faMoneyBill} />
                  </div>
                  <div>
                    <p className="text-xs text-[#64748b]">Monthly Value</p>
                    <p className="text-lg font-extrabold text-[#111827]">{account.monthlyValue}</p>
                  </div>
                </div>
              </div>
            </article>
          </div>

          {/* Active Contracts */}
          <div>
            <div className="animate-dash-in flex items-center justify-between" style={{ animationDelay: '180ms' }}>
              <h2 className="text-sm font-bold text-[#111827]">Active Contracts</h2>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2642a6] px-3.5 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
              >
                <FontAwesomeIcon icon={faPlus} className="text-xs" />
                New Contract
              </button>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {account.contracts.map((contract) => (
                <article
                  key={contract.contractId}
                  className="animate-dash-in rounded-xl border border-[#e5e7eb] bg-white p-4"
                  style={{ animationDelay: '210ms' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-[#94a3b8]">Contract ID: {contract.contractId}</p>
                      <p className="mt-0.5 text-sm font-bold text-[#111827]">{contract.name}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${contractStatusBadge(contract.status)}`}>
                      {contract.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                        <FontAwesomeIcon icon={faBus} className="text-xs" />
                        Buses
                      </span>
                      <span className="font-semibold text-[#111827]">{contract.buses} Assigned</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                        <FontAwesomeIcon icon={faCalendarDays} className="text-xs" />
                        Valid
                      </span>
                      <span className="font-semibold text-[#111827]">{contract.validFrom} - {contract.validTo}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                        <FontAwesomeIcon icon={faDollarSign} className="text-xs" />
                        Monthly
                      </span>
                      <span className="font-semibold text-[#111827]">{contract.monthly}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-[#e5e7eb] pt-3">
                    <button type="button" className="text-sm font-semibold text-[#2642a6] hover:text-[#1b357f]">
                      View Details
                    </button>
                    <div className="flex items-center gap-3">
                      <button type="button" className="text-[#64748b] transition hover:text-[#334155]">
                        <FontAwesomeIcon icon={faPen} className="text-sm" />
                      </button>
                      <button type="button" className="text-[#64748b] transition hover:text-[#dc2626]">
                        <FontAwesomeIcon icon={faTrash} className="text-sm" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {account.contracts.length === 0 && (
                <p className="col-span-full rounded-xl border border-dashed border-[#d6dbe6] bg-white px-4 py-6 text-center text-sm text-[#64748b]">
                  No active contracts.
                </p>
              )}
            </div>
          </div>

          {/* Latest Invoices */}
          <article className="animate-dash-in rounded-xl border border-[#e5e7eb] bg-white p-5" style={{ animationDelay: '240ms' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#111827]">Latest Invoices</h2>
              <button type="button" className="text-sm font-semibold text-[#2642a6] hover:text-[#1b357f]">
                View All
              </button>
            </div>

            {account.invoices.length > 0 ? (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e7eb] text-left text-xs font-semibold text-[#64748b]">
                    <th className="pb-2.5">Invoice</th>
                    <th className="pb-2.5">Date</th>
                    <th className="pb-2.5">Amount</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {account.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-[#f1f5f9] last:border-0">
                      <td className="py-2.5 font-semibold text-[#111827]">{inv.id}</td>
                      <td className="py-2.5 text-[#64748b]">{inv.date}</td>
                      <td className="py-2.5 font-semibold text-[#111827]">{inv.amount}</td>
                      <td className={`py-2.5 font-semibold ${invoiceStatusColor(inv.status)}`}>{inv.status}</td>
                      <td className="py-2.5">
                        <button type="button" className="text-[#64748b] transition hover:text-[#2642a6]">
                          <FontAwesomeIcon icon={faDownload} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-4 text-sm text-[#64748b]">No invoices available.</p>
            )}
          </article>
        </>
      )}

      {/* Contracts Tab */}
      {activeTab === 'contracts' && (
        <div>
          <div className="animate-dash-in flex items-center justify-between" style={{ animationDelay: '120ms' }}>
            <h2 className="text-sm font-bold text-[#111827]">All Contracts</h2>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2642a6] px-3.5 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
            >
              <FontAwesomeIcon icon={faPlus} className="text-xs" />
              New Contract
            </button>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {account.contracts.map((contract) => (
              <article
                key={contract.contractId}
                className="animate-dash-in rounded-xl border border-[#e5e7eb] bg-white p-4"
                style={{ animationDelay: '150ms' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-[#94a3b8]">Contract ID: {contract.contractId}</p>
                    <p className="mt-0.5 text-sm font-bold text-[#111827]">{contract.name}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${contractStatusBadge(contract.status)}`}>
                    {contract.status}
                  </span>
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                      <FontAwesomeIcon icon={faBus} className="text-xs" />
                      Buses
                    </span>
                    <span className="font-semibold text-[#111827]">{contract.buses} Assigned</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                      <FontAwesomeIcon icon={faCalendarDays} className="text-xs" />
                      Valid
                    </span>
                    <span className="font-semibold text-[#111827]">{contract.validFrom} - {contract.validTo}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                      <FontAwesomeIcon icon={faDollarSign} className="text-xs" />
                      Monthly
                    </span>
                    <span className="font-semibold text-[#111827]">{contract.monthly}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#e5e7eb] pt-3">
                  <button type="button" className="text-sm font-semibold text-[#2642a6] hover:text-[#1b357f]">
                    View Details
                  </button>
                  <div className="flex items-center gap-3">
                    <button type="button" className="text-[#64748b] transition hover:text-[#334155]">
                      <FontAwesomeIcon icon={faPen} className="text-sm" />
                    </button>
                    <button type="button" className="text-[#64748b] transition hover:text-[#dc2626]">
                      <FontAwesomeIcon icon={faTrash} className="text-sm" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {account.contracts.length === 0 && (
              <p className="col-span-full rounded-xl border border-dashed border-[#d6dbe6] bg-white px-4 py-6 text-center text-sm text-[#64748b]">
                No contracts found.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <article className="animate-dash-in rounded-xl border border-[#e5e7eb] bg-white p-5" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#111827]">All Invoices</h2>
          </div>
          {account.invoices.length > 0 ? (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb] text-left text-xs font-semibold text-[#64748b]">
                  <th className="pb-2.5">Invoice</th>
                  <th className="pb-2.5">Date</th>
                  <th className="pb-2.5">Amount</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {account.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-[#f1f5f9] last:border-0">
                    <td className="py-2.5 font-semibold text-[#111827]">{inv.id}</td>
                    <td className="py-2.5 text-[#64748b]">{inv.date}</td>
                    <td className="py-2.5 font-semibold text-[#111827]">{inv.amount}</td>
                    <td className={`py-2.5 font-semibold ${invoiceStatusColor(inv.status)}`}>{inv.status}</td>
                    <td className="py-2.5">
                      <button type="button" className="text-[#64748b] transition hover:text-[#2642a6]">
                        <FontAwesomeIcon icon={faDownload} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 text-sm text-[#64748b]">No invoices available.</p>
          )}
        </article>
      )}
    </div>
  )
}

export default CorporateDetail
