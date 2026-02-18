import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Passenger {
  id: string
  name: string
  userId: string
  email: string
  phone: string
  status: 'Active' | 'Suspended' | 'Inactive'
  registeredDate: string
  lastTrip: string
  lastRoute: string
  bookingsCount: number
}

type PassengerStatus = 'Active' | 'Suspended' | 'Inactive' | 'All'

const ALL_PASSENGERS: Passenger[] = [
  {
    id: '1',
    name: 'Dinith Rathnayaka',
    userId: '#PAS-2023-001',
    email: 'dinithrathnayaka@gmail.com',
    phone: '+94707803826',
    status: 'Active',
    registeredDate: 'Oct 24, 2024',
    lastTrip: '2 Days Ago',
    lastRoute: 'Kandy to Colombo',
    bookingsCount: 42,
  },
  {
    id: '2',
    name: 'Janani Pitawala',
    userId: '#PAS-2024-042',
    email: 'jananipitawala@uom.lk',
    phone: '+94704567892',
    status: 'Suspended',
    registeredDate: 'July 24, 2024',
    lastTrip: '8 Days Ago',
    lastRoute: 'Colombo to Kandy',
    bookingsCount: 21,
  },
  {
    id: '3',
    name: 'Prashani Bhagya',
    userId: '#PAS-2022-110',
    email: 'pbhagya123@gmail.com',
    phone: '+94716543279',
    status: 'Active',
    registeredDate: 'April 15, 2024',
    lastTrip: '5 Days Ago',
    lastRoute: 'Colombo to Kaluthara',
    bookingsCount: 12,
  },
  {
    id: '4',
    name: 'Oshadi Liyanage',
    userId: '#PAS-2023-044',
    email: 'oshadiliyanage@outlook.com',
    phone: '+94701313658',
    status: 'Active',
    registeredDate: 'Sep 19, 2024',
    lastTrip: '1 Day Ago',
    lastRoute: 'Matara to Colombo',
    bookingsCount: 17,
  },
  {
    id: '5',
    name: 'Anjana Lakshan',
    userId: '#PAS-2023-015',
    email: 'anjanelakshan35@gmail.com',
    phone: '+94752145689',
    status: 'Active',
    registeredDate: 'Aug 01, 2024',
    lastTrip: '3 Days Ago',
    lastRoute: 'Galle to Colombo',
    bookingsCount: 28,
  },
]

type FilterBarProps = {
  searchTerm: string
  selectedStatus: PassengerStatus
  onSearchChange: (value: string) => void
  onStatusChange: (status: PassengerStatus) => void
  onApplyFilters: () => void
  onClearFilters: () => void
}

