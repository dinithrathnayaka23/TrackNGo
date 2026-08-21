import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  faBus,
  faCheckCircle,
  faBan,
  faPen,
  faPlus,
  faRoute,
  faTrash,
  faClock,
  faRulerHorizontal,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faListOl,
  faSearch,
  faSpinner,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
//Fetching API services from  routeService
import {
  fetchRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  toggleRouteStatus,
  type RouteRow,
} from '../../services/routeService'


//Fetching Google Map API key from Environmental Variables
const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim()

function mapQuery(location: string) {
  const normalizedLocation = location.trim() || 'Colombo'
  return `${normalizedLocation}, Sri Lanka`
}

let mapsScriptLoaded = false
function loadMapsScript(): Promise<void> {
  if (!GOOGLE_MAPS_KEY) {
    return Promise.reject(new Error('Google Maps API key is missing'))
  }
  if (mapsScriptLoaded || window.google?.maps) {
    mapsScriptLoaded = true
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=marker`
    script.async = true
    script.onload = () => { mapsScriptLoaded = true; resolve() }
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })
}

function buildEmbedMapUrl(location: string, zoom = 13) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery(location))}&z=${zoom}&output=embed`
}

function RouteMapEmbed({ location }: { location: string }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [useEmbedFallback, setUseEmbedFallback] = useState(!GOOGLE_MAPS_KEY)

  useEffect(() => {
    let cancelled = false
    setUseEmbedFallback(!GOOGLE_MAPS_KEY)

    async function init() {
      try {
        await loadMapsScript()
      } catch {
        if (!cancelled) setUseEmbedFallback(true)
        return
      }
      if (cancelled || !mapRef.current) return

      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ address: mapQuery(location) }, (results, status) => {
        if (cancelled || !mapRef.current) return
        const center =
          status === 'OK' && results && results[0]
            ? results[0].geometry.location
            : new google.maps.LatLng(6.9271, 79.8612) // fallback: Colombo

        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
        })

        new google.maps.Marker({
          position: center,
          map,
          title: location,
          icon: {
            url: 'https://maps.google.com/mapfiles/kml/shapes/bus.png',
            scaledSize: new google.maps.Size(40, 40),
          },
        })
      })
    }

    init()
    return () => { cancelled = true }
  }, [location])

  if (useEmbedFallback) {
    return (
      <iframe
        title={`Map preview for ${location}`}
        src={buildEmbedMapUrl(location, 14)}
        className="h-[50vh] max-h-[360px] w-full rounded-lg border border-[#e5e7eb]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    )
  }

  return <div ref={mapRef} className="h-[50vh] max-h-[360px] w-full rounded-lg border border-[#e5e7eb]" />
}

