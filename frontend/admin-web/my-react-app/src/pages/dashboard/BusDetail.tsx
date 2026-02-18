import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  faArrowLeft,
  faBook,
  faBus,
  faChartColumn,
  faChartSimple,
  faChargingStation,
  faComment,
  faEllipsis,
  faLocationDot,
  faPen,
  faPhone,
  faScrewdriverWrench,
  faSnowflake,
  faStar,
  faToilet,
  faTrash,
  faTriangleExclamation,
  faTv,
  faUsers,
  faWifi,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import adminProfileImage from '../../assets/images/adminProfile.png'
import mapImage from '../../assets/images/map.png'
import Navbar from '../../components/layout/Navbar'
import Sidebar, { type SidebarMenuItem } from '../../components/layout/Sidebar'
import { logoutToLogin } from '../../utils/authSession'

type Amenity = {
  name: string
  icon: IconDefinition
  enabled: boolean
}

type Driver = {
  name: string
  id: string
  phone: string
  rating: string
  trips: string
}

type BusInfo = {
  code: string
  seats: string
  brand: string
  condition: string
  type: string
  insuranceExp: string
  status: 'Active' | 'Maintenance'
}

type DashboardTab = 'overview' | 'schedule' | 'revenue'

const mainMenu: SidebarMenuItem[] = [
  { label: 'Dashboard', icon: faChartSimple },
  { label: 'Users', icon: faUsers },
  { label: 'Buses', icon: faBus, active: true },
  { label: 'Routes', icon: faLocationDot, path: '/dashboard/routes' },
  { label: 'Bookings', icon: faBook },
]

const systemMenu: SidebarMenuItem[] = [
  { label: 'Complaints', icon: faTriangleExclamation },
  { label: 'Analytics', icon: faChartColumn },
  { label: 'Chat', icon: faComment },
]

const initialAmenities: Amenity[] = [
  { name: 'Wi-Fi', icon: faWifi, enabled: true },
  { name: 'AC', icon: faSnowflake, enabled: true },
  { name: 'Sleeper', icon: faBus, enabled: true },
  { name: 'Charging', icon: faChargingStation, enabled: true },
  { name: 'Ent. Sys', icon: faTv, enabled: true },
  { name: 'Toilet', icon: faToilet, enabled: false },
]

const initialDriver: Driver = {
  name: 'Dinesh Gamage',
  id: 'DRV-892',
  phone: '0711526987',
  rating: '4.9',
  trips: '128',
}

const driverDirectory: Record<string, string> = {
  'dinesh gamage': 'DRV-892',
  'kasun perera': 'DRV-415',
  'nimal silva': 'DRV-233',
  'amila fernando': 'DRV-761',
}

const initialBusInfo: BusInfo = {
  code: 'ND-1151',
  seats: '45',
  brand: 'King Long',
  condition: 'Super-Luxury',
  type: 'Highway',
  insuranceExp: 'Nov 2026',
  status: 'Active',
}

