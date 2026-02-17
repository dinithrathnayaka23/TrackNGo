import { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDays,
  faChevronLeft,
  faChevronRight,
  faDownload,
  faEllipsisVertical,
  faMagnifyingGlass,
} from '@fortawesome/free-solid-svg-icons'

type Role = 'Passenger' | 'Driver' | 'Corporate'
type Status = 'Active' | 'Suspended'

type UserRecord = {
  uid: string
  name: string
  idTag: string
  email: string
  phone: string
  role: Role
  status: Status
  joined: string
  avatar: string
  verified?: boolean
}

const users: UserRecord[] = [
  {
    uid: 'u1',
    name: 'Dinith Rathnayaka',
    idTag: '#USR-10234',
    email: 'rathnayakarmdno.23@uom.lk',
    phone: '+94701803826',
    role: 'Passenger',
    status: 'Active',
    joined: 'Oct 24, 2023',
    avatar: 'DR',
  },
  {
    uid: 'u2',
    name: 'Oshadi Liyanage',
    idTag: '#USR-10235',
    email: 'oshadiliyanage@gmail.com',
    phone: '+94703456789',
    role: 'Driver',
    status: 'Active',
    joined: 'Oct 22, 2023',
    avatar: 'OL',
    verified: true,
  },
  {
    uid: 'u3',
    name: 'MAS Co-operation',
    idTag: '#CORP-992',
    email: 'adminmas@outlook.com',
    phone: '+94708203607',
    role: 'Corporate',
    status: 'Suspended',
    joined: 'Sep 15, 2023',
    avatar: 'MC',
  },
  {
    uid: 'u4',
    name: 'Anjana Lakshan',
    idTag: '#USR-10255',
    email: 'anjanalakshan35@gmail.com',
    phone: '+94752345689',
    role: 'Passenger',
    status: 'Active',
    joined: 'Aug 01, 2023',
    avatar: 'AL',
  },
  {
    uid: 'u5',
    name: 'Janani Pitawala',
    idTag: '#USR-10289',
    email: 'jananipitawala@gmail.com',
    phone: '+94704567891',
    role: 'Driver',
    status: 'Active',
    joined: 'Jul 12, 2023',
    avatar: 'JP',
    verified: true,
  },
]

function roleBadgeClass(role: Role) {
  if (role === 'Passenger') return 'bg-[#dbeafe] text-[#1d4ed8]'
  if (role === 'Driver') return 'bg-[#ccfbf1] text-[#0f766e]'
  return 'bg-[#f3e8ff] text-[#7e22ce]'
}

function isSameCalendarDate(sourceDateText: string, selectedDate: string) {
  const source = new Date(sourceDateText)
  const selected = new Date(selectedDate)

  if (Number.isNaN(source.getTime()) || Number.isNaN(selected.getTime())) return false

  return (
    source.getFullYear() === selected.getFullYear() &&
    source.getMonth() === selected.getMonth() &&
    source.getDate() === selected.getDate()
  )
}