function TabNavigation({
  activeTab,
  onTabChange,
}: {
  activeTab: string
  onTabChange: (tab: string) => void
}) {
  const tabs = ['All Passengers']

  return (
    <div className="mb-4 border-b border-[#e2e8f0]">
      <div className="flex gap-8">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-[#22449d] text-[#22449d]'
                : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  )
}

function FilterBar({
  searchTerm,
  selectedStatus,
  onSearchChange,
  onStatusChange,
  onApplyFilters,
  onClearFilters,
}: FilterBarProps) {
  return (
    <div className="mb-2">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[260px] flex-1">
          <input
            type="text"
            placeholder="Search by name, email, or phone"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full rounded-lg border border-[#d9dde5] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#22449d]"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(event) => onStatusChange(event.target.value as PassengerStatus)}
          className="rounded-lg border border-[#d9dde5] bg-white px-4 py-2 text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#22449d]"
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
          <option value="Inactive">Inactive</option>
        </select>

        <input
          type="date"
          className="rounded-lg border border-[#d9dde5] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#22449d]"
        />

        <button
          onClick={onApplyFilters}
          className="px-4 py-2 text-sm font-semibold text-[#22449d] hover:text-[#1b357f]"
        >
          Apply Filters
        </button>

        <button
          onClick={onClearFilters}
          className="px-4 py-2 text-sm text-[#64748b] hover:text-[#475569]"
        >
          Clear All
        </button>
      </div>
    </div>
  )
}

function PassengersTable({ passengers }: { passengers: Passenger[] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-700'
      case 'Suspended':
        return 'bg-red-100 text-red-700'
      case 'Inactive':
        return 'bg-gray-100 text-gray-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-500'
      case 'Suspended':
        return 'bg-red-500'
      case 'Inactive':
        return 'bg-gray-400'
      default:
        return 'bg-gray-400'
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#e5eaf3] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e5eaf3] bg-[#f9fbff]">
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#64748b]">Passenger Details</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#64748b]">Contact Info</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#64748b]">Registered Date</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#64748b]">Last Trip/Route</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#64748b]">Status</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#64748b]">Bookings</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#64748b]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {passengers.map((passenger, index) => (
              <tr key={passenger.id} className="border-b border-[#e9edf4] transition-colors hover:bg-[#f8faff]">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${index}`}
                      alt={passenger.name}
                      className="h-10 w-10 rounded-full"
                    />
                    <div>
                      <p className="font-semibold text-[#0f172a]">{passenger.name}</p>
                      <p className="text-sm text-[#64748b]">ID: {passenger.userId}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <p className="text-[#334155]">{passenger.email}</p>
                    <p className="text-[#64748b]">{passenger.phone}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-[#334155]">{passenger.registeredDate}</td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <p className="text-[#334155]">{passenger.lastTrip}</p>
                    <p className="text-[#64748b]">{passenger.lastRoute}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${getStatusDotColor(passenger.status)}`} />
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                        passenger.status,
                      )}`}
                    >
                      {passenger.status}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-semibold text-[#0f172a]">{passenger.bookingsCount}</span>
                </td>
                <td className="px-6 py-4">
                  <button className="rounded-lg p-2 text-[#94a3b8] hover:bg-[#eef2f8] hover:text-[#64748b]">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type PaginationProps = {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}

function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="mt-4 flex items-center justify-between rounded-lg border border-[#e5eaf3] bg-white p-4">
      <div className="text-sm text-[#64748b]">
        Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span>{' '}
        of <span className="font-medium">{totalItems}</span> passengers
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-lg border border-[#cfd8ea] px-4 py-2 text-sm font-medium text-[#475569] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>

        <button className="h-10 w-10 rounded-lg bg-[#22449d] text-sm font-medium text-white">{currentPage}</button>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-lg border border-[#cfd8ea] px-4 py-2 text-sm font-medium text-[#475569] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

function PassengerManagement() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('All Passengers')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<PassengerStatus>('All')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 4

  const filteredPassengers = useMemo(() => {
    return ALL_PASSENGERS.filter((passenger) => {
      const matchesSearch =
        passenger.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        passenger.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        passenger.phone.includes(searchTerm)

      const matchesStatus = selectedStatus === 'All' || passenger.status === selectedStatus

      return matchesSearch && matchesStatus
    })
  }, [searchTerm, selectedStatus])

  const totalPages = Math.ceil(filteredPassengers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedPassengers = filteredPassengers.slice(startIndex, startIndex + itemsPerPage)

  const handleClearFilters = () => {
    setSearchTerm('')
    setSelectedStatus('All')
    setCurrentPage(1)
  }

  return (
    <section className="mx-auto w-full max-w-[1320px]">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard/users')}
            className="rounded-lg p-2 text-[#111827] hover:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-5xl font-bold tracking-tight text-[#111827]">Passenger Management</h1>
            <p className="mt-1 text-[26px] font-semibold text-[#475569]">
              Total Passengers: <span className="text-[#0f172a]">142</span> | Active:{' '}
              <span className="text-[#10b981]">132</span>
            </p>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-[#22449d] px-5 py-2.5 font-semibold text-white hover:bg-[#1b357f]">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Passenger
        </button>
      </div>
      <article className="rounded-2xl border border-[#dfe4ef] bg-white p-4">
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        <FilterBar
          searchTerm={searchTerm}
          selectedStatus={selectedStatus}
          onSearchChange={setSearchTerm}
          onStatusChange={setSelectedStatus}
          onApplyFilters={() => setCurrentPage(1)}
          onClearFilters={handleClearFilters}
        />

        <PassengersTable passengers={paginatedPassengers} />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredPassengers.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </article>
    </section>
  )
}

export default PassengerManagement