function BusDetail() {
  const navigate = useNavigate()
  // Persisted view state displayed on the page.
  const [amenities, setAmenities] = useState<Amenity[]>(initialAmenities)
  // Draft state lets users edit in modals without mutating live data until Save.
  const [isAmenityModalOpen, setIsAmenityModalOpen] = useState(false)
  const [amenityDraft, setAmenityDraft] = useState<Amenity[]>(initialAmenities)
  const [assignedDriver, setAssignedDriver] = useState<Driver>(initialDriver)
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false)
  const [driverDraft, setDriverDraft] = useState<Driver>(initialDriver)
  const [busInfo, setBusInfo] = useState<BusInfo>(initialBusInfo)
  const [isEditBusModalOpen, setIsEditBusModalOpen] = useState(false)
  const [busDraft, setBusDraft] = useState<BusInfo>(initialBusInfo)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isBusDeleted, setIsBusDeleted] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')
  const [isFullScheduleVisible, setIsFullScheduleVisible] = useState(false)
  const [driverFormError, setDriverFormError] = useState('')
  const [busFormError, setBusFormError] = useState('')

  const handleLogout = () => {
    logoutToLogin(navigate)
  }

  const openAmenityModal = () => {
    // Reset draft from latest saved values every time the editor opens.
    setAmenityDraft(amenities)
    setIsAmenityModalOpen(true)
  }

  const handleAmenityToggle = (amenityName: string) => {
    setAmenityDraft((current) =>
      current.map((amenity) =>
        amenity.name === amenityName ? { ...amenity, enabled: !amenity.enabled } : amenity,
      ),
    )
  }

  const handleSaveAmenities = () => {
    setAmenities(amenityDraft)
    setIsAmenityModalOpen(false)
  }

  const openDriverModal = () => {
    // Snapshot current driver into draft for safe editing.
    setDriverDraft(assignedDriver)
    setDriverFormError('')
    setIsDriverModalOpen(true)
  }

  const handleDriverNameChange = (name: string) => {
    const matchedId = driverDirectory[name.trim().toLowerCase()] ?? ''
    setDriverFormError('')
    setDriverDraft((prev) => ({ ...prev, name, id: matchedId }))
  }

  const handleSaveDriver = () => {
    const normalizedName = driverDraft.name.trim()
    const normalizedPhone = driverDraft.phone.trim()
    const normalizedTrips = driverDraft.trips.trim()

    if (!normalizedName || !driverDraft.id) {
      setDriverFormError('Please enter a valid driver name to auto-load a driver ID.')
      return
    }

    if (!/^\d{10}$/.test(normalizedPhone)) {
      setDriverFormError('Phone number must contain exactly 10 digits.')
      return
    }

    if (!/^\d+$/.test(normalizedTrips) || Number(normalizedTrips) < 0) {
      setDriverFormError('Trips must be a non-negative whole number.')
      return
    }

    setDriverFormError('')
    setAssignedDriver(driverDraft)
    setIsDriverModalOpen(false)
  }

  const openEditBusModal = () => {
    // Load current bus fields into modal draft before editing.
    setBusDraft(busInfo)
    setBusFormError('')
    setIsEditBusModalOpen(true)
  }

  const handleSaveBus = () => {
    const normalizedCode = busDraft.code.trim()
    const normalizedSeats = busDraft.seats.trim()
    const normalizedBrand = busDraft.brand.trim()
    const normalizedCondition = busDraft.condition.trim()
    const normalizedType = busDraft.type.trim()
    const normalizedInsuranceExp = busDraft.insuranceExp.trim()

    if (!/^[A-Za-z]{2,4}-\d{2,4}$/.test(normalizedCode)) {
      setBusFormError('Bus code must follow a format like ND-1151.')
      return
    }

    if (!/^\d+$/.test(normalizedSeats) || Number(normalizedSeats) <= 0) {
      setBusFormError('Seats must be a positive whole number.')
      return
    }

    if (!normalizedBrand || !normalizedCondition || !normalizedType || !normalizedInsuranceExp) {
      setBusFormError('Brand, condition, type, and insurance expiry are required.')
      return
    }

    setBusFormError('')
    setBusInfo(busDraft)
    setIsEditBusModalOpen(false)
  }

  const handleToggleMaintenance = () => {
    // Dummy state toggle to simulate status transitions in the UI.
    setBusInfo((current) => ({
      ...current,
      status: current.status === 'Active' ? 'Maintenance' : 'Active',
    }))
  }

  const handleDeleteBus = () => {
    setIsDeleteModalOpen(false)
    setIsBusDeleted(true)
  }

  const scheduleItems = [
    {
      time: 'Today, 09:00 PM',
      route: 'Colombo - Kandy',
      driver: assignedDriver.name,
      bookedText: '38/45 Booked',
      highlighted: true,
    },
    {
      time: 'Tomorrow, 08:00 PM',
      route: 'Kandy - Colombo',
      driver: assignedDriver.name,
      bookedText: '29/45 Booked',
      highlighted: false,
    },
    {
      time: 'Friday, 07:30 AM',
      route: 'Colombo - Galle',
      driver: assignedDriver.name,
      bookedText: '33/45 Booked',
      highlighted: false,
    },
    {
      time: 'Saturday, 10:15 PM',
      route: 'Galle - Colombo',
      driver: assignedDriver.name,
      bookedText: '17/45 Booked',
      highlighted: false,
    },
  ]

  // Overview and Schedule tabs share this same source, but with different limits.
  const visibleScheduleItems = isFullScheduleVisible ? scheduleItems : scheduleItems.slice(0, 2)

  return (
    <div className="h-screen bg-[#efeff4]" style={{ fontFamily: 'Manrope, Segoe UI, sans-serif' }}>
      <Sidebar mainMenu={mainMenu} systemMenu={systemMenu} />

      <div className="ml-[314px] flex h-screen flex-col">
        <Navbar
          breadcrumbs={['Home', 'Buses', 'Bus Detail']}
          onLogout={handleLogout}
          showSearch={false}
          unreadCount={1}
        />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-[1400px] space-y-5">
            <button
              type="button"
              className="flex items-center gap-2 text-lg text-[#202535] transition duration-200 hover:-translate-x-0.5"
              aria-label="Go back"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span className="font-semibold">Back</span>
            </button>

            <section className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm" style={{ animationDelay: '80ms' }}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src="https://images.unsplash.com/photo-1570125909517-53cb21c89ff2?auto=format&fit=crop&w=280&q=80"
                    alt="Red luxury coach bus parked outdoors"
                    className="h-28 w-44 rounded-lg object-cover"
                  />
                  <div>
                    <span
                      className={[
                        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold',
                        busInfo.status === 'Active' ? 'bg-[#e7f8eb] text-[#0f9b45]' : 'bg-[#fff3d8] text-[#99680b]',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'h-2.5 w-2.5 rounded-full',
                          busInfo.status === 'Active' ? 'animate-status-dot bg-[#0fb24a]' : 'bg-[#efaf00]',
                        ].join(' ')}
                        aria-hidden="true"
                      />
                      {busInfo.status}
                    </span>
                    <h1 className="mt-1 text-5xl font-extrabold tracking-tight text-[#1f2737]">{busInfo.code}</h1>
                    <p className="mt-1 text-2xl text-[#5d677e]">
                      <FontAwesomeIcon icon={faUsers} className="mr-2 text-base" />
                      {busInfo.seats} Seats
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={openEditBusModal}
                    disabled={isBusDeleted}
                    className="rounded-lg border border-[#d5d9e3] bg-white px-6 py-2.5 text-base font-bold text-[#2f394d] transition duration-200 hover:-translate-y-0.5"
                  >
                    <FontAwesomeIcon icon={faPen} className="mr-2" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleMaintenance}
                    disabled={isBusDeleted}
                    className="rounded-lg border border-[#e2cf8f] bg-[#fff7db] px-6 py-2.5 text-base font-bold text-[#99680b] transition duration-200 hover:-translate-y-0.5"
                  >
                    <FontAwesomeIcon icon={faScrewdriverWrench} className="mr-2" />
                    {busInfo.status === 'Maintenance' ? 'Mark Active' : 'Maintenance'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="rounded-lg bg-[#f25555] px-5 py-2.5 text-base font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#e64747]"
                    aria-label="Delete bus"
                    disabled={isBusDeleted}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            </section>

            {isBusDeleted ? (
              <section className="dashboard-card rounded-2xl border border-[#f0caca] bg-[#fff5f5] p-6 shadow-sm">
                <h2 className="text-3xl font-bold text-[#8d1f1f]">Bus deleted</h2>
                <p className="mt-2 text-sm text-[#9a5555]">This is a dummy delete action for the UI flow.</p>
                <button
                  type="button"
                  onClick={() => setIsBusDeleted(false)}
                  className="mt-4 rounded-lg border border-[#d7dde9] bg-white px-4 py-2 text-sm font-semibold text-[#2f394d] transition duration-200 hover:bg-[#f2f5fd]"
                >
                  Restore Bus
                </button>
              </section>
            ) : (
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1.2fr_1.2fr_1fr]">
              <article className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm" style={{ animationDelay: '130ms' }}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-[#1f2737]">Vehicle Specs</h2>
                  <FontAwesomeIcon icon={faEllipsis} className="text-[#6f7788]" />
                </div>
                <div className="space-y-3 text-[15px]">
                  {[
                    ['Brand', busInfo.brand],
                    ['Condition', busInfo.condition],
                    ['Type', busInfo.type],
                    ['Insurance Exp', busInfo.insuranceExp],
                  ].map(([key, value]) => (
                    <div key={key} className="flex justify-between border-b border-[#eceef4] pb-2 last:border-0 last:pb-0">
                      <span className="text-[#7b8394]">{key}</span>
                      <span className={value === 'Nov 2026' ? 'font-semibold text-[#ef6700]' : 'font-semibold text-[#2c3448]'}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm" style={{ animationDelay: '170ms' }}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-[#1f2737]">Assigned Driver</h2>
                  <button
                    type="button"
                    onClick={openDriverModal}
                    className="text-sm font-semibold text-[#2642a6] transition duration-200 hover:text-[#1b3184]"
                  >
                    Change
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <img
                    src={adminProfileImage}
                    alt="Assigned bus driver portrait"
                    className="h-16 w-16 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-[28px] font-bold text-[#1f2737]">{assignedDriver.name}</p>
                    <p className="text-sm text-[#8a93a4]">ID: {assignedDriver.id}</p>
                    <p className="text-sm font-semibold text-[#efaf00]"><FontAwesomeIcon icon={faStar} className="mr-1" />{assignedDriver.rating} <span className="text-[#8a93a4]">({assignedDriver.trips} trips)</span></p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" className="rounded-lg border border-[#d8dce6] px-3 py-2 text-sm font-semibold text-[#2f394d] transition duration-200 hover:bg-[#f0f3fa]">
                    <FontAwesomeIcon icon={faPhone} className="mr-2" />
                    {assignedDriver.phone}
                  </button>
                  <button type="button" className="rounded-lg border border-[#d8dce6] px-3 py-2 text-sm font-semibold text-[#2f394d] transition duration-200 hover:bg-[#f0f3fa]">
                    <FontAwesomeIcon icon={faComment} className="mr-2" />
                    Message
                  </button>
                </div>
              </article>

              <article className="dashboard-card animate-dash-in overflow-hidden rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] shadow-sm" style={{ animationDelay: '210ms' }}>
                <img
                  src={mapImage}
                  alt="Map showing the current bus location"
                  className="h-40 w-full object-cover"
                />
                <div className="flex items-end justify-between p-4">
                  <div>
                    <p className="text-sm font-semibold text-[#8a93a4]">Current Location</p>
                    <p className="text-[26px] font-bold text-[#232c3f]">NH44, Near Electronic City</p>
                    <p className="text-sm text-[#8a93a4]">Last updated: 2 min ago</p>
                  </div>
                  <FontAwesomeIcon icon={faLocationDot} className="pb-2 text-xl text-[#263247]" />
                </div>
              </article>

              <article className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm" style={{ animationDelay: '250ms' }}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-[#1f2737]">Amenities</h2>
                  <button
                    type="button"
                    onClick={openAmenityModal}
                    className="text-sm font-semibold text-[#2642a6] transition duration-200 hover:text-[#1b3184]"
                  >
                    Edit
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {amenities.map((amenity) => (
                    <div
                      key={amenity.name}
                      className={[
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition duration-200 hover:-translate-y-0.5',
                        amenity.enabled
                          ? 'border-[#e5e8f0] bg-[#f2f4f8] text-[#3a4255]'
                          : 'border-[#eceff5] bg-[#f7f8fb] text-[#9fa7b7]',
                      ].join(' ')}
                    >
                      <FontAwesomeIcon icon={amenity.icon} className="text-xs" />
                      {amenity.name}
                    </div>
                  ))}
                </div>
              </article>
              </section>
            )}

            {!isBusDeleted ? (
              <section className="dashboard-card animate-dash-in overflow-hidden rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] shadow-sm" style={{ animationDelay: '300ms' }}>
              <div className="flex gap-6 border-b border-[#dee1e8] px-5 pt-3">
                {[
                  { label: 'Overview', value: 'overview' as DashboardTab },
                  { label: 'Schedule', value: 'schedule' as DashboardTab },
                  { label: 'Revenue', value: 'revenue' as DashboardTab },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setActiveTab(tab.value)}
                    className={[
                      'border-b-2 pb-3 text-lg font-semibold transition duration-200',
                      activeTab === tab.value ? 'border-[#2642a6] text-[#2642a6]' : 'border-transparent text-[#6f7788] hover:text-[#50586a]',
                    ].join(' ')}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' ? (
                <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[2fr_1fr]">
                  <article className="dashboard-card rounded-xl border border-[#e6e8ef] bg-[#f7f8fc] p-5">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="text-3xl font-bold text-[#1f2737]">Revenue Trends</h3>
                        <p className="text-sm text-[#8a93a4]">Last 30 days performance</p>
                      </div>
                      <button type="button" className="rounded-md border border-[#d6dae4] bg-white px-3 py-1 text-sm text-[#3d4558] transition duration-200 hover:bg-[#f2f5fd]">Last 30 Days</button>
                    </div>

                    <svg viewBox="0 0 760 290" className="h-[300px] w-full rounded-lg bg-[#f9fafd]" role="img" aria-label="Revenue trend line chart">
                      <line x1="55" y1="24" x2="55" y2="245" stroke="#d8dcea" />
                      <line x1="55" y1="245" x2="730" y2="245" stroke="#d8dcea" />

                      <polyline
                        className="chart-line-1"
                        fill="none"
                        stroke="#4f7df7"
                        strokeWidth="2"
                        points="75,190 145,165 215,178 285,112 355,130 425,70 495,60 565,48 635,20 705,10"
                      />
                      <polyline
                        className="chart-line-2"
                        fill="none"
                        stroke="#2f4f9d"
                        strokeWidth="2"
                        points="75,135 145,138 215,142 285,145 355,137 425,122 495,108 565,106 635,104 705,98"
                      />
                      <polyline
                        className="chart-line-3"
                        fill="none"
                        stroke="#20a49a"
                        strokeWidth="2"
                        points="75,210 145,202 215,206 285,195 355,181 425,187 495,175 565,164 635,168 705,155"
                      />

                      <g fill="#7b8394" fontSize="12">
                        <text x="10" y="28">Rs.140k</text>
                        <text x="10" y="78">Rs.120k</text>
                        <text x="10" y="128">Rs.100k</text>
                        <text x="10" y="178">Rs.80k</text>
                        <text x="10" y="228">Rs.60k</text>
                      </g>

                      <g fill="#7b8394" fontSize="12">
                        <text x="70" y="268">Oct 01</text>
                        <text x="145" y="268">Oct 06</text>
                        <text x="215" y="268">Oct 11</text>
                        <text x="285" y="268">Oct 16</text>
                        <text x="355" y="268">Oct 21</text>
                        <text x="425" y="268">Oct 26</text>
                        <text x="495" y="268">Oct 30</text>
                      </g>
                    </svg>

                    <div className="mt-2 grid grid-cols-2 gap-4 border-t border-[#eceff5] pt-3 text-center">
                      <div>
                        <p className="text-sm text-[#8a93a4]">Total Revenue</p>
                        <p className="text-4xl font-extrabold text-[#1f2737]">Rs.122,450</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#8a93a4]">Avg. Per Trip</p>
                        <p className="text-4xl font-extrabold text-[#1f2737]">Rs.8850</p>
                      </div>
                    </div>
                  </article>

                  <article className="dashboard-card rounded-xl border border-[#e6e8ef] bg-[#f7f8fc] p-5">
                    <h3 className="text-3xl font-bold text-[#1f2737]">Upcoming Schedule</h3>
                    <div className="mt-4 space-y-4">
                      {visibleScheduleItems.map((item) => (
                        <div key={`${item.time}-${item.route}`} className={item.highlighted ? 'border-l-2 border-[#2642a6] pl-4' : 'border-l-2 border-[#d0d5e0] pl-4'}>
                          <p className={item.highlighted ? 'text-sm font-bold text-[#2642a6]' : 'text-sm font-bold text-[#6e7587]'}>{item.time}</p>
                          <p className="text-[28px] font-extrabold text-[#1f2737]">{item.route}</p>
                          <p className="text-sm text-[#8a93a4]">Driver: {item.driver}</p>
                          <p className="mt-1 inline-block rounded bg-[#edf2ff] px-2 py-0.5 text-sm font-semibold text-[#2642a6]">
                            {item.bookedText}
                          </p>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('schedule')
                        setIsFullScheduleVisible(true)
                      }}
                      className="mt-4 w-full rounded-lg border border-[#d9dde7] bg-[#f5f7fb] py-2 text-lg font-semibold text-[#495162] transition duration-200 hover:bg-[#eef2fa]"
                    >
                      View Full Schedule
                    </button>
                  </article>
                </div>
              ) : null}

              {activeTab === 'schedule' ? (
                <div className="p-4">
                  <article className="dashboard-card rounded-xl border border-[#e6e8ef] bg-[#f7f8fc] p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-3xl font-bold text-[#1f2737]">Bus Schedule</h3>
                      <button
                        type="button"
                        onClick={() => setIsFullScheduleVisible((value) => !value)}
                        className="rounded-md border border-[#d6dae4] bg-white px-3 py-1 text-sm font-semibold text-[#3d4558] transition duration-200 hover:bg-[#f2f5fd]"
                      >
                        {isFullScheduleVisible ? 'Show Less' : 'View Full Schedule'}
                      </button>
                    </div>
                    <div className="space-y-4">
                      {visibleScheduleItems.map((item) => (
                        <div key={`${item.time}-${item.route}`} className={item.highlighted ? 'rounded-lg border-l-4 border-[#2642a6] bg-[#f3f6ff] px-4 py-3' : 'rounded-lg border-l-4 border-[#d0d5e0] bg-[#f8f9fd] px-4 py-3'}>
                          <p className={item.highlighted ? 'text-sm font-bold text-[#2642a6]' : 'text-sm font-bold text-[#6e7587]'}>{item.time}</p>
                          <p className="text-[28px] font-extrabold text-[#1f2737]">{item.route}</p>
                          <p className="text-sm text-[#8a93a4]">Driver: {item.driver}</p>
                          <p className="mt-1 inline-block rounded bg-[#edf2ff] px-2 py-0.5 text-sm font-semibold text-[#2642a6]">
                            {item.bookedText}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              ) : null}

              {activeTab === 'revenue' ? (
                <div className="p-4">
                  <article className="dashboard-card rounded-xl border border-[#e6e8ef] bg-[#f7f8fc] p-5">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="text-3xl font-bold text-[#1f2737]">Revenue Trends</h3>
                        <p className="text-sm text-[#8a93a4]">Last 30 days performance</p>
                      </div>
                      <button type="button" className="rounded-md border border-[#d6dae4] bg-white px-3 py-1 text-sm text-[#3d4558] transition duration-200 hover:bg-[#f2f5fd]">Last 30 Days</button>
                    </div>

                    <svg viewBox="0 0 760 290" className="h-[300px] w-full rounded-lg bg-[#f9fafd]" role="img" aria-label="Revenue trend line chart">
                      <line x1="55" y1="24" x2="55" y2="245" stroke="#d8dcea" />
                      <line x1="55" y1="245" x2="730" y2="245" stroke="#d8dcea" />

                      <polyline
                        className="chart-line-1"
                        fill="none"
                        stroke="#4f7df7"
                        strokeWidth="2"
                        points="75,190 145,165 215,178 285,112 355,130 425,70 495,60 565,48 635,20 705,10"
                      />
                      <polyline
                        className="chart-line-2"
                        fill="none"
                        stroke="#2f4f9d"
                        strokeWidth="2"
                        points="75,135 145,138 215,142 285,145 355,137 425,122 495,108 565,106 635,104 705,98"
                      />
                      <polyline
                        className="chart-line-3"
                        fill="none"
                        stroke="#20a49a"
                        strokeWidth="2"
                        points="75,210 145,202 215,206 285,195 355,181 425,187 495,175 565,164 635,168 705,155"
                      />

                      <g fill="#7b8394" fontSize="12">
                        <text x="10" y="28">Rs.140k</text>
                        <text x="10" y="78">Rs.120k</text>
                        <text x="10" y="128">Rs.100k</text>
                        <text x="10" y="178">Rs.80k</text>
                        <text x="10" y="228">Rs.60k</text>
                      </g>

                      <g fill="#7b8394" fontSize="12">
                        <text x="70" y="268">Oct 01</text>
                        <text x="145" y="268">Oct 06</text>
                        <text x="215" y="268">Oct 11</text>
                        <text x="285" y="268">Oct 16</text>
                        <text x="355" y="268">Oct 21</text>
                        <text x="425" y="268">Oct 26</text>
                        <text x="495" y="268">Oct 30</text>
                      </g>
                    </svg>

                    <div className="mt-2 grid grid-cols-2 gap-4 border-t border-[#eceff5] pt-3 text-center">
                      <div>
                        <p className="text-sm text-[#8a93a4]">Total Revenue</p>
                        <p className="text-4xl font-extrabold text-[#1f2737]">Rs.122,450</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#8a93a4]">Avg. Per Trip</p>
                        <p className="text-4xl font-extrabold text-[#1f2737]">Rs.8850</p>
                      </div>
                    </div>
                  </article>
                </div>
              ) : null}
              </section>
            ) : null}
          </div>
        </main>
      </div>

      {isAmenityModalOpen ? (
        // Amenity editor modal works on draft values until Save Changes is clicked.
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#101426]/45 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#d8deea] bg-[#f7f8fc] shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="flex items-center justify-between border-b border-[#e1e5ef] px-6 py-4">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1f2737]">Edit Amenities</h2>
                <p className="text-sm text-[#6d778e]">Enable or disable amenities for this bus.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAmenityModalOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-md text-[#6d778e] transition duration-200 hover:bg-[#eceff7] hover:text-[#1f2737]"
                aria-label="Close amenities editor"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="space-y-3 px-6 py-5">
              {amenityDraft.map((amenity) => (
                <label
                  key={amenity.name}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-[#e3e7f0] bg-[#f9fafd] px-4 py-3"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-[#2f394d]">
                    <FontAwesomeIcon icon={amenity.icon} className="text-xs" />
                    {amenity.name}
                  </span>
                  <input
                    type="checkbox"
                    checked={amenity.enabled}
                    onChange={() => handleAmenityToggle(amenity.name)}
                    className="h-4 w-4 rounded border-[#d1d8e5] text-[#2642a6] focus:ring-[#2642a6]"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#e1e5ef] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsAmenityModalOpen(false)}
                className="rounded-lg border border-[#d3d9e6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#e9edf7]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAmenities}
                className="rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-bold text-white transition duration-200 hover:bg-[#203b96]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDriverModalOpen ? (
        // Driver editor modal keeps form edits isolated from main UI state.
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#101426]/45 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#d8deea] bg-[#f7f8fc] shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="flex items-center justify-between border-b border-[#e1e5ef] px-6 py-4">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1f2737]">Change Driver</h2>
                <p className="text-sm text-[#6d778e]">Update assigned driver details.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDriverModalOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-md text-[#6d778e] transition duration-200 hover:bg-[#eceff7] hover:text-[#1f2737]"
                aria-label="Close driver editor"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
              <div>
                <label htmlFor="driver-name" className="mb-1 block text-sm font-semibold text-[#45516b]">Driver Name</label>
                <input
                  id="driver-name"
                  value={driverDraft.name}
                  onChange={(event) => handleDriverNameChange(event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                />
              </div>
              <div>
                <label htmlFor="driver-id" className="mb-1 block text-sm font-semibold text-[#45516b]">Driver ID</label>
                <input
                  id="driver-id"
                  value={driverDraft.id}
                  readOnly
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#eef1f7] px-3 text-sm text-[#6a7284] outline-none"
                />
              </div>
              <div>
                <label htmlFor="driver-phone" className="mb-1 block text-sm font-semibold text-[#45516b]">Phone</label>
                <input
                  id="driver-phone"
                  value={driverDraft.phone}
                  onChange={(event) => setDriverDraft((prev) => ({ ...prev, phone: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                />
              </div>
              <div>
                <p className="mb-1 block text-sm font-semibold text-[#45516b]">Rating</p>
                <div
                  className="flex h-11 w-full items-center rounded-lg border border-[#d7dde9] bg-[#eef1f7] px-3 text-sm text-[#6a7284]"
                >
                  {driverDraft.rating} (auto-calculated)
                </div>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="driver-trips" className="mb-1 block text-sm font-semibold text-[#45516b]">Trips</label>
                <input
                  id="driver-trips"
                  value={driverDraft.trips}
                  onChange={(event) => setDriverDraft((prev) => ({ ...prev, trips: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#e1e5ef] px-6 py-4">
              {driverFormError ? (
                <p className="mr-auto text-sm font-semibold text-[#d14343]">{driverFormError}</p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setDriverFormError('')
                  setIsDriverModalOpen(false)
                }}
                className="rounded-lg border border-[#d3d9e6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#e9edf7]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDriver}
                className="rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-bold text-white transition duration-200 hover:bg-[#203b96]"
              >
                Save Driver
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditBusModalOpen ? (
        // Bus profile editor modal follows the same draft -> save pattern.
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#101426]/45 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#d8deea] bg-[#f7f8fc] shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="flex items-center justify-between border-b border-[#e1e5ef] px-6 py-4">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1f2737]">Edit Bus</h2>
                <p className="text-sm text-[#6d778e]">Update basic bus details.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBusFormError('')
                  setIsEditBusModalOpen(false)
                }}
                className="grid h-9 w-9 place-items-center rounded-md text-[#6d778e] transition duration-200 hover:bg-[#eceff7] hover:text-[#1f2737]"
                aria-label="Close bus editor"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
              <div>
                <label htmlFor="bus-code" className="mb-1 block text-sm font-semibold text-[#45516b]">Bus Code</label>
                <input id="bus-code" value={busDraft.code} onChange={(event) => setBusDraft((prev) => ({ ...prev, code: event.target.value }))} className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              <div>
                <label htmlFor="bus-seats" className="mb-1 block text-sm font-semibold text-[#45516b]">Seats</label>
                <input id="bus-seats" value={busDraft.seats} onChange={(event) => setBusDraft((prev) => ({ ...prev, seats: event.target.value }))} className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              <div>
                <label htmlFor="bus-brand" className="mb-1 block text-sm font-semibold text-[#45516b]">Brand</label>
                <input id="bus-brand" value={busDraft.brand} onChange={(event) => setBusDraft((prev) => ({ ...prev, brand: event.target.value }))} className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              <div>
                <label htmlFor="bus-condition" className="mb-1 block text-sm font-semibold text-[#45516b]">Condition</label>
                <input id="bus-condition" value={busDraft.condition} onChange={(event) => setBusDraft((prev) => ({ ...prev, condition: event.target.value }))} className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              <div>
                <label htmlFor="bus-type" className="mb-1 block text-sm font-semibold text-[#45516b]">Type</label>
                <input id="bus-type" value={busDraft.type} onChange={(event) => setBusDraft((prev) => ({ ...prev, type: event.target.value }))} className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              <div>
                <label htmlFor="bus-insurance" className="mb-1 block text-sm font-semibold text-[#45516b]">Insurance Exp</label>
                <input id="bus-insurance" value={busDraft.insuranceExp} onChange={(event) => setBusDraft((prev) => ({ ...prev, insuranceExp: event.target.value }))} className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#e1e5ef] px-6 py-4">
              {busFormError ? (
                <p className="mr-auto text-sm font-semibold text-[#d14343]">{busFormError}</p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setBusFormError('')
                  setIsEditBusModalOpen(false)
                }}
                className="rounded-lg border border-[#d3d9e6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#e9edf7]"
              >
                Cancel
              </button>
              <button type="button" onClick={handleSaveBus} className="rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-bold text-white transition duration-200 hover:bg-[#203b96]">
                Save Bus
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteModalOpen ? (
        // Delete confirmation is intentionally non-destructive for this demo flow.
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#101426]/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#f0d6d6] bg-[#fff7f7] shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="border-b border-[#efdcdc] px-6 py-4">
              <h2 className="text-2xl font-extrabold text-[#8d1f1f]">Delete Bus</h2>
              <p className="text-sm text-[#9a5555]">Are you sure you want to delete {busInfo.code}?</p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4">
              <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="rounded-lg border border-[#d3d9e6] bg-white px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#f5f7fc]">
                Cancel
              </button>
              <button type="button" onClick={handleDeleteBus} className="rounded-lg bg-[#e04444] px-5 py-2 text-sm font-bold text-white transition duration-200 hover:bg-[#d43939]">
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default BusDetail