function Users() {
  const navigate = useNavigate()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'All' | Role>('All')
  const [statusFilter, setStatusFilter] = useState<'All Status' | Status>('All Status')
  const [registrationDate, setRegistrationDate] = useState('')
  const [selectedRows, setSelectedRows] = useState<string[]>(['u2', 'u3'])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const roleMatch = roleFilter === 'All' || user.role === roleFilter
      const statusMatch = statusFilter === 'All Status' || user.status === statusFilter
      const dateMatch = registrationDate === '' || isSameCalendarDate(user.joined, registrationDate)
      const searchMatch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.phone.includes(search)
      return roleMatch && statusMatch && dateMatch && searchMatch
    })
  }, [registrationDate, roleFilter, search, statusFilter])

  const allVisibleSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedRows.includes(user.uid))

  const toggleSelection = (uid: string) => {
    setSelectedRows((current) =>
      current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid],
    )
  }

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedRows((current) => current.filter((id) => !filteredUsers.some((user) => user.uid === id)))
      return
    }

    const merged = new Set([...selectedRows, ...filteredUsers.map((user) => user.uid)])
    setSelectedRows(Array.from(merged))
  }

  return (
    <section className="mx-auto w-full max-w-[1320px]">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4 md:items-center">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-[#111827]">Users Management</h1>
          <p className="mt-1 text-lg font-normal text-[#64748b]">Manage passenger, driver, and corporate accounts.</p>
        </div>

        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 md:w-auto md:gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard/passenger')}
            className={`h-10 rounded-lg border px-4 text-base font-semibold ${
              location.pathname === '/dashboard/passenger'
                ? 'border-[#3156c2] bg-[#eef2ff] text-[#3156c2]'
                : 'border-[#cfd8ea] bg-white text-[#3156c2]'
            }`}
          >
            Passenger
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/driver')}
            className={`h-10 rounded-lg border px-4 text-base font-semibold ${
              location.pathname === '/dashboard/driver'
                ? 'border-[#0f766e] bg-[#ecfdf5] text-[#0f766e]'
                : 'border-[#cfd8ea] bg-white text-[#0f766e]'
            }`}
          >
            Driver
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/corporate')}
            className={`h-10 rounded-lg border px-4 text-base font-semibold ${
              location.pathname === '/dashboard/corporate'
                ? 'border-[#7e22ce] bg-[#faf5ff] text-[#7e22ce]'
                : 'border-[#cfd8ea] bg-white text-[#7e22ce]'
            }`}
          >
            Corporate
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-4 text-sm font-semibold text-[#334155]"
          >
            <FontAwesomeIcon icon={faDownload} />
            Export Users
          </button>
        </div>
      </header>

      <article className="rounded-2xl border border-[#dfe4ef] bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[2fr_0.6fr_0.6fr_0.9fr_auto]">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-[#d9dde5] px-3 text-sm text-[#94a3b8]">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, phone..."
              className="w-full bg-transparent text-[#334155] placeholder:text-[#94a3b8] outline-none"
            />
          </label>

          <label className="inline-flex h-11 items-center justify-between rounded-xl border border-[#d9dde5] px-3 text-sm text-[#334155]">
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'All' | Role)}
              className="w-full bg-transparent outline-none"
            >
              <option value="All">All Roles</option>
              <option value="Passenger">Passenger</option>
              <option value="Driver">Driver</option>
              <option value="Corporate">Corporate</option>
            </select>
          </label>

          <label className="inline-flex h-11 items-center justify-between rounded-xl border border-[#d9dde5] px-3 text-sm text-[#334155]">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'All Status' | Status)}
              className="w-full bg-transparent outline-none"
            >
              <option value="All Status">All Status</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
            </select>
          </label>

          <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d9dde5] px-3 text-sm text-[#334155]">
            <FontAwesomeIcon icon={faCalendarDays} />
            <input
              type="date"
              value={registrationDate}
              onChange={(event) => setRegistrationDate(event.target.value)}
              className="w-full bg-transparent outline-none"
              aria-label="Registration Date"
            />
          </label>

          <div className="flex items-center gap-4 pl-1 text-sm">
            <button type="button" className="font-semibold text-[#3156c2]">
              Apply Filters
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setRoleFilter('All')
                setStatusFilter('All Status')
                setRegistrationDate('')
              }}
              className="text-[#64748b]"
            >
              Clear All
            </button>
          </div>
        </div>
      </article>

      <article className="mt-4 overflow-hidden rounded-2xl border border-[#d7deec] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d7deec] bg-[#f7f9fc] px-4 py-3">
          <p className="inline-flex items-center gap-3 text-sm font-medium text-[#334155]">
            <span className="rounded-md bg-[#22449d] px-2 py-0.5 text-xs font-semibold text-white">
              {selectedRows.length}
            </span>
            items selected
          </p>
          <div className="flex items-center gap-6 text-sm">
            <button
              type="button"
              onClick={() => navigate('/dashboard/complaints')}
              className="text-[#334155]"
            >
              Suspend Selected
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-[#334155]"
            >
              Export Selected
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/complaints')}
              className="text-[#ef4444]"
            >
              Delete Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedRows([])}
              className="text-[#64748b]"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-[#e5eaf3] bg-[#f9fbff] text-left text-xs font-semibold text-[#64748b]">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    className="h-4 w-4 rounded border-[#bfd0f2] text-[#22449d] focus:ring-[#22449d]"
                  />
                </th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Contact Info</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isSelected = selectedRows.includes(user.uid)
                return (
                  <tr
                    key={user.uid}
                    className={`border-b border-[#e9edf4] text-sm ${
                      isSelected ? 'bg-[#f5f8ff]' : 'bg-white'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(user.uid)}
                        className="h-4 w-4 rounded border-[#bfd0f2] text-[#22449d] focus:ring-[#22449d]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-[#dbeafe] text-xs font-semibold text-[#1e3a8a]">
                          {user.avatar}
                        </div>
                        <div>
                          <p className="font-semibold text-[#0f172a]">
                            {user.name}
                            {user.verified ? <span className="ml-2 text-[#2563eb]">*</span> : null}
                          </p>
                          <p className="text-xs text-[#64748b]">ID: {user.idTag}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[#334155]">{user.email}</p>
                      <p className="text-xs text-[#64748b]">{user.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadgeClass(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-[15px] text-[#334155]">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            user.status === 'Active' ? 'bg-[#10b981]' : 'bg-[#ef4444]'
                          }`}
                        />
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#475569]">{user.joined}</td>
                    <td className="px-4 py-3 text-right text-[#94a3b8]">
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard/booking')}
                        className="rounded p-2 hover:bg-[#eef2f8]"
                      >
                        <FontAwesomeIcon icon={faEllipsisVertical} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5eaf3] px-4 py-3 text-sm">
          <p className="text-[#475569]">
            Showing <span className="font-semibold text-[#0f172a]">1-50 of 12,450</span>
          </p>
          <div className="flex items-center gap-3 text-[#475569]">
            <span>Rows per page:</span>
            <button type="button" className="rounded-md border border-[#cfd8ea] px-2 py-1 font-semibold text-[#111827]">
              50
            </button>
            <div className="inline-flex overflow-hidden rounded-md border border-[#cfd8ea]">
              <button type="button" className="grid h-8 w-8 place-items-center bg-white text-[#94a3b8]">
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <button type="button" className="grid h-8 w-8 place-items-center bg-[#21409a] text-white">
                1
              </button>
              <button type="button" className="grid h-8 w-8 place-items-center bg-white text-[#111827]">
                2
              </button>
              <button type="button" className="grid h-8 w-8 place-items-center bg-white text-[#111827]">
                3
              </button>
              <button type="button" className="grid h-8 w-8 place-items-center bg-white text-[#111827]">
                ...
              </button>
              <button type="button" className="grid h-8 w-12 place-items-center bg-white text-[#111827]">
                249
              </button>
              <button type="button" className="grid h-8 w-8 place-items-center bg-white text-[#94a3b8]">
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
          </div>
        </div>
      </article>
    </section>
  )
}

export default Users

