import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faBuildingUser,
  faDollarSign,
  faFilter,
  faPlus,
  faClipboardCheck,
  faFileLines,
  faMoneyBillWave,
} from '@fortawesome/free-solid-svg-icons'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

type VerificationStatus = 'Verified' | 'Pending' | 'Suspended'

type CorporateClient = {
  id: string
  company: string
  regNo: string
  status: VerificationStatus
  contracts: number
  revenue: string
  manager: string
  role: string
  logo: string
  managerInitials: string
}

type CorporateAccountFormState = {
  company: string
  regNo: string
  status: VerificationStatus
  contracts: string
  revenue: string
  manager: string
  role: string
}
type CorporateFilterStatus = 'All' | VerificationStatus

const INITIAL_CORPORATE_CLIENTS: CorporateClient[] = [
  {
    id: 'mas',
    company: 'MAS Holdings',
    regNo: '9928-X-2023',
    status: 'Verified',
    contracts: 3,
    revenue: 'Rs.45,000',
    manager: 'Oshadi Liyanage',
    role: 'Management Lead',
    logo: 'MAS',
    managerInitials: 'OL',
  },
  {
    id: 'brandix',
    company: 'Brandix Co-operation',
    regNo: '1102-B-2024',
    status: 'Pending',
    contracts: 1,
    revenue: 'Rs.82,000',
    manager: 'Anjana Lakshan',
    role: 'Logistics Manager',
    logo: 'BR',
    managerInitials: 'AL',
  },
  {
    id: 'sla',
    company: 'Sri Lankan Airlines',
    regNo: '4451-A-2022',
    status: 'Suspended',
    contracts: 0,
    revenue: '$0',
    manager: 'Janidu Dasanayaka',
    role: 'Manager',
    logo: 'SL',
    managerInitials: 'JD',
  },
  {
    id: 'hayleys',
    company: 'Hayleys PLC',
    regNo: '8831-C-2023',
    status: 'Verified',
    contracts: 8,
    revenue: 'Rs.328,500',
    manager: 'Prashani Bhagya',
    role: 'Ops Director',
    logo: 'HY',
    managerInitials: 'PB',
  },
  {
    id: 'john-keells',
    company: 'John Keells Group',
    regNo: '7210-D-2024',
    status: 'Verified',
    contracts: 5,
    revenue: 'Rs.225,100',
    manager: 'Sandun Pathirana',
    role: 'Transport Manager',
    logo: 'JK',
    managerInitials: 'SP',
  },
  {
    id: 'nolimit',
    company: 'Nolimit',
    regNo: '5501-E-2024',
    status: 'Pending',
    contracts: 1,
    revenue: 'Rs.53,000',
    manager: 'Geethma Rathnayaka',
    role: 'HR Lead',
    logo: 'NL',
    managerInitials: 'GR',
  },
]

const initialCorporateForm: CorporateAccountFormState = {
  company: '',
  regNo: '',
  status: 'Pending',
  contracts: '1',
  revenue: '',
  manager: '',
  role: '',
}

function toInitials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function formatCurrency(value: string) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return 'Rs.0'
  return `Rs.${numberValue.toLocaleString('en-US')}`
}

function formatRevenueSummary(clients: CorporateClient[]) {
  const total = clients.reduce((sum, client) => {
    const numericValue = Number(client.revenue.replace(/[^0-9.]/g, ''))
    return sum + (Number.isFinite(numericValue) ? numericValue : 0)
  }, 0)

  if (total >= 1_000_000) {
    return `Rs.${(total / 1_000_000).toFixed(1)}M`
  }
  return `Rs.${total.toLocaleString('en-US')}`
}

function statusBadgeClass(status: VerificationStatus) {
  if (status === 'Verified') return 'bg-[#dcfce7] text-[#047857]'
  if (status === 'Pending') return 'bg-[#fef3c7] text-[#b45309]'
  return 'bg-[#fee2e2] text-[#b91c1c]'
}

