import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  faBook,
  faBus,
  faChartColumn,
  faChartSimple,
  faCheckCircle,
  faComment,
  faBan,
  faLocationDot,
  faPen,
  faPlus,
  faRoute,
  faTrash,
  faTriangleExclamation,
  faUsers,
  faClock,
  faRulerHorizontal,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import mapPreviewImage from '../../assets/images/map.png'
import Navbar from '../../components/layout/Navbar'
import Sidebar, { type SidebarMenuItem } from '../../components/layout/Sidebar'
import { logoutToLogin } from '../../utils/authSession'

type RouteRow = {
  name: string
  code: string
  type: string
  distance: string
  duration: string
  stops: number
  activeBuses: number
  baseFare: string
  status: 'Active' | 'Inactive'
}

const mainMenu: SidebarMenuItem[] = [
  { label: 'Dashboard', icon: faChartSimple },
  { label: 'Users', icon: faUsers },
  { label: 'Buses', icon: faBus },
  { label: 'Routes', icon: faLocationDot, active: true },
  { label: 'Bookings', icon: faBook },
]

const systemMenu: SidebarMenuItem[] = [
  { label: 'Complaints', icon: faTriangleExclamation },
  { label: 'Analytics', icon: faChartColumn, path: '/dashboard/analytics' },
  { label: 'Chat', icon: faComment },
]

const routeRows: RouteRow[] = [
  {
    name: 'Colombo - Kandy',
    code: 'RT-001',
    type: 'High Way',
    distance: '148 km',
    duration: '3h 15m',
    stops: 4,
    activeBuses: 12,
    baseFare: 'Rs.450',
    status: 'Active',
  },
  {
    name: 'Kadawatha - Moratuwa',
    code: 'RT-045',
    type: 'Long Distance',
    distance: '345 km',
    duration: '6h 45m',
    stops: 8,
    activeBuses: 18,
    baseFare: 'Rs.420',
    status: 'Active',
  },
  {
    name: 'Panadura - Kandy',
    code: 'RT-17',
    type: 'High Way',
    distance: '233 km',
    duration: '3h 30m',
    stops: 2,
    activeBuses: 0,
    baseFare: 'Rs.500',
    status: 'Inactive',
  },
  {
    name: 'Colombo - Matara',
    code: 'RT-112',
    type: 'Long Distance',
    distance: '275 km',
    duration: '5h 15m',
    stops: 6,
    activeBuses: 9,
    baseFare: 'Rs.200',
    status: 'Active',
  },
  {
    name: 'Colombo - Galle',
    code: 'RT-100',
    type: 'High Way',
    distance: '395 km',
    duration: '7h 10m',
    stops: 10,
    activeBuses: 5,
    baseFare: 'Rs.340',
    status: 'Active',
  },
]

function SummaryCard({
  icon,
  iconWrap,
  title,
  value,
  delay,
}: {
  icon: typeof faRoute
  iconWrap: string
  title: string
  value: string
  delay: string
}) {
  return (
    <article
      className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center gap-4">
        <div className={['grid h-12 w-12 place-items-center rounded-full text-lg', iconWrap].join(' ')}>
          <FontAwesomeIcon icon={icon} />
        </div>
        <div>
          <p className="text-sm text-[#768096]">{title}</p>
          <p className="text-4xl font-extrabold text-[#1f2737]">{value}</p>
        </div>
      </div>
    </article>
  )
}

