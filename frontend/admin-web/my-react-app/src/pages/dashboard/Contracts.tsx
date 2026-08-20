import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFileContract,
  faPlus,
  faFilter,
  faSearch,
  faBus,
  faCalendarDays,
  faDollarSign,
  faPen,
  faTrash,
  faEye,
  faXmark,
  faCheckCircle,
  faExclamationTriangle,
  faTimesCircle,
  faArrowLeft,
  faBuilding,
  faFileLines,
  faSpinner,
  faDownload,
  faRotateLeft,
} from '@fortawesome/free-solid-svg-icons'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

// ─── Types ───────────────────────────────────────────────────────────────────

type ContractStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Pending'

type Contract = {
  id: string
  contractId: string
  name: string
  company: string
  companyId: string
  status: ContractStatus
  buses: number
  routes: string
  validFrom: string
  validTo: string
  monthly: number
  totalValue: number
  description: string
  createdDate: string
}

type ContractFormState = {
  name: string
  company: string
  companyId: string
  status: ContractStatus
  buses: string
  routes: string
  validFrom: string
  validTo: string
  monthly: string
  description: string
}

type FilterStatus = 'All' | ContractStatus
type ViewMode = 'table' | 'cards'

// ─── Sample Data ─────────────────────────────────────────────────────────────

const INITIAL_CONTRACTS: Contract[] = [
  {
    id: '1',
    contractId: '#CNT-2022-001',
    name: 'North Industrial Route',
    company: 'MAS Holdings',
    companyId: 'mas',
    status: 'Active',
    buses: 1,
    routes: 'Katunayake → Colombo',
    validFrom: '2022-01-01',
    validTo: '2024-12-31',
    monthly: 10500,
    totalValue: 315000,
    description: 'Daily shuttle service for factory workers from north industrial zone to Colombo CBD.',
    createdDate: 'Jan 1, 2022',
  },
  {
    id: '2',
    contractId: '#CNT-2023-045',
    name: 'Employee Shuttle – CBD',
    company: 'MAS Holdings',
    companyId: 'mas',
    status: 'Expiring Soon',
    buses: 1,
    routes: 'Bambalapitiya → Fort',
    validFrom: '2023-03-15',
    validTo: '2024-03-14',
    monthly: 12500,
    totalValue: 150000,
    description: 'CBD-area shuttle service for MAS Holdings corporate office employees.',
    createdDate: 'Mar 15, 2023',
  },
  {
    id: '3',
    contractId: '#CNT-2023-089',
    name: 'Night Shift Transport',
    company: 'MAS Holdings',
    companyId: 'mas',
    status: 'Active',
    buses: 1,
    routes: 'Colombo → Ratmalana',
    validFrom: '2023-06-01',
    validTo: '2025-05-31',
    monthly: 22000,
    totalValue: 528000,
    description: 'Night shift transport for manufacturing plant workers.',
    createdDate: 'Jun 1, 2023',
  },
  {
    id: '4',
    contractId: '#CNT-2024-012',
    name: 'Factory Shuttle Service',
    company: 'Brandix Co-operation',
    companyId: 'brandix',
    status: 'Active',
    buses: 4,
    routes: 'Seeduwa → Ja-Ela',
    validFrom: '2024-04-01',
    validTo: '2025-03-31',
    monthly: 82000,
    totalValue: 984000,
    description: 'Dedicated shuttle service for the Brandix garment factory in Seeduwa.',
    createdDate: 'Apr 1, 2024',
  },
  {
    id: '5',
    contractId: '#CNT-2023-030',
    name: 'Corporate Shuttle',
    company: 'Hayleys PLC',
    companyId: 'hayleys',
    status: 'Active',
    buses: 10,
    routes: 'Deans Road → Multiple Zones',
    validFrom: '2023-01-01',
    validTo: '2025-12-31',
    monthly: 180000,
    totalValue: 6480000,
    description: 'Enterprise-wide corporate shuttle covering 10 zones across Colombo.',
    createdDate: 'Jan 1, 2023',
  },
  {
    id: '6',
    contractId: '#CNT-2023-055',
    name: 'Executive Transport',
    company: 'Hayleys PLC',
    companyId: 'hayleys',
    status: 'Expiring Soon',
    buses: 5,
    routes: 'Deans Road → Battaramulla',
    validFrom: '2023-03-01',
    validTo: '2025-02-28',
    monthly: 95000,
    totalValue: 2280000,
    description: 'Premium executive transport for senior management staff.',
    createdDate: 'Mar 1, 2023',
  },
  {
    id: '7',
    contractId: '#CNT-2024-001',
    name: 'Daily Staff Shuttle',
    company: 'John Keells Group',
    companyId: 'john-keells',
    status: 'Active',
    buses: 8,
    routes: 'Colombo 02 → 5 Suburban Zones',
    validFrom: '2024-01-01',
    validTo: '2025-12-31',
    monthly: 150000,
    totalValue: 3600000,
    description: 'Daily staff shuttle covering 5 suburban zones for JKH employees.',
    createdDate: 'Jan 1, 2024',
  },
  {
    id: '8',
    contractId: '#CNT-2024-008',
    name: 'Night Operations',
    company: 'John Keells Group',
    companyId: 'john-keells',
    status: 'Active',
    buses: 3,
    routes: 'Colombo 02 → Kesbewa',
    validFrom: '2024-02-01',
    validTo: '2025-01-31',
    monthly: 45000,
    totalValue: 540000,
    description: 'Night operations transport for JKH retail and logistics staff.',
    createdDate: 'Feb 1, 2024',
  },
  {
    id: '9',
    contractId: '#CNT-2024-020',
    name: 'Branch Staff Transport',
    company: 'Nolimit',
    companyId: 'nolimit',
    status: 'Pending',
    buses: 2,
    routes: 'Dehiwala → Colombo',
    validFrom: '2024-05-01',
    validTo: '2025-04-30',
    monthly: 53000,
    totalValue: 636000,
    description: 'Staff transport for Nolimit retail branch employees across Dehiwala.',
    createdDate: 'May 1, 2024',
  },
  {
    id: '10',
    contractId: '#CNT-2022-012',
    name: 'Airport Crew Transport',
    company: 'Sri Lankan Airlines',
    companyId: 'sla',
    status: 'Expired',
    buses: 6,
    routes: 'Katunayake Airport → Colombo',
    validFrom: '2022-09-10',
    validTo: '2023-09-09',
    monthly: 120000,
    totalValue: 1440000,
    description: 'Crew and ground staff transport from Katunayake airport to Colombo city.',
    createdDate: 'Sep 10, 2022',
  },
]