function buildStaticMapUrl(startLocation: string) {
  if (!GOOGLE_MAPS_KEY) return null
  const loc = encodeURIComponent(mapQuery(startLocation))
  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${loc}&zoom=13&size=280x160&scale=2&maptype=roadmap` +
    `&key=${GOOGLE_MAPS_KEY}`
  )
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildMapFallbackImage(location: string, routeName: string) {
  const safeLocation = escapeSvgText(mapQuery(location))
  const safeRouteName = escapeSvgText(routeName.trim() || 'Route')
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="280" height="160" viewBox="0 0 280 160">
      <rect width="280" height="160" fill="#eaf1f8"/>
      <path d="M-20 118 C50 86 98 158 162 112 C205 82 229 102 300 52" fill="none" stroke="#ffffff" stroke-width="30" stroke-linecap="round"/>
      <path d="M-20 118 C50 86 98 158 162 112 C205 82 229 102 300 52" fill="none" stroke="#b9c8d8" stroke-width="4" stroke-linecap="round" stroke-dasharray="12 10"/>
      <path d="M16 38 L94 12 L154 36 L232 16 L264 32 L264 146 L188 130 L126 150 L64 124 L16 142 Z" fill="none" stroke="#c8d5e3" stroke-width="2"/>
      <text x="16" y="24" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#1f2737">${safeRouteName}</text>
      <text x="16" y="146" font-family="Arial, sans-serif" font-size="11" fill="#536178">${safeLocation}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function RouteMapThumbnail({
  location,
  routeName,
  onOpen,
}: {
  location: string
  routeName: string
  onOpen: () => void
}) {
  const fallbackImage = useMemo(() => buildMapFallbackImage(location, routeName), [location, routeName])
  const [imageSrc, setImageSrc] = useState(() => buildStaticMapUrl(location) ?? fallbackImage)
  const staticMapUrl = buildStaticMapUrl(location)

  useEffect(() => {
    setImageSrc(staticMapUrl ?? fallbackImage)
  }, [fallbackImage, staticMapUrl])

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block h-16 w-28 cursor-pointer overflow-hidden rounded-md border border-[#e5e7eb] bg-[#edf1f8] transition duration-200 hover:ring-2 hover:ring-[#2642a6]/40 focus:outline-none focus:ring-2 focus:ring-[#2642a6]/50"
      aria-label={`Open map preview for ${routeName}`}
    >
      <img
        src={imageSrc}
        alt={`Map preview for ${routeName}`}
        className="h-full w-full object-cover"
        onError={() => setImageSrc(fallbackImage)}
      />
    </button>
  )
}

const formatStopPriorityLabel = (index: number) => {
  const position = index + 1
  const mod10 = position % 10
  const mod100 = position % 100
  if (mod10 === 1 && mod100 !== 11) return `${position}st stop`
  if (mod10 === 2 && mod100 !== 12) return `${position}nd stop`
  if (mod10 === 3 && mod100 !== 13) return `${position}rd stop`
  return `${position}th stop`
}

function SummaryCard({
  icon,
  iconWrap,
  title,
  value,
  valueTone = 'text-[#111827]',
  delay,
}: {
  icon: typeof faRoute
  iconWrap: string
  title: string
  value: string
  valueTone?: string
  delay: string
}) {
  return (
    <article
      className="animate-dash-in flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4"
      style={{ animationDelay: delay }}
    >
      <div>
        <p className="text-sm text-[#64748b] font-semibold">{title}</p>
        <p className={['mt-1 text-2xl font-extrabold', valueTone].join(' ')}>{value}</p>
      </div>
      <div className={['grid h-10 w-10 place-items-center rounded-lg', iconWrap].join(' ')}>
        <FontAwesomeIcon icon={icon} />
      </div>
    </article>
  )
}

function Routes() {
  // Filter and create-route state for the route management table.
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [busTypeFilter, setBusTypeFilter] = useState<'all' | 'high-way' | 'long-distance'>('all')
  const [routesData, setRoutesData] = useState<RouteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null)
  const [routePendingDelete, setRoutePendingDelete] = useState<RouteRow | null>(null)
  const [routeStopsPreview, setRouteStopsPreview] = useState<RouteRow | null>(null)
  const [mapPreviewRoute, setMapPreviewRoute] = useState<RouteRow | null>(null)
  const [createRouteError, setCreateRouteError] = useState('')
  const [newRoute, setNewRoute] = useState({
    name: '',
    code: '',
    type: 'High Way',
    distance: '',
    duration: '',
    stops: ['', ''],
    activeBuses: '',
    baseFare: '',
    status: 'Active' as RouteRow['status'],
  })

  const loadRoutes = useCallback(async () => {
    try {
      setLoading(true)
      setApiError('')
      const data = await fetchRoutes()
      setRoutesData(data)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to load routes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRoutes()
  }, [loadRoutes])

  const resetRouteForm = () => {
    setNewRoute({
      name: '',
      code: '',
      type: 'High Way',
      distance: '',
      duration: '',
      stops: ['', ''],
      activeBuses: '',
      baseFare: '',
      status: 'Active',
    })
  }

  const openCreateRouteModal = () => {
    setEditingRouteId(null)
    setCreateRouteError('')
    resetRouteForm()
    setIsCreateModalOpen(true)
  }

  // Derived list keeps table rendering declarative and avoids inline filter logic in JSX.
  const filteredRoutes = useMemo(
    () =>
      routesData.filter((route) => {
        const normalizedType = (route.type ?? '').toLowerCase().replace(/\s+/g, '-')
        const normalizedSearch = searchTerm.trim().toLowerCase()

        const matchesSearch =
          normalizedSearch.length === 0 ||
          route.name.toLowerCase().includes(normalizedSearch) ||
          (route.code ?? '').toLowerCase().includes(normalizedSearch)

        const matchesStatus = statusFilter === 'all' || route.status.toLowerCase() === statusFilter
        const matchesBusType = busTypeFilter === 'all' || normalizedType === busTypeFilter

        return matchesSearch && matchesStatus && matchesBusType
      }),
    [routesData, searchTerm, statusFilter, busTypeFilter],
  )

  const totalRoutes = routesData.length
  const activeRoutes = routesData.filter((route) => route.status === 'Active').length
  const busesDeployed = routesData
    .filter((route) => route.status === 'Active')
    .reduce((sum, route) => sum + route.activeBuses, 0)

  const handleCreateRoute = async (event: FormEvent<HTMLFormElement>) => {
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

    if (!/^[A-Za-z0-9-]+$/.test(trimmedCode)) {
      setCreateRouteError('Route code can only contain letters, numbers, and hyphens.')
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

    const normalizedStops = newRoute.stops.map((stop) => stop.trim()).filter((stop) => stop.length > 0)

    if (normalizedStops.length < 2) {
      setCreateRouteError('Please add at least two stop names in order.')
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

    const routePayload: RouteRow = {
      name: newRoute.name.trim(),
      code: newRoute.code.trim(),
      type: newRoute.type,
      distance: newRoute.distance.trim() || '0 km',
      duration: newRoute.duration.trim() || '0h 0m',
      stops: normalizedStops,
      activeBuses: Number(newRoute.activeBuses) || 0,
      baseFare: normalizedFare,
      status: newRoute.status,
    }

    try {
      if (editingRouteId) {
        await updateRoute(editingRouteId, routePayload)
      } else {
        await createRoute(routePayload)
      }
      setIsCreateModalOpen(false)
      setEditingRouteId(null)
      setCreateRouteError('')
      resetRouteForm()
      await loadRoutes()
    } catch (err) {
      setCreateRouteError(err instanceof Error ? err.message : 'Failed to save route')
    }
  }

  const handleEditRoute = (route: RouteRow) => {
    setEditingRouteId(route.id ?? null)
    setCreateRouteError('')
    setNewRoute({
      name: route.name,
      code: route.code,
      type: route.type === 'High Way' || route.type === 'Long Distance' ? route.type : 'High Way',
      distance: route.distance,
      duration: route.duration,
      stops: route.stops.length >= 2 ? [...route.stops] : [...route.stops, ''],
      activeBuses: String(route.activeBuses),
      baseFare: route.baseFare.replace(/^Rs\.?/i, ''),
      status: route.status === 'Active' || route.status === 'Inactive' ? route.status : 'Active',
    })
    setIsCreateModalOpen(true)
  }

  const handleToggleSuspendRoute = async (routeId: number | undefined) => {
    if (!routeId) return
    try {
      await toggleRouteStatus(routeId)
      await loadRoutes()
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to toggle status')
    }
  }

  const handleDeleteRoute = (route: RouteRow) => {
    setRoutePendingDelete(route)
  }

  const cancelDeleteRoute = () => {
    setRoutePendingDelete(null)
  }

  const confirmDeleteRoute = async () => {
    if (!routePendingDelete?.id) return
    try {
      await deleteRoute(routePendingDelete.id)
      setRoutePendingDelete(null)
      await loadRoutes()
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to delete route')
      setRoutePendingDelete(null)
    }
  }

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="animate-dash-in text-xl font-extrabold tracking-tight text-[#111827]" style={{ animationDelay: '80ms' }}>
                Route Management
              </h1>
              <button
                type="button"
                onClick={openCreateRouteModal}
                className="animate-dash-in inline-flex items-center gap-1.5 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#203b96]"
                style={{ animationDelay: '110ms' }}
              >
                <FontAwesomeIcon icon={faPlus} className="text-xs" />
                Create New Route
              </button>
            </div>

            {apiError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {apiError}
                <button type="button" onClick={() => setApiError('')} className="ml-2 underline">Dismiss</button>
              </div>
            ) : null}

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryCard
                icon={faRoute}
                iconWrap="bg-[#f1f5f9] text-[#334155]"
                title="Total Routes"
                value={String(totalRoutes)}
                delay="130ms"
              />
              <SummaryCard
                icon={faCheckCircle}
                iconWrap="bg-[#dcfce7] text-[#16a34a]"
                title="Active Routes"
                value={String(activeRoutes)}
                valueTone="text-[#16a34a]"
                delay="170ms"
              />
              <SummaryCard
                icon={faBus}
                iconWrap="bg-[#e8efff] text-[#2e63d8]"
                title="Buses Deployed"
                value={String(busesDeployed)}
                valueTone="text-[#2e63d8]"
                delay="210ms"
              />
            </section>

            <div className="animate-dash-in flex flex-wrap items-center gap-3" style={{ animationDelay: '240ms' }}>
              <div className="relative min-w-[200px] flex-1">
                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name, code..."
                  className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                />
              </div>

              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                  className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155] outline-none transition focus:border-[#2642a6]"
                >
                  <option value="all">Status: All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]"
                />
              </div>

              <div className="relative">
                <select
                  value={busTypeFilter}
                  onChange={(event) => setBusTypeFilter(event.target.value as 'all' | 'high-way' | 'long-distance')}
                  className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155] outline-none transition focus:border-[#2642a6]"
                >
                  <option value="all">Bus Type: All</option>
                  <option value="high-way">High Way</option>
                  <option value="long-distance">Long Distance</option>
                </select>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]"
                />
              </div>
            </div>

            <section
              className="animate-dash-in overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)]"
              style={{ animationDelay: '280ms' }}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px]">
                  <thead className="border-b border-[#e5e7eb] bg-[#f4f6fb] text-left">
                    <tr className="text-xs uppercase tracking-wide text-[#64748b] font-semibold">
                      <th className="px-4 py-3">Route Name & Code</th>
                      <th className="px-4 py-3">Map Preview</th>
                      <th className="px-4 py-3">Details</th>
                      <th className="px-4 py-3">Stops (Ordered)</th>
                      <th className="px-4 py-3">Active Buses</th>
                      <th className="px-4 py-3">Base Fare</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-8 text-center text-sm font-semibold text-[#64748b]">
                          <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                          Loading routes...
                        </td>
                      </tr>
                    ) : filteredRoutes.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-8 text-center text-sm font-semibold text-[#64748b]">
                          No routes match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRoutes.map((route) => (
                        <tr
                          key={route.id ?? route.code}
                          className="border-b border-[#e5e7eb] text-[#111827] transition duration-200 hover:bg-[#f2f5fd]"
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm font-extrabold">{route.name}</p>
                            <p className="mt-1 text-xs text-[#64748b]">
                              <span className="rounded bg-[#eef2f8] px-2 py-0.5 font-semibold text-[#64748b]">{route.code}</span>
                              <span className="mx-1">*</span>
                              {route.type}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <RouteMapThumbnail
                              location={route.stops[0] ?? route.name}
                              routeName={route.name}
                              onOpen={() => setMapPreviewRoute(route)}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-[#64748b]">
                            <p>
                              <FontAwesomeIcon icon={faRulerHorizontal} className="mr-1" />
                              {route.distance}
                            </p>
                            <p className="mt-1">
                              <FontAwesomeIcon icon={faClock} className="mr-1" />
                              {route.duration}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setRouteStopsPreview(route)}
                              className="inline-flex items-center gap-2 rounded-lg border border-[#d6dbe6] bg-[#f2f5fb] px-3 py-2 text-xs font-semibold text-[#334155] transition duration-200 hover:bg-[#eaf0fb]"
                            >
                              <FontAwesomeIcon icon={faListOl} />
                              Click to view stops
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-[#139f66]">
                            <FontAwesomeIcon icon={faBus} className="mr-1 text-sm" />
                            {route.activeBuses}
                          </td>
                          <td className="px-4 py-3 text-sm font-extrabold text-[#111827]">{route.baseFare}</td>
                          <td className="px-4 py-3">
                            <span
                              className={[
                                'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold',
                                route.status === 'Active'
                                  ? 'bg-[#dff6eb] text-[#11a765]'
                                  : 'bg-[#eef0f4] text-[#64748b]',
                              ].join(' ')}
                            >
                              {route.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-4 text-[#64748b]">
                              <button
                                type="button"
                                aria-label={`Edit route ${route.name}`}
                                onClick={() => handleEditRoute(route)}
                                className="transition duration-200 hover:text-[#111827]"
                              >
                                <FontAwesomeIcon icon={faPen} />
                              </button>
                              <button
                                type="button"
                                aria-label={`${route.status === 'Active' ? 'Suspend' : 'Activate'} route ${route.name}`}
                                onClick={() => handleToggleSuspendRoute(route.id)}
                                className="transition duration-200 hover:text-[#111827]"
                              >
                                <FontAwesomeIcon icon={faBan} />
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete route ${route.name}`}
                                onClick={() => handleDeleteRoute(route)}
                                className="transition duration-200 hover:text-[#d74949]"
                              >
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

              <div className="flex items-center justify-between border-t border-[#e5e7eb] px-4 py-3 text-sm text-[#64748b]">
                <p>
                  Showing{' '}
                  <span className="rounded-lg border border-[#d6dbe6] bg-[#f7f9fd] px-2 py-1 font-semibold text-[#334155]">{filteredRoutes.length}</span>{' '}
                  of <span className="font-semibold text-[#334155]">{routesData.length} routes</span>
                </p>

                <div className="flex items-center gap-4">
                  <button type="button" aria-label="Previous page" className="text-[#64748b] hover:text-[#2642a6]">
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-md bg-[#2642a6] text-sm font-semibold text-white"
                  >
                    1
                  </button>
                  <button type="button" className="text-sm font-semibold text-[#64748b] hover:text-[#111827]">2</button>
                  <button type="button" className="text-sm font-semibold text-[#64748b] hover:text-[#111827]">3</button>
                  <span>...</span>
                  <button type="button" className="text-sm font-semibold text-[#64748b] hover:text-[#111827]">15</button>
                  <button type="button" aria-label="Next page" className="text-[#64748b] hover:text-[#2642a6]">
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>
              </div>
            </section>
          </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#101426]/45 p-4">
          <div className="my-auto flex w-full max-w-3xl flex-col rounded-2xl border border-[#d6dbe6] bg-white shadow-[0_28px_80px_rgba(17,27,52,0.32)]" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#111827]">
                  {editingRouteId ? 'Edit Route' : 'Create New Route'}
                </h2>
                <p className="text-sm text-[#64748b]">
                  {editingRouteId ? 'Update route data and save your changes.' : 'Add route data and save it to the table.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false)
                  setEditingRouteId(null)
                  setCreateRouteError('')
                  resetRouteForm()
                }}
                className="grid h-9 w-9 place-items-center rounded-md text-[#64748b] transition duration-200 hover:bg-[#eceff7] hover:text-[#111827]"
                aria-label="Close create route modal"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <form id="route-form" onSubmit={handleCreateRoute} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#334155]" htmlFor="route-name">
                    Route Name
                  </label>
                  <input
                    id="route-name"
                    required
                    value={newRoute.name}
                    onChange={(event) => setNewRoute((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Colombo - Kurunegala"
                    className="h-11 w-full rounded-lg border border-[#d6dbe6] px-3 text-sm text-[#111827] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#334155]" htmlFor="route-code">
                    Route Code
                  </label>
                  <input
                    id="route-code"
                    value={newRoute.code}
                    onChange={(event) => setNewRoute((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder="e.g. RT-200"
                    className="h-11 w-full rounded-lg border border-[#d6dbe6] px-3 text-sm text-[#111827] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#334155]" htmlFor="route-type">
                    Bus Type
                  </label>
                  <select
                    id="route-type"
                    value={newRoute.type}
                    onChange={(event) => setNewRoute((prev) => ({ ...prev, type: event.target.value }))}
                    className="h-11 w-full rounded-lg border border-[#d6dbe6] px-3 text-sm text-[#111827] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                  >
                    <option value="High Way">High Way</option>
                    <option value="Long Distance">Long Distance</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#334155]" htmlFor="route-status">
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
                    className="h-11 w-full rounded-lg border border-[#d6dbe6] px-3 text-sm text-[#111827] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#334155]" htmlFor="route-distance">
                    Distance
                  </label>
                  <input
                    id="route-distance"
                    value={newRoute.distance}
                    onChange={(event) => setNewRoute((prev) => ({ ...prev, distance: event.target.value }))}
                    placeholder="120 km"
                    className="h-11 w-full rounded-lg border border-[#d6dbe6] px-3 text-sm text-[#111827] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#334155]" htmlFor="route-duration">
                    Duration
                  </label>
                  <input
                    id="route-duration"
                    value={newRoute.duration}
                    onChange={(event) => setNewRoute((prev) => ({ ...prev, duration: event.target.value }))}
                    placeholder="2h 35m"
                    className="h-11 w-full rounded-lg border border-[#d6dbe6] px-3 text-sm text-[#111827] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#334155]">
                    Stop Names (Priority Order)
                  </label>
                  <div className="space-y-2">
                    {newRoute.stops.map((stop, index) => (
                      <div key={`stop-input-${index}`} className="flex items-center gap-2">
                        <input
                          value={stop}
                          onChange={(event) => {
                            const updatedStops = newRoute.stops.map((item, itemIndex) =>
                              itemIndex === index ? event.target.value : item,
                            )
                            setNewRoute((prev) => ({
                              ...prev,
                              stops: updatedStops,
                            }))
                          }}
                          placeholder={`Enter ${formatStopPriorityLabel(index)}`}
                          className="h-11 w-full rounded-lg border border-[#d6dbe6] px-3 text-sm text-[#111827] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updatedStops = newRoute.stops.length > 2
                              ? newRoute.stops.filter((_, itemIndex) => itemIndex !== index)
                              : newRoute.stops
                            setNewRoute((prev) => ({
                              ...prev,
                              stops: updatedStops,
                            }))
                          }}
                          disabled={newRoute.stops.length <= 2}
                          className="rounded-lg border border-[#d6dbe6] bg-[#f3f6fc] px-3 py-2 text-xs font-semibold text-[#334155] transition duration-200 hover:bg-[#e9edf7] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setNewRoute((prev) => ({
                          ...prev,
                          stops: [...prev.stops, ''],
                        }))
                      }
                      className="rounded-lg border border-[#d6dbe6] bg-[#f3f6fc] px-3 py-2 text-xs font-semibold text-[#334155] transition duration-200 hover:bg-[#e9edf7]"
                    >
                      + Add Next Stop
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#334155]" htmlFor="route-active-buses">
                    Active Buses
                  </label>
                  <input
                    id="route-active-buses"
                    type="number"
                    min={0}
                    value={newRoute.activeBuses}
                    onChange={(event) => setNewRoute((prev) => ({ ...prev, activeBuses: event.target.value }))}
                    placeholder="4"
                    className="h-11 w-full rounded-lg border border-[#d6dbe6] px-3 text-sm text-[#111827] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]" htmlFor="route-fare">
                  Base Fare
                </label>
                <input
                  id="route-fare"
                  value={newRoute.baseFare}
                  onChange={(event) => setNewRoute((prev) => ({ ...prev, baseFare: event.target.value }))}
                  placeholder="450"
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] px-3 text-sm text-[#111827] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                />
              </div>

            </form>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#e5e7eb] px-4 py-3">
              {createRouteError ? (
                <p className="mr-auto text-sm font-semibold text-[#d14343]">{createRouteError}</p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false)
                  setEditingRouteId(null)
                  setCreateRouteError('')
                  resetRouteForm()
                }}
                className="rounded-lg border border-[#d6dbe6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#334155] transition duration-200 hover:bg-[#e9edf7]"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="route-form"
                className="rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[#203b96]"
              >
                {editingRouteId ? 'Save Changes' : 'Create Route'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {routeStopsPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101426]/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#d6dbe6] bg-white shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#111827]">Route Stops</h2>
                <p className="text-sm text-[#64748b]">
                  {routeStopsPreview.name} ({routeStopsPreview.code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRouteStopsPreview(null)}
                className="grid h-9 w-9 place-items-center rounded-md text-[#64748b] transition duration-200 hover:bg-[#eceff7] hover:text-[#111827]"
                aria-label="Close route stops popup"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="max-h-[55vh] space-y-2 overflow-y-auto px-4 py-3">
              {routeStopsPreview.stops.map((stop, index) => (
                <div
                  key={`${routeStopsPreview.code}-popup-stop-${index}`}
                  className="rounded-lg border border-[#e5e7eb] bg-[#f9fafd] px-4 py-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                    {formatStopPriorityLabel(index)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#334155]">{stop}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-[#e5e7eb] px-4 py-3">
              <button
                type="button"
                onClick={() => setRouteStopsPreview(null)}
                className="rounded-lg border border-[#d6dbe6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#334155] transition duration-200 hover:bg-[#e9edf7]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mapPreviewRoute ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101426]/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#d6dbe6] bg-white shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-3 py-2">
              <div>
                <h2 className="text-lg font-extrabold text-[#111827]">Route Location</h2>
                <p className="text-sm text-[#64748b]">
                  {mapPreviewRoute.name} — Start: {mapPreviewRoute.stops[0] ?? 'N/A'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMapPreviewRoute(null)}
                className="grid h-9 w-9 place-items-center rounded-md text-[#64748b] transition duration-200 hover:bg-[#eceff7] hover:text-[#111827]"
                aria-label="Close map preview"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="p-2">
              <RouteMapEmbed location={mapPreviewRoute.stops[0] ?? mapPreviewRoute.name} />
            </div>

            <div className="flex justify-end border-t border-[#e5e7eb] px-3 py-2">
              <button
                type="button"
                onClick={() => setMapPreviewRoute(null)}
                className="rounded-lg border border-[#d6dbe6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#334155] transition duration-200 hover:bg-[#e9edf7]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {routePendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101426]/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#f0d6d6] bg-[#fff7f7] shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="border-b border-[#e5e7eb] px-4 py-3">
              <h2 className="text-lg font-extrabold text-[#8d1f1f]">Delete Route</h2>
              <p className="text-sm text-[#9a5555]">
                Are you sure you want to delete {routePendingDelete.name} ({routePendingDelete.code})?
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-4 py-3">
              <button
                type="button"
                onClick={cancelDeleteRoute}
                className="rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition duration-200 hover:bg-[#f5f7fc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRoute}
                className="rounded-lg bg-[#e04444] px-5 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[#d43939]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default Routes