function Routes() {
  const navigate = useNavigate()
  // Filter and create-route state for the route management table.
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [busTypeFilter, setBusTypeFilter] = useState<'all' | 'high-way' | 'long-distance'>('all')
  const [routesData, setRoutesData] = useState<RouteRow[]>(routeRows)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createRouteError, setCreateRouteError] = useState('')
  const [newRoute, setNewRoute] = useState({
    name: '',
    code: '',
    type: 'High Way',
    distance: '',
    duration: '',
    stops: '',
    activeBuses: '',
    baseFare: '',
    status: 'Active' as RouteRow['status'],
  })

  const handleLogout = () => {
    logoutToLogin(navigate)
  }

  // Derived list keeps table rendering declarative and avoids inline filter logic in JSX.
  const filteredRoutes = useMemo(
    () =>
      routesData.filter((route) => {
        const normalizedType = route.type.toLowerCase().replace(/\s+/g, '-')
        const normalizedSearch = searchTerm.trim().toLowerCase()

        const matchesSearch =
          normalizedSearch.length === 0 ||
          route.name.toLowerCase().includes(normalizedSearch) ||
          route.code.toLowerCase().includes(normalizedSearch)

        const matchesStatus = statusFilter === 'all' || route.status.toLowerCase() === statusFilter
        const matchesBusType = busTypeFilter === 'all' || normalizedType === busTypeFilter

        return matchesSearch && matchesStatus && matchesBusType
      }),
    [routesData, searchTerm, statusFilter, busTypeFilter],
  )

  const handleCreateRoute = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = newRoute.name.trim()
    const trimmedCode = newRoute.code.trim()
    const trimmedDistance = newRoute.distance.trim()
    const trimmedDuration = newRoute.duration.trim()
    const trimmedFare = newRoute.baseFare.trim().replace(/^rs\.?/i, '')

    if (!trimmedName || !trimmedCode) {
      setCreateRouteError('Route name and route code are required.')
      return
    }

    if (!/^[A-Za-z]{2,4}-\d{2,4}$/.test(trimmedCode)) {
      setCreateRouteError('Route code must follow a format like RT-200.')
      return
    }

    if (trimmedDistance && !/^\d+(\.\d+)?\s*km$/i.test(trimmedDistance)) {
      setCreateRouteError('Distance must be in a format like 120 km.')
      return
    }

    if (trimmedDuration && !/^\d+h(\s*\d+m)?$/i.test(trimmedDuration)) {
      setCreateRouteError('Duration must be in a format like 2h 35m.')
      return
    }

    if (newRoute.stops && Number(newRoute.stops) < 0) {
      setCreateRouteError('Stops cannot be negative.')
      return
    }

    if (newRoute.activeBuses && Number(newRoute.activeBuses) < 0) {
      setCreateRouteError('Active buses cannot be negative.')
      return
    }

    if (trimmedFare && (!/^\d+(\.\d+)?$/.test(trimmedFare) || Number(trimmedFare) <= 0)) {
      setCreateRouteError('Base fare must be a positive number.')
      return
    }

    setCreateRouteError('')

    const normalizedFareValue = newRoute.baseFare.trim()
    const normalizedFare =
      normalizedFareValue.length > 0 && !normalizedFareValue.toLowerCase().startsWith('rs.')
        ? `Rs.${normalizedFareValue}`
        : normalizedFareValue || 'Rs.0'

    const createdRoute: RouteRow = {
      name: newRoute.name.trim(),
      code: newRoute.code.trim(),
      type: newRoute.type,
      distance: newRoute.distance.trim() || '0 km',
      duration: newRoute.duration.trim() || '0h 0m',
      stops: Number(newRoute.stops) || 0,
      activeBuses: Number(newRoute.activeBuses) || 0,
      baseFare: normalizedFare,
      status: newRoute.status,
    }

    setRoutesData((previous) => [createdRoute, ...previous])
    setIsCreateModalOpen(false)
    setCreateRouteError('')
    setNewRoute({
      name: '',
      code: '',
      type: 'High Way',
      distance: '',
      duration: '',
      stops: '',
      activeBuses: '',
      baseFare: '',
      status: 'Active',
    })
  }

  return (
    <div className="h-screen bg-[#efeff4]" style={{ fontFamily: 'Manrope, Segoe UI, sans-serif' }}>
      <Sidebar mainMenu={mainMenu} systemMenu={systemMenu} />

      <div className="ml-[314px] flex h-screen flex-col">
        <Navbar
          breadcrumbs={['Home', 'Routes']}
          onLogout={handleLogout}
          unreadCount={1}
        />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-[1700px] space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="animate-dash-in text-[48px] font-extrabold tracking-tight text-[#1f2737]" style={{ animationDelay: '80ms' }}>
                Route Management
              </h1>
              <button
                type="button"
                onClick={() => {
                  setCreateRouteError('')
                  setIsCreateModalOpen(true)
                }}
                className="animate-dash-in flex items-center gap-2 rounded-xl bg-[#2642a6] px-6 py-3 text-lg font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#203b96]"
                style={{ animationDelay: '110ms' }}
              >
                <FontAwesomeIcon icon={faPlus} />
                Create New Route
              </button>
            </div>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SummaryCard
                icon={faRoute}
                iconWrap="bg-[#eef0f7] text-[#2642a6]"
                title="Total Routes"
                value="142"
                delay="130ms"
              />
              <SummaryCard
                icon={faCheckCircle}
                iconWrap="bg-[#e5f7ef] text-[#1aac6e]"
                title="Active Routes"
                value="128"
                delay="170ms"
              />
              <SummaryCard
                icon={faBus}
                iconWrap="bg-[#e8efff] text-[#2e63d8]"
                title="Buses Deployed"
                value="356"
                delay="210ms"
              />
            </section>

            <section
              className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm"
              style={{ animationDelay: '240ms' }}
            >
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name, code..."
                  className="h-12 min-w-[320px] rounded-xl border border-[#d4d9e4] bg-[#f8f9fd] px-4 text-sm text-[#2f394d] outline-none"
                />

                <div className="relative min-w-[190px]">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                    className="h-12 w-full appearance-none rounded-xl border border-[#d4d9e4] bg-[#f8f9fd] px-4 pr-10 text-sm text-[#2f394d] outline-none"
                  >
                    <option value="all">Status: All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#69758d]"
                  />
                </div>

                <div className="relative min-w-[190px]">
                  <select
                    value={busTypeFilter}
                    onChange={(event) => setBusTypeFilter(event.target.value as 'all' | 'high-way' | 'long-distance')}
                    className="h-12 w-full appearance-none rounded-xl border border-[#d4d9e4] bg-[#f8f9fd] px-4 pr-10 text-sm text-[#2f394d] outline-none"
                  >
                    <option value="all">Bus Type: All</option>
                    <option value="high-way">High Way</option>
                    <option value="long-distance">Long Distance</option>
                  </select>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#69758d]"
                  />
                </div>
              </div>
            </section>

            <section
              className="dashboard-card animate-dash-in overflow-hidden rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] shadow-sm"
              style={{ animationDelay: '280ms' }}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px]">
                  <thead className="border-b border-[#e2e6ef] bg-[#f4f6fb] text-left">
                    <tr className="text-xs uppercase tracking-wide text-[#6f7890]">
                      <th className="px-5 py-4">Route Name & Code</th>
                      <th className="px-5 py-4">Map Preview</th>
                      <th className="px-5 py-4">Details</th>
                      <th className="px-5 py-4">Stops</th>
                      <th className="px-5 py-4">Active Buses</th>
                      <th className="px-5 py-4">Base Fare</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoutes.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-8 text-center text-sm font-semibold text-[#6f7890]">
                          No routes match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRoutes.map((route) => (
                        <tr
                          key={route.code}
                          className="border-b border-[#e7eaf1] text-[#1f2737] transition duration-200 hover:bg-[#f2f5fd]"
                        >
                          <td className="px-5 py-4">
                            <p className="text-[27px] font-extrabold">{route.name}</p>
                            <p className="mt-1 text-xs text-[#748097]">
                              <span className="rounded bg-[#eef2f8] px-2 py-0.5 font-semibold text-[#69758d]">{route.code}</span>
                              <span className="mx-1">*</span>
                              {route.type}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <img
                              src={mapPreviewImage}
                              alt={`Map preview for ${route.name}`}
                              className="h-16 w-28 rounded-md border border-[#d8dfeb] object-cover"
                            />
                          </td>
                          <td className="px-5 py-4 text-sm text-[#657089]">
                            <p>
                              <FontAwesomeIcon icon={faRulerHorizontal} className="mr-1" />
                              {route.distance}
                            </p>
                            <p className="mt-1">
                              <FontAwesomeIcon icon={faClock} className="mr-1" />
                              {route.duration}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#edf0f6] text-sm font-bold text-[#2f394d]">
                              {route.stops}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-lg font-bold text-[#139f66]">
                            <FontAwesomeIcon icon={faBus} className="mr-1 text-sm" />
                            {route.activeBuses}
                          </td>
                          <td className="px-5 py-4 text-4xl font-extrabold text-[#1f2737]">{route.baseFare}</td>
                          <td className="px-5 py-4">
                            <span
                              className={[
                                'inline-flex rounded-full px-3 py-1 text-xs font-bold',
                                route.status === 'Active'
                                  ? 'bg-[#dff6eb] text-[#11a765]'
                                  : 'bg-[#eef0f4] text-[#6f798f]',
                              ].join(' ')}
                            >
                              {route.status}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-4 text-[#6f7890]">
                              <button type="button" aria-label={`Edit route ${route.name}`} className="transition duration-200 hover:text-[#1f2737]">
                                <FontAwesomeIcon icon={faPen} />
                              </button>
                              <button type="button" aria-label={`Suspend route ${route.name}`} className="transition duration-200 hover:text-[#1f2737]">
                                <FontAwesomeIcon icon={faBan} />
                              </button>
                              <button type="button" aria-label={`Delete route ${route.name}`} className="transition duration-200 hover:text-[#d74949]">
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-[#e2e6ef] px-5 py-4 text-sm text-[#667288]">
                <p>
                  Showing{' '}
                  <span className="rounded-lg border border-[#d7dde9] bg-[#f7f9fd] px-2 py-1 font-semibold text-[#2f394d]">{filteredRoutes.length}</span>{' '}
                  of <span className="font-semibold text-[#2f394d]">{routesData.length} routes</span>
                </p>

                <div className="flex items-center gap-4">
                  <button type="button" aria-label="Previous page" className="text-[#6d778e] hover:text-[#23385f]">
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-md bg-[#2642a6] text-sm font-semibold text-white"
                  >
                    1
                  </button>
                  <button type="button" className="text-sm font-semibold text-[#627089] hover:text-[#2a3550]">2</button>
                  <button type="button" className="text-sm font-semibold text-[#627089] hover:text-[#2a3550]">3</button>
                  <span>...</span>
                  <button type="button" className="text-sm font-semibold text-[#627089] hover:text-[#2a3550]">15</button>
                  <button type="button" aria-label="Next page" className="text-[#6d778e] hover:text-[#23385f]">
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#101426]/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-[#d8deea] bg-[#f7f8fc] shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="flex items-center justify-between border-b border-[#e1e5ef] px-6 py-4">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1f2737]">Create New Route</h2>
                <p className="text-sm text-[#6d778e]">Add route data and save it to the table.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false)
                  setCreateRouteError('')
                }}
                className="grid h-9 w-9 place-items-center rounded-md text-[#6d778e] transition duration-200 hover:bg-[#eceff7] hover:text-[#1f2737]"
                aria-label="Close create route modal"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <form onSubmit={handleCreateRoute} className="space-y-5 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="route-name">
                    Route Name
                  </label>
                  <input
                    id="route-name"
                    required
                    value={newRoute.name}
                    onChange={(event) => setNewRoute((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Colombo - Kurunegala"
                    className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="route-code">
                    Route Code
                  </label>
                  <input
                    id="route-code"
                    required
                    value={newRoute.code}
                    onChange={(event) => setNewRoute((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder="RT-200"
                    className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="route-type">
                    Bus Type
                  </label>
                  <select
                    id="route-type"
                    value={newRoute.type}
                    onChange={(event) => setNewRoute((prev) => ({ ...prev, type: event.target.value }))}
                    className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                  >
                    <option value="High Way">High Way</option>
                    <option value="Long Distance">Long Distance</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="route-status">
                    Status
                  </label>
                  <select
                    id="route-status"
                    value={newRoute.status}
                    onChange={(event) =>
                      setNewRoute((prev) => ({
                        ...prev,
                        status: event.target.value as RouteRow['status'],
                      }))
                    }
                    className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="route-distance">
                    Distance
                  </label>
                  <input
                    id="route-distance"
                    value={newRoute.distance}
                    onChange={(event) => setNewRoute((prev) => ({ ...prev, distance: event.target.value }))}
                    placeholder="120 km"
                    className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="route-duration">
                    Duration
                  </label>
                  <input
                    id="route-duration"
                    value={newRoute.duration}
                    onChange={(event) => setNewRoute((prev) => ({ ...prev, duration: event.target.value }))}
                    placeholder="2h 35m"
                    className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="route-stops">
                    Stops
                  </label>
                  <input
                    id="route-stops"
                    type="number"
                    min={0}
                    value={newRoute.stops}
                    onChange={(event) => setNewRoute((prev) => ({ ...prev, stops: event.target.value }))}
                    placeholder="6"
                    className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="route-active-buses">
                    Active Buses
                  </label>
                  <input
                    id="route-active-buses"
                    type="number"
                    min={0}
                    value={newRoute.activeBuses}
                    onChange={(event) => setNewRoute((prev) => ({ ...prev, activeBuses: event.target.value }))}
                    placeholder="4"
                    className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#45516b]" htmlFor="route-fare">
                  Base Fare
                </label>
                <input
                  id="route-fare"
                  value={newRoute.baseFare}
                  onChange={(event) => setNewRoute((prev) => ({ ...prev, baseFare: event.target.value }))}
                  placeholder="450"
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[#e1e5ef] pt-4">
                {createRouteError ? (
                  <p className="mr-auto text-sm font-semibold text-[#d14343]">{createRouteError}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false)
                    setCreateRouteError('')
                  }}
                  className="rounded-lg border border-[#d3d9e6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#e9edf7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-bold text-white transition duration-200 hover:bg-[#203b96]"
                >
                  Create Route
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Routes