const COMPANIES = [
  { id: 'mas', name: 'MAS Holdings' },
  { id: 'brandix', name: 'Brandix Co-operation' },
  { id: 'sla', name: 'Sri Lankan Airlines' },
  { id: 'hayleys', name: 'Hayleys PLC' },
  { id: 'john-keells', name: 'John Keells Group' },
  { id: 'nolimit', name: 'Nolimit' },
]

const INITIAL_FORM: ContractFormState = {
  name: '',
  company: '',
  companyId: '',
  status: 'Pending',
  buses: '1',
  routes: '',
  validFrom: '',
  validTo: '',
  monthly: '',
  description: '',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `Rs.${(value / 1_000_000).toFixed(2)}M`
  return `Rs.${value.toLocaleString('en-US')}`
}

function statusBadgeClass(status: ContractStatus) {
  switch (status) {
    case 'Active':
      return 'bg-[#dcfce7] text-[#047857]'
    case 'Expiring Soon':
      return 'bg-[#fef3c7] text-[#b45309]'
    case 'Expired':
      return 'bg-[#fee2e2] text-[#b91c1c]'
    case 'Pending':
      return 'bg-[#ede9fe] text-[#6d28d9]'
    default:
      return 'bg-[#f1f5f9] text-[#334155]'
  }
}