function Corporate() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<CorporateClient[]>(INITIAL_CORPORATE_CLIENTS)
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<CorporateFilterStatus>('All')
  const [filterQuery, setFilterQuery] = useState('')
  const [accountForm, setAccountForm] = useState<CorporateAccountFormState>(initialCorporateForm)

  const filteredClients = useMemo(() => {
    const normalizedQuery = filterQuery.trim().toLowerCase()
    return clients.filter((client) => {
      const matchesStatus = filterStatus === 'All' || client.status === filterStatus
      const matchesSearch =
        normalizedQuery.length === 0 ||
        client.company.toLowerCase().includes(normalizedQuery) ||
        client.regNo.toLowerCase().includes(normalizedQuery) ||
        client.manager.toLowerCase().includes(normalizedQuery)

      return matchesStatus && matchesSearch
    })
  }, [clients, filterQuery, filterStatus])

  const stats = useMemo(
    () => [
      { label: 'Total Clients', value: String(clients.length), icon: faBuildingUser },
      { label: 'Total Revenue', value: formatRevenueSummary(clients), icon: faDollarSign },
      {
        label: 'Pending Verifications',
        value: String(clients.filter((client) => client.status === 'Pending').length),
        icon: faClipboardCheck,
      },
    ],
    [clients],
  )

  const closeAccountModal = () => {
    setIsAddAccountModalOpen(false)
    setAccountForm(initialCorporateForm)
  }

  const handleAccountSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const companyName = accountForm.company.trim()
    const managerName = accountForm.manager.trim()
    const newAccount: CorporateClient = {
      id: `${Date.now()}`,
      company: companyName,
      regNo: accountForm.regNo.trim(),
      status: accountForm.status,
      contracts: Math.max(0, Number(accountForm.contracts) || 0),
      revenue: formatCurrency(accountForm.revenue),
      manager: managerName,
      role: accountForm.role.trim() || 'Manager',
      logo: toInitials(companyName) || 'CO',
      managerInitials: toInitials(managerName) || 'NA',
    }
    setClients((current) => [newAccount, ...current])
    closeAccountModal()
  }

  return (
    <section className="mx-auto w-full max-w-[1340px]">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard/users')}
              className="rounded-lg p-2 text-[#0f172a] transition hover:bg-[#eef2f8]"
              aria-label="Back to Users"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <h1 className="text-base font-extrabold tracking-tight text-[#111827]">Corporate Accounts</h1>
          </div>
          <p className="ml-11 mt-1 text-sm font-normal text-[#64748b]">
            Manage corporate client contracts, revenue, and verification status.
          </p>
        </div>

        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
          <button
            type="button"
            onClick={() => setIsFilterOpen((current) => !current)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d6dbe6] bg-white px-5 text-sm font-semibold text-[#111827]"
          >
            <FontAwesomeIcon icon={faFilter} />
            Filter
          </button>
          <button
            type="button"
            onClick={() => setIsAddAccountModalOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#22449d] px-5 text-sm font-semibold text-white transition hover:bg-[#1b357f]"
          >
            <FontAwesomeIcon icon={faPlus} />
            Add New Account
          </button>
        </div>
      </header>

      {isFilterOpen ? (
        <article className="mb-5 rounded-2xl border border-[#dfe4ef] bg-white p-4">
          <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_auto]">
            <label className="flex h-11 items-center rounded-xl border border-[#d9dde5] px-3 text-sm text-[#334155]">
              <input
                value={filterQuery}
                onChange={(event) => setFilterQuery(event.target.value)}
                placeholder="Search by company, registration no, or manager..."
                className="w-full bg-transparent outline-none placeholder:text-[#94a3b8]"
              />
            </label>

            <label className="inline-flex h-11 items-center rounded-xl border border-[#d9dde5] px-3 text-sm text-[#334155]">
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value as CorporateFilterStatus)}
                className="w-full bg-transparent outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Verified">Verified</option>
                <option value="Pending">Pending</option>
                <option value="Suspended">Suspended</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                setFilterQuery('')
                setFilterStatus('All')
              }}
              className="h-11 rounded-xl border border-[#d6dbe6] px-4 text-sm font-semibold text-[#475569] transition hover:bg-[#f8fafc]"
            >
              Clear Filters
            </button>
          </div>
        </article>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => (
          <article key={item.label} className="min-h-[122px] rounded-2xl border border-[#dfe4ef] bg-white px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#64748b]">{item.label}</p>
                <p className="mt-1 text-sm font-extrabold leading-none tracking-tight text-[#111827]">{item.value}</p>
              </div>
              <FontAwesomeIcon icon={item.icon} className="mt-2 text-[22px] text-[#667085]" />
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredClients.map((client) => (
          <article
            key={client.id}
            className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#dfe4ef] bg-white shadow-[0_1px_0_rgba(15,23,42,0.02)]"
          >
            <div className="flex-1 p-5 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-md border border-[#d9dde5] bg-[#f8fafc] text-sm font-bold text-[#334155]">
                  {client.logo}
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${statusBadgeClass(client.status)}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {client.status}
                </span>
              </div>

              <h3 className="mt-4 text-sm font-semibold leading-tight text-[#111827]">{client.company}</h3>
              <p className="mt-1 text-sm font-semibold tracking-wide text-[#667085]">REG: {client.regNo}</p>

              <div className="mt-4 border-t border-[#e7ecf5] pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#667085]">
                      <FontAwesomeIcon icon={faFileLines} className="mr-2" />
                      Contracts
                    </p>
                    <p className="mt-1 text-sm font-bold leading-none text-[#111827]">{client.contracts} Active</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#667085]">
                      <FontAwesomeIcon icon={faMoneyBillWave} className="mr-2" />
                      Revenue
                    </p>
                    <p className="mt-1 text-sm font-bold leading-none text-[#0f766e]">{client.revenue}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-[#e7ecf5] pt-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-[#e5e7eb] text-sm font-semibold text-[#475569]">
                    {client.managerInitials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{client.manager}</p>
                    <p className="text-sm text-[#667085]">{client.role}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto border-t border-[#e7ecf5] px-5 py-4 md:px-6">
              <button
                type="button"
                onClick={() => navigate('/dashboard/users')}
                className="text-sm font-semibold text-[#22449d] hover:text-[#1b357f]"
              >
                View Details
              </button>
            </div>
          </article>
        ))}
      </div>
      {filteredClients.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[#d6dbe6] bg-white px-4 py-6 text-center text-sm text-[#64748b]">
          No corporate accounts match the selected filters.
        </p>
      ) : null}

      {isAddAccountModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f172a]/45 p-4">
          <div className="w-full max-w-[680px] rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-[#0f172a]">Add New Corporate Account</h2>
            <p className="mt-1 text-sm text-[#64748b]">Provide corporate and manager details to create a new account.</p>

            <form onSubmit={handleAccountSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-[#334155]">
                Company Name
                <input
                  required
                  value={accountForm.company}
                  onChange={(event) => setAccountForm((current) => ({ ...current, company: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#d9dde5] px-3 py-2 outline-none focus:ring-2 focus:ring-[#22449d]"
                />
              </label>
              <label className="text-sm font-medium text-[#334155]">
                Registration No
                <input
                  required
                  value={accountForm.regNo}
                  onChange={(event) => setAccountForm((current) => ({ ...current, regNo: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#d9dde5] px-3 py-2 outline-none focus:ring-2 focus:ring-[#22449d]"
                />
              </label>
              <label className="text-sm font-medium text-[#334155]">
                Verification Status
                <select
                  value={accountForm.status}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      status: event.target.value as VerificationStatus,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#d9dde5] px-3 py-2 outline-none focus:ring-2 focus:ring-[#22449d]"
                >
                  <option value="Verified">Verified</option>
                  <option value="Pending">Pending</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </label>
              <label className="text-sm font-medium text-[#334155]">
                Active Contracts
                <input
                  required
                  type="number"
                  min="0"
                  value={accountForm.contracts}
                  onChange={(event) => setAccountForm((current) => ({ ...current, contracts: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#d9dde5] px-3 py-2 outline-none focus:ring-2 focus:ring-[#22449d]"
                />
              </label>
              <label className="text-sm font-medium text-[#334155]">
                Revenue (LKR)
                <input
                  required
                  type="number"
                  min="0"
                  value={accountForm.revenue}
                  onChange={(event) => setAccountForm((current) => ({ ...current, revenue: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#d9dde5] px-3 py-2 outline-none focus:ring-2 focus:ring-[#22449d]"
                />
              </label>
              <label className="text-sm font-medium text-[#334155]">
                Manager Name
                <input
                  required
                  value={accountForm.manager}
                  onChange={(event) => setAccountForm((current) => ({ ...current, manager: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#d9dde5] px-3 py-2 outline-none focus:ring-2 focus:ring-[#22449d]"
                />
              </label>
              <label className="text-sm font-medium text-[#334155] sm:col-span-2">
                Manager Role
                <input
                  value={accountForm.role}
                  onChange={(event) => setAccountForm((current) => ({ ...current, role: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#d9dde5] px-3 py-2 outline-none focus:ring-2 focus:ring-[#22449d]"
                />
              </label>

              <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={closeAccountModal}
                  className="rounded-lg border border-[#d1d5db] px-4 py-2 text-sm font-semibold text-[#334155]"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-[#22449d] px-4 py-2 text-sm font-semibold text-white">
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default Corporate