function statusIcon(status: ContractStatus) {
  switch (status) {
    case 'Active':
      return faCheckCircle
    case 'Expiring Soon':
      return faExclamationTriangle
    case 'Expired':
      return faTimesCircle
    case 'Pending':
      return faSpinner
    default:
      return faFileLines
  }
}

function daysUntilExpiry(validTo: string) {
  const today = new Date()
  const expiry = new Date(validTo)
  const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function companyInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

// ─── Modal: View Contract ─────────────────────────────────────────────────────

function ViewContractModal({
  contract,
  onClose,
}: {
  contract: Contract
  onClose: () => void
}) {
  const days = daysUntilExpiry(contract.validTo)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f172a]/50 p-4 backdrop-blur-[2px]">
      <div className="animate-dash-in w-full max-w-[680px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] bg-gradient-to-r from-[#1c2a44] to-[#2642a6] p-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
                <FontAwesomeIcon icon={faFileContract} className="text-white" />
              </div>
              <p className="text-xs font-semibold text-white/60">{contract.contractId}</p>
            </div>
            <h2 className="mt-2 text-lg font-extrabold text-white">{contract.name}</h2>
            <p className="mt-0.5 text-sm text-white/70">{contract.company}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(contract.status)}`}>
              <FontAwesomeIcon icon={statusIcon(contract.status)} className="text-xs" />
              {contract.status}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Company</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#e0e7ff] text-xs font-bold text-[#2642a6]">
                  {companyInitials(contract.company)}
                </div>
                <p className="text-sm font-semibold text-[#111827]">{contract.company}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Monthly Value</p>
              <p className="mt-2 text-2xl font-extrabold text-[#047857]">{formatCurrency(contract.monthly)}</p>
              <p className="text-xs text-[#64748b]">Total: {formatCurrency(contract.totalValue)}</p>
            </div>

            <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Validity Period</p>
              <p className="mt-2 text-sm font-semibold text-[#111827]">
                {formatDate(contract.validFrom)} → {formatDate(contract.validTo)}
              </p>
              {days > 0 ? (
                <p className={`mt-1 text-xs font-medium ${days <= 30 ? 'text-[#b45309]' : 'text-[#64748b]'}`}>
                  {days} days remaining
                </p>
              ) : (
                <p className="mt-1 text-xs font-medium text-[#b91c1c]">Expired {Math.abs(days)} days ago</p>
              )}
            </div>

            <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Buses Assigned</p>
              <p className="mt-2 text-sm font-semibold text-[#111827]">
                <FontAwesomeIcon icon={faBus} className="mr-2 text-[#2642a6]" />
                {contract.buses} Bus{contract.buses !== 1 ? 'es' : ''}
              </p>
            </div>

            <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Route</p>
              <p className="mt-2 text-sm font-semibold text-[#111827]">{contract.routes}</p>
            </div>

            <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Description</p>
              <p className="mt-2 text-sm leading-relaxed text-[#334155]">{contract.description}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#e5e7eb] bg-[#f8fafc] px-6 py-4">
          <p className="text-xs text-[#94a3b8]">Created: {contract.createdDate}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9]"
            >
              <FontAwesomeIcon icon={faDownload} className="text-xs" />
              Export
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#203b96]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Create / Edit Contract ───────────────────────────────────────────

function ContractFormModal({
  editContract,
  onClose,
  onSave,
}: {
  editContract: Contract | null
  onClose: () => void
  onSave: (form: ContractFormState, editId: string | null) => void
}) {
  const [form, setForm] = useState<ContractFormState>(
    editContract
      ? {
          name: editContract.name,
          company: editContract.company,
          companyId: editContract.companyId,
          status: editContract.status,
          buses: String(editContract.buses),
          routes: editContract.routes,
          validFrom: editContract.validFrom,
          validTo: editContract.validTo,
          monthly: String(editContract.monthly),
          description: editContract.description,
        }
      : INITIAL_FORM,
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave(form, editContract ? editContract.id : null)
  }

  const setField = <K extends keyof ContractFormState>(key: K, value: ContractFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f172a]/50 p-4 backdrop-blur-[2px]">
      <div className="animate-dash-in w-full max-w-[720px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-5">
          <div>
            <h2 className="text-lg font-extrabold text-[#111827]">
              {editContract ? 'Edit Contract' : 'New Contract'}
            </h2>
            <p className="mt-0.5 text-sm text-[#64748b]">
              {editContract
                ? `Editing ${editContract.contractId}`
                : 'Fill in the details to create a new corporate contract.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#d6dbe6] text-[#334155] transition hover:bg-[#f1f5f9]"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Contract Name */}
            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-[#334155]">Contract Name</span>
              <input
                required
                placeholder="e.g. Daily Staff Shuttle"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className="w-full rounded-xl border border-[#d6dbe6] px-3 py-2.5 text-sm outline-none transition focus:border-[#2642a6] focus:ring-2 focus:ring-[#2642a6]/20"
              />
            </label>

            {/* Company */}
            <label>
              <span className="mb-1 block text-sm font-semibold text-[#334155]">Corporate Client</span>
              <select
                required
                value={form.companyId}
                onChange={(e) => {
                  const company = COMPANIES.find((c) => c.id === e.target.value)
                  setForm((cur) => ({
                    ...cur,
                    companyId: e.target.value,
                    company: company ? company.name : '',
                  }))
                }}
                className="w-full rounded-xl border border-[#d6dbe6] px-3 py-2.5 text-sm outline-none transition focus:border-[#2642a6] focus:ring-2 focus:ring-[#2642a6]/20"
              >
                <option value="" disabled>
                  Select a company
                </option>
                {COMPANIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Status */}
            <label>
              <span className="mb-1 block text-sm font-semibold text-[#334155]">Contract Status</span>
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value as ContractStatus)}
                className="w-full rounded-xl border border-[#d6dbe6] px-3 py-2.5 text-sm outline-none transition focus:border-[#2642a6] focus:ring-2 focus:ring-[#2642a6]/20"
              >
                <option value="Active">Active</option>
                <option value="Expiring Soon">Expiring Soon</option>
                <option value="Expired">Expired</option>
                <option value="Pending">Pending</option>
              </select>
            </label>

            {/* Valid From */}
            <label>
              <span className="mb-1 block text-sm font-semibold text-[#334155]">Valid From</span>
              <input
                required
                type="date"
                value={form.validFrom}
                onChange={(e) => setField('validFrom', e.target.value)}
                className="w-full rounded-xl border border-[#d6dbe6] px-3 py-2.5 text-sm outline-none transition focus:border-[#2642a6] focus:ring-2 focus:ring-[#2642a6]/20"
              />
            </label>

            {/* Valid To */}
            <label>
              <span className="mb-1 block text-sm font-semibold text-[#334155]">Valid To</span>
              <input
                required
                type="date"
                value={form.validTo}
                onChange={(e) => setField('validTo', e.target.value)}
                className="w-full rounded-xl border border-[#d6dbe6] px-3 py-2.5 text-sm outline-none transition focus:border-[#2642a6] focus:ring-2 focus:ring-[#2642a6]/20"
              />
            </label>

            {/* Buses */}
            <label>
              <span className="mb-1 block text-sm font-semibold text-[#334155]">Buses Assigned</span>
              <input
                required
                type="number"
                min="1"
                placeholder="e.g. 3"
                value={form.buses}
                onChange={(e) => setField('buses', e.target.value)}
                className="w-full rounded-xl border border-[#d6dbe6] px-3 py-2.5 text-sm outline-none transition focus:border-[#2642a6] focus:ring-2 focus:ring-[#2642a6]/20"
              />
            </label>

            {/* Monthly Value */}
            <label>
              <span className="mb-1 block text-sm font-semibold text-[#334155]">Monthly Value (LKR)</span>
              <input
                required
                type="number"
                min="0"
                placeholder="e.g. 45000"
                value={form.monthly}
                onChange={(e) => setField('monthly', e.target.value)}
                className="w-full rounded-xl border border-[#d6dbe6] px-3 py-2.5 text-sm outline-none transition focus:border-[#2642a6] focus:ring-2 focus:ring-[#2642a6]/20"
              />
            </label>

            {/* Routes */}
            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-[#334155]">Route</span>
              <input
                required
                placeholder="e.g. Colombo Fort → Katunayake"
                value={form.routes}
                onChange={(e) => setField('routes', e.target.value)}
                className="w-full rounded-xl border border-[#d6dbe6] px-3 py-2.5 text-sm outline-none transition focus:border-[#2642a6] focus:ring-2 focus:ring-[#2642a6]/20"
              />
            </label>

            {/* Description */}
            <label className="sm:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-[#334155]">Description</span>
              <textarea
                rows={3}
                placeholder="Brief description of the contract..."
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                className="w-full resize-none rounded-xl border border-[#d6dbe6] px-3 py-2.5 text-sm outline-none transition focus:border-[#2642a6] focus:ring-2 focus:ring-[#2642a6]/20"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#d6dbe6] px-5 py-2.5 text-sm font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#2642a6] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#203b96]"
            >
              {editContract ? 'Save Changes' : 'Create Contract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function Contracts() {
  const navigate = useNavigate()

  const [contracts, setContracts] = useState<Contract[]>(INITIAL_CONTRACTS)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All')
  const [filterCompany, setFilterCompany] = useState<string>('All')
  const [filterQuery, setFilterQuery] = useState('')

  const [viewContract, setViewContract] = useState<Contract | null>(null)
  const [editContract, setEditContract] = useState<Contract | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // ── Filtered contracts ──
  const filteredContracts = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    return contracts.filter((c) => {
      const matchStatus = filterStatus === 'All' || c.status === filterStatus
      const matchCompany = filterCompany === 'All' || c.companyId === filterCompany
      const matchSearch =
        q.length === 0 ||
        c.name.toLowerCase().includes(q) ||
        c.contractId.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.routes.toLowerCase().includes(q)
      return matchStatus && matchCompany && matchSearch
    })
  }, [contracts, filterStatus, filterCompany, filterQuery])

  // ── Stats ──
  const stats = useMemo(
    () => [
      {
        label: 'Total Contracts',
        value: String(contracts.length),
        sub: `${contracts.filter((c) => c.status === 'Active').length} Active`,
        color: 'text-[#2642a6]',
        bg: 'bg-[#e0e7ff]',
        icon: faFileContract,
      },
      {
        label: 'Expiring Soon',
        value: String(contracts.filter((c) => c.status === 'Expiring Soon').length),
        sub: 'Needs renewal',
        color: 'text-[#b45309]',
        bg: 'bg-[#fef3c7]',
        icon: faExclamationTriangle,
      },
      {
        label: 'Total Buses',
        value: String(contracts.filter((c) => c.status === 'Active').reduce((s, c) => s + c.buses, 0)),
        sub: 'On active contracts',
        color: 'text-[#0369a1]',
        bg: 'bg-[#dbeafe]',
        icon: faBus,
      },
      {
        label: 'Monthly Revenue',
        value: formatCurrency(
          contracts.filter((c) => c.status === 'Active').reduce((s, c) => s + c.monthly, 0),
        ),
        sub: 'From active contracts',
        color: 'text-[#047857]',
        bg: 'bg-[#dcfce7]',
        icon: faDollarSign,
      },
    ],
    [contracts],
  )

  // ── Handlers ──
  const handleSave = (form: ContractFormState, editId: string | null) => {
    if (editId) {
      setContracts((cur) =>
        cur.map((c) =>
          c.id === editId
            ? {
                ...c,
                name: form.name,
                company: form.company,
                companyId: form.companyId,
                status: form.status,
                buses: Number(form.buses),
                routes: form.routes,
                validFrom: form.validFrom,
                validTo: form.validTo,
                monthly: Number(form.monthly),
                totalValue: Number(form.monthly) * 12,
                description: form.description,
              }
            : c,
        ),
      )
    } else {
      const newContract: Contract = {
        id: String(Date.now()),
        contractId: `#CNT-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(3, '0')}`,
        name: form.name,
        company: form.company,
        companyId: form.companyId,
        status: form.status,
        buses: Number(form.buses),
        routes: form.routes,
        validFrom: form.validFrom,
        validTo: form.validTo,
        monthly: Number(form.monthly),
        totalValue: Number(form.monthly) * 12,
        description: form.description,
        createdDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      }
      setContracts((cur) => [newContract, ...cur])
    }
    setIsFormOpen(false)
    setEditContract(null)
  }

  const handleDelete = (id: string) => {
    setContracts((cur) => cur.filter((c) => c.id !== id))
    setDeleteConfirm(null)
  }

  const clearFilters = () => {
    setFilterQuery('')
    setFilterStatus('All')
    setFilterCompany('All')
  }

  const activeFilters = filterStatus !== 'All' || filterCompany !== 'All' || filterQuery.trim().length > 0

  return (
    <section className="mx-auto w-full max-w-[1340px]">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate('/dashboard/corporate')}
        className="mb-5 grid h-9 w-9 place-items-center rounded-lg border border-[#d6dbe6] bg-white text-[#334155] transition hover:bg-[#f1f5f9]"
      >
        <FontAwesomeIcon icon={faArrowLeft} />
      </button>

      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 md:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Corporate Contracts</h1>
          <p className="mt-1 text-sm text-[#64748b]">
            Manage and track all corporate transport contracts across clients.
          </p>
        </div>

        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-xl border border-[#d6dbe6] bg-white">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm font-semibold transition ${
                viewMode === 'table' ? 'bg-[#2642a6] text-white' : 'text-[#334155] hover:bg-[#f1f5f9]'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-2 text-sm font-semibold transition ${
                viewMode === 'cards' ? 'bg-[#2642a6] text-white' : 'text-[#334155] hover:bg-[#f1f5f9]'
              }`}
            >
              Cards
            </button>
          </div>

          <button
            type="button"
            onClick={() => setFilterOpen((cur) => !cur)}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
              activeFilters
                ? 'border-[#2642a6] bg-[#eff2ff] text-[#2642a6]'
                : 'border-[#d6dbe6] bg-white text-[#111827] hover:bg-[#f8fafc]'
            }`}
          >
            <FontAwesomeIcon icon={faFilter} />
            Filter
            {activeFilters && (
              <span className="grid h-4 w-4 place-items-center rounded-full bg-[#2642a6] text-2xs text-white">
                •
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setEditContract(null)
              setIsFormOpen(true)
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2642a6] px-5 text-sm font-semibold text-white transition hover:bg-[#203b96] hover:-translate-y-0.5"
          >
            <FontAwesomeIcon icon={faPlus} />
            New Contract
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, i) => (
          <article
            key={stat.label}
            className="animate-dash-in dashboard-card rounded-xl border border-[#e5e7eb] bg-white p-5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{stat.label}</p>
                <p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight text-[#111827]">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-[#94a3b8]">{stat.sub}</p>
              </div>
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${stat.bg}`}>
                <FontAwesomeIcon icon={stat.icon} className={`text-base ${stat.color}`} />
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Filter Panel */}
      {filterOpen && (
        <article className="animate-dash-in mt-5 rounded-xl border border-[#e5e7eb] bg-white p-5">
          <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]">
            {/* Search */}
            <label className="flex h-11 items-center gap-2 rounded-xl border border-[#d6dbe6] px-3">
              <FontAwesomeIcon icon={faSearch} className="shrink-0 text-[#94a3b8]" />
              <input
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Search by name, ID, company, route..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#94a3b8]"
              />
            </label>

            {/* Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="h-11 rounded-xl border border-[#d6dbe6] px-3 text-sm outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Expiring Soon">Expiring Soon</option>
              <option value="Expired">Expired</option>
              <option value="Pending">Pending</option>
            </select>

            {/* Company */}
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="h-11 rounded-xl border border-[#d6dbe6] px-3 text-sm outline-none"
            >
              <option value="All">All Companies</option>
              {COMPANIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Clear */}
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d6dbe6] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
            >
              <FontAwesomeIcon icon={faRotateLeft} />
              Clear
            </button>
          </div>
        </article>
      )}

      {/* Content */}
      <div className="mt-5">
        {/* Result count */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-[#64748b]">
            Showing <span className="font-semibold text-[#111827]">{filteredContracts.length}</span> of{' '}
            <span className="font-semibold text-[#111827]">{contracts.length}</span> contracts
          </p>
        </div>

        {/* Table View */}
        {viewMode === 'table' && (
          <div className="animate-dash-in overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f8fafc] text-left text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                    <th className="px-5 py-3.5">Contract</th>
                    <th className="px-5 py-3.5">Company</th>
                    <th className="px-5 py-3.5">Route</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Buses</th>
                    <th className="px-5 py-3.5">Validity</th>
                    <th className="px-5 py-3.5">Monthly</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {filteredContracts.map((contract) => {
                    const days = daysUntilExpiry(contract.validTo)
                    return (
                      <tr key={contract.id} className="group transition hover:bg-[#fafbff]">
                        <td className="px-5 py-4">
                          <p className="text-xs text-[#94a3b8]">{contract.contractId}</p>
                          <p className="mt-0.5 font-semibold text-[#111827]">{contract.name}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e0e7ff] text-xs font-bold text-[#2642a6]">
                              {companyInitials(contract.company)}
                            </div>
                            <span className="font-medium text-[#334155]">{contract.company}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[#64748b]">{contract.routes}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(contract.status)}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {contract.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-[#334155]">
                            <FontAwesomeIcon icon={faBus} className="text-xs text-[#2642a6]" />
                            <span className="font-semibold">{contract.buses}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[#334155]">
                            {formatDate(contract.validFrom)} – {formatDate(contract.validTo)}
                          </p>
                          {days > 0 ? (
                            <p className={`mt-0.5 text-xs ${days <= 30 ? 'font-semibold text-[#b45309]' : 'text-[#94a3b8]'}`}>
                              {days}d remaining
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs font-semibold text-[#b91c1c]">Expired</p>
                          )}
                        </td>
                        <td className="px-5 py-4 font-semibold text-[#047857]">
                          {formatCurrency(contract.monthly)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              title="View"
                              onClick={() => setViewContract(contract)}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-[#e5e7eb] text-[#64748b] transition hover:border-[#2642a6] hover:text-[#2642a6]"
                            >
                              <FontAwesomeIcon icon={faEye} className="text-xs" />
                            </button>
                            <button
                              type="button"
                              title="Edit"
                              onClick={() => {
                                setEditContract(contract)
                                setIsFormOpen(true)
                              }}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-[#e5e7eb] text-[#64748b] transition hover:border-[#2642a6] hover:text-[#2642a6]"
                            >
                              <FontAwesomeIcon icon={faPen} className="text-xs" />
                            </button>
                            <button
                              type="button"
                              title="Delete"
                              onClick={() => setDeleteConfirm(contract.id)}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-[#e5e7eb] text-[#64748b] transition hover:border-[#dc2626] hover:text-[#dc2626]"
                            >
                              <FontAwesomeIcon icon={faTrash} className="text-xs" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filteredContracts.length === 0 && (
              <div className="py-14 text-center">
                <FontAwesomeIcon icon={faFileContract} className="text-3xl text-[#d6dbe6]" />
                <p className="mt-3 text-sm font-semibold text-[#64748b]">No contracts match your filters.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-2 text-sm font-semibold text-[#2642a6] hover:text-[#203b96]"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cards View */}
        {viewMode === 'cards' && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredContracts.map((contract, i) => {
                const days = daysUntilExpiry(contract.validTo)
                return (
                  <article
                    key={contract.id}
                    className="animate-dash-in dashboard-card flex h-full flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3 p-5">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e0e7ff] text-sm font-extrabold text-[#2642a6]">
                          {companyInitials(contract.company)}
                        </div>
                        <div>
                          <p className="text-xs text-[#94a3b8]">{contract.contractId}</p>
                          <p className="mt-0.5 text-sm font-bold leading-tight text-[#111827]">{contract.name}</p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(contract.status)}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {contract.status}
                      </span>
                    </div>

                    {/* Company */}
                    <div className="flex items-center gap-2 border-t border-[#f1f5f9] px-5 py-3">
                      <FontAwesomeIcon icon={faBuilding} className="text-xs text-[#94a3b8]" />
                      <span className="text-sm font-medium text-[#334155]">{contract.company}</span>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-px bg-[#f1f5f9] border-t border-[#f1f5f9]">
                      <div className="bg-white px-4 py-3">
                        <p className="text-xs text-[#94a3b8]">Buses</p>
                        <p className="mt-0.5 text-sm font-bold text-[#111827]">
                          <FontAwesomeIcon icon={faBus} className="mr-1 text-[#2642a6]" />
                          {contract.buses} Assigned
                        </p>
                      </div>
                      <div className="bg-white px-4 py-3">
                        <p className="text-xs text-[#94a3b8]">Monthly</p>
                        <p className="mt-0.5 text-sm font-bold text-[#047857]">{formatCurrency(contract.monthly)}</p>
                      </div>
                      <div className="bg-white px-4 py-3">
                        <p className="text-xs text-[#94a3b8]">Valid Until</p>
                        <p className="mt-0.5 text-sm font-bold text-[#111827]">{formatDate(contract.validTo)}</p>
                      </div>
                      <div className="bg-white px-4 py-3">
                        <p className="text-xs text-[#94a3b8]">Days Left</p>
                        <p
                          className={`mt-0.5 text-sm font-bold ${
                            days <= 0 ? 'text-[#b91c1c]' : days <= 30 ? 'text-[#b45309]' : 'text-[#111827]'
                          }`}
                        >
                          {days > 0 ? `${days}d` : 'Expired'}
                        </p>
                      </div>
                    </div>

                    {/* Route */}
                    <div className="flex items-center gap-2 border-t border-[#f1f5f9] px-5 py-3">
                      <FontAwesomeIcon icon={faCalendarDays} className="text-xs text-[#94a3b8]" />
                      <span className="text-xs text-[#64748b]">{contract.routes}</span>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-auto flex items-center justify-between border-t border-[#e5e7eb] px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setViewContract(contract)}
                        className="text-sm font-semibold text-[#2642a6] hover:text-[#203b96]"
                      >
                        View Details
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditContract(contract)
                            setIsFormOpen(true)
                          }}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-[#e5e7eb] text-[#64748b] transition hover:border-[#2642a6] hover:text-[#2642a6]"
                        >
                          <FontAwesomeIcon icon={faPen} className="text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(contract.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-[#e5e7eb] text-[#64748b] transition hover:border-[#dc2626] hover:text-[#dc2626]"
                        >
                          <FontAwesomeIcon icon={faTrash} className="text-xs" />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            {filteredContracts.length === 0 && (
              <div className="py-14 text-center">
                <FontAwesomeIcon icon={faFileContract} className="text-3xl text-[#d6dbe6]" />
                <p className="mt-3 text-sm font-semibold text-[#64748b]">No contracts match your filters.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-2 text-sm font-semibold text-[#2642a6] hover:text-[#203b96]"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* View Modal */}
      {viewContract && (
        <ViewContractModal contract={viewContract} onClose={() => setViewContract(null)} />
      )}

      {/* Create / Edit Modal */}
      {isFormOpen && (
        <ContractFormModal
          editContract={editContract}
          onClose={() => {
            setIsFormOpen(false)
            setEditContract(null)
          }}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f172a]/50 p-4 backdrop-blur-[2px]">
          <div className="animate-dash-in w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fee2e2]">
                <FontAwesomeIcon icon={faTrash} className="text-lg text-[#dc2626]" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-[#111827]">Delete Contract?</h3>
              <p className="mt-2 text-sm text-[#64748b]">
                This will permanently remove the contract. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#f1f5f9] px-6 py-4">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="rounded-xl border border-[#d6dbe6] px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-xl bg-[#dc2626] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b91c1c]"
              >
                Delete Contract
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Contracts
