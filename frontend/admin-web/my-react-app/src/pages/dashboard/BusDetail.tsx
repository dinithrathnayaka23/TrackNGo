import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  faArrowLeft,
  faBus,
  faChargingStation,
  faCircleUser,
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
  faTv,
  faUsers,
  faVideo,
  faWifi,
  faXmark,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import adminProfileImage from "../../assets/images/adminProfile.png";
import mapImage from "../../assets/images/map.png";
import {
  fetchBusDetail,
  updateBus,
  deleteBus as deleteBusApi,
  fetchSeatLayout,
  saveSeatLayout as saveSeatLayoutApi,
  fetchDriverOptions,
  fetchRouteOptions,
  type BusDetail as BusDetailDto,
  type SeatLayoutRow as ApiSeatLayoutRow,
  type DriverOption,
  type RouteOption,
} from "../../services/busService";

type Amenity = {
  key: string;   // DB value: "ac", "wifi", "charging_ports", etc.
  name: string;  // Display label
  icon: IconDefinition;
  enabled: boolean;
};

type Driver = {
  name: string;
  id: string;
  phone: string;
  rating: string;
  trips: number;
};

type BusInfo = {
  code: string;
  seats: string;
  brand: string;
  condition: string;
  type: string;
  insuranceExp: string;
  status: "active" | "maintenance" | "inactive";
  startTime: string;
  endTime: string;
  registrationNumber: string;
  routeId: number | null;
  routeName: string;
};

type DashboardTab = "overview" | "schedule" | "revenue";
type BusRevenuePoint = {
  date: string;
  revenue: number;
};

type SeatLayoutRow = {
  left: string[];
  right?: string[];
  lastRow?: string[];
};

type SeatPreviewRow =
  | { kind: "bench"; seats: number[] }
  | { kind: "row"; left: number[]; right: number[] };

type LayoutConfig = {
  rows: number;
  leftSeatsPerRow: number;
  rightSeatsPerRow: number;
  rearRowSeats: number;
  driverLeftSeats: number;
};

const seatLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const defaultLayoutConfig: LayoutConfig = {
  rows: 10,
  leftSeatsPerRow: 2,
  rightSeatsPerRow: 2,
  rearRowSeats: 5,
  driverLeftSeats: 0,
};

const getLayoutSeatCount = (config: LayoutConfig): number =>
  config.rows * (config.leftSeatsPerRow + config.rightSeatsPerRow) +
  config.rearRowSeats +
  config.driverLeftSeats;

const buildSeatLayoutRows = (config: LayoutConfig): SeatLayoutRow[] => {
  const rows: SeatLayoutRow[] = Array.from(
    { length: config.rows },
    (_, index) => {
      const rowNumber = index + 1;
      const leftLetters = seatLetters.slice(0, config.leftSeatsPerRow);
      const rightLetters = seatLetters.slice(
        config.leftSeatsPerRow,
        config.leftSeatsPerRow + config.rightSeatsPerRow,
      );

      return {
        left: leftLetters.map((letter) => `${rowNumber}${letter}`),
        right: rightLetters.map((letter) => `${rowNumber}${letter}`),
      };
    },
  );

  if (config.rearRowSeats > 0) {
    const rearRowNumber = config.rows + 1;
    rows.push({
      left: [],
      right: [],
      lastRow: seatLetters
        .slice(0, config.rearRowSeats)
        .map((letter) => `${rearRowNumber}${letter}`),
    });
  }

  return rows;
};

const initialAmenities: Amenity[] = [
  { key: "wifi", name: "Wi-Fi", icon: faWifi, enabled: false },
  { key: "ac", name: "A/C", icon: faSnowflake, enabled: false },
  { key: "charging_ports", name: "Charging", icon: faChargingStation, enabled: false },
  { key: "entertainment", name: "Ent.sys", icon: faTv, enabled: false },
  { key: "gps", name: "GPS", icon: faLocationDot, enabled: false },
  { key: "cctv", name: "CCTV", icon: faVideo, enabled: false },
];

type DriverTripRecord = {
  tripId: string;
  driverId: string;
};

const driverTripRecords: DriverTripRecord[] = [
  ...Array.from({ length: 128 }, (_, index) => ({
    tripId: `TRP-892-${String(index + 1).padStart(3, "0")}`,
    driverId: "DRV-892",
  })),
  ...Array.from({ length: 97 }, (_, index) => ({
    tripId: `TRP-415-${String(index + 1).padStart(3, "0")}`,
    driverId: "DRV-415",
  })),
  ...Array.from({ length: 74 }, (_, index) => ({
    tripId: `TRP-233-${String(index + 1).padStart(3, "0")}`,
    driverId: "DRV-233",
  })),
  ...Array.from({ length: 112 }, (_, index) => ({
    tripId: `TRP-761-${String(index + 1).padStart(3, "0")}`,
    driverId: "DRV-761",
  })),
  ...Array.from({ length: 95 }, (_, index) => ({
    tripId: `TRP-501-${String(index + 1).padStart(3, "0")}`,
    driverId: "DRV-501",
  })),
  ...Array.from({ length: 83 }, (_, index) => ({
    tripId: `TRP-602-${String(index + 1).padStart(3, "0")}`,
    driverId: "DRV-602",
  })),
  ...Array.from({ length: 105 }, (_, index) => ({
    tripId: `TRP-710-${String(index + 1).padStart(3, "0")}`,
    driverId: "DRV-710",
  })),
];

const getTripCountForDriver = (driverId: string): number =>
  driverTripRecords.filter((record) => record.driverId === driverId).length;

const initialDriver: Driver = {
  name: "Dinesh Gamage",
  id: "DRV-892",
  phone: "0711526987",
  rating: "4.9",
  trips: getTripCountForDriver("DRV-892"),
};

const driverDirectory: Record<string, string> = {
  "dinesh gamage": "DRV-892",
  "kasun perera": "DRV-415",
  "nimal silva": "DRV-233",
  "amila fernando": "DRV-761",
  "lahiru mudalige": "DRV-501",
  "ashen senarathna": "DRV-602",
  "david ross": "DRV-710",
};

const initialBusInfo: BusInfo = {
  code: "ND-1151",
  seats: "45",
  brand: "King Long",
  condition: "Super-Luxury",
  type: "Highway",
  insuranceExp: "Nov 2026",
  status: "Active",
};

const generateBusRevenue = (seed: number): BusRevenuePoint[] => {
  const start = new Date("2026-01-26");
  const weekdayFactor = [0.9, 0.95, 1, 1.05, 1.12, 1.28, 1.18];

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    const dayFactor = weekdayFactor[date.getDay()];
    const trend = 7800 + seed * 200 + index * 85;
    const seasonal = (((index * 37 + seed * 13) % 540) - 220);
    const revenue = Math.round((trend + seasonal) * dayFactor);

    return {
      date: date.toISOString().slice(0, 10),
      revenue,
    };
  });
};
const revenueChartLabelIndexes = [0, 5, 10, 15, 20, 25, 29];

type BusDetailEntry = {
  busInfo: BusInfo;
  driver: Driver;
  image: string;
  revenueSeed: number;
};

const BUS_DETAIL_MAP: Record<string, BusDetailEntry> = {
  "nd-1151": {
    busInfo: { code: "ND-1151", seats: "42", brand: "Ashok Leyland", condition: "Semi-Luxury", type: "Highway", insuranceExp: "Nov 2026", status: "Active" },
    driver: { name: "Lahiru Mudalige", id: "DRV-501", phone: "0712345678", rating: "4.7", trips: getTripCountForDriver("DRV-501") },
    image: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=480&q=80&fit=crop",
    revenueSeed: 0,
  },
  "nc-2344": {
    busInfo: { code: "NC-2344", seats: "54", brand: "Ashok Leyland", condition: "Normal", type: "City", insuranceExp: "Mar 2027", status: "Active" },
    driver: { name: "Lahiru Mudalige", id: "DRV-501", phone: "0712345678", rating: "4.7", trips: getTripCountForDriver("DRV-501") },
    image: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=480&q=80&fit=crop",
    revenueSeed: 1,
  },
  "nj-1539": {
    busInfo: { code: "NJ-1539", seats: "36", brand: "Volvo 9600", condition: "Super-Luxury", type: "Highway", insuranceExp: "Jul 2026", status: "Active" },
    driver: { name: "Ashen Senarathna", id: "DRV-602", phone: "0719876543", rating: "4.8", trips: getTripCountForDriver("DRV-602") },
    image: "https://images.unsplash.com/photo-1557223562-6c77ef16210f?w=480&q=80&fit=crop",
    revenueSeed: 2,
  },
  "nc-1212": {
    busInfo: { code: "NC-1212", seats: "40", brand: "Volvo 9600", condition: "Luxury", type: "Highway", insuranceExp: "Sep 2026", status: "Active" },
    driver: { name: "David Ross", id: "DRV-710", phone: "0714567890", rating: "4.6", trips: getTripCountForDriver("DRV-710") },
    image: "https://images.unsplash.com/photo-1494515843206-f3117d3f51b7?w=480&q=80&fit=crop",
    revenueSeed: 3,
  },
  "nb-3301": {
    busInfo: { code: "NB-3301", seats: "50", brand: "Tata Marcopolo", condition: "Semi-Luxury", type: "Expressway", insuranceExp: "Jan 2027", status: "Maintenance" },
    driver: { name: "Kasun Perera", id: "DRV-415", phone: "0776543210", rating: "4.5", trips: getTripCountForDriver("DRV-415") },
    image: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=480&q=80&fit=crop",
    revenueSeed: 4,
  },
  "nd-4420": {
    busInfo: { code: "ND-4420", seats: "45", brand: "King Long", condition: "Normal", type: "City", insuranceExp: "May 2026", status: "Maintenance" },
    driver: { name: "Nimal Silva", id: "DRV-233", phone: "0723456789", rating: "4.3", trips: getTripCountForDriver("DRV-233") },
    image: "https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?w=480&q=80&fit=crop",
    revenueSeed: 5,
  },
  "nc-5501": {
    busInfo: { code: "NC-5501", seats: "38", brand: "Ashok Leyland", condition: "Luxury", type: "Expressway", insuranceExp: "Aug 2026", status: "Active" },
    driver: { name: "Amila Fernando", id: "DRV-761", phone: "0718765432", rating: "4.8", trips: getTripCountForDriver("DRV-761") },
    image: "https://images.unsplash.com/photo-1622631601750-b9ef0ecc69f7?w=480&q=80&fit=crop",
    revenueSeed: 6,
  },
  "nj-6610": {
    busInfo: { code: "NJ-6610", seats: "44", brand: "Volvo 9600", condition: "Super-Luxury", type: "Highway", insuranceExp: "Dec 2026", status: "Active" },
    driver: { name: "Dinesh Gamage", id: "DRV-892", phone: "0711526987", rating: "4.9", trips: getTripCountForDriver("DRV-892") },
    image: "https://images.unsplash.com/photo-1587036325238-17e478fa5248?w=480&q=80&fit=crop",
    revenueSeed: 7,
  },
};

function BusDetail() {
  const { busId } = useParams<{ busId: string }>();
  const navigate = useNavigate();

  // API loading state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [busData, setBusData] = useState<BusDetailDto | null>(null);
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([]);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);

  // Persisted view state displayed on the page.
  const [amenities, setAmenities] = useState<Amenity[]>(initialAmenities);
  // Draft state lets users edit in modals without mutating live data until Save.
  const [isAmenityModalOpen, setIsAmenityModalOpen] = useState(false);
  const [amenityDraft, setAmenityDraft] = useState<Amenity[]>(initialAmenities);
  const [assignedDriver, setAssignedDriver] = useState<Driver>({
    name: "", id: "", phone: "", rating: "0", trips: 0,
  });
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [driverDraft, setDriverDraft] = useState<Driver>({
    name: "", id: "", phone: "", rating: "0", trips: 0,
  });
  const [busInfo, setBusInfo] = useState<BusInfo>({
    code: "", seats: "0", brand: "", condition: "", type: "", insuranceExp: "",
    status: "active", startTime: "", endTime: "", registrationNumber: "", routeId: null, routeName: "",
  });
  const [isEditBusModalOpen, setIsEditBusModalOpen] = useState(false);
  const [isEditLayoutModalOpen, setIsEditLayoutModalOpen] = useState(false);
  const [busDraft, setBusDraft] = useState<BusInfo>({
    code: "", seats: "0", brand: "", condition: "", type: "", insuranceExp: "",
    status: "active", startTime: "", endTime: "", registrationNumber: "", routeId: null, routeName: "",
  });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBusDeleted, setIsBusDeleted] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [isFullScheduleVisible, setIsFullScheduleVisible] = useState(false);
  const [driverFormError, setDriverFormError] = useState("");
  const [busFormError, setBusFormError] = useState("");
  const [layoutConfig, setLayoutConfig] =
    useState<LayoutConfig>(defaultLayoutConfig);
  const [layoutDraftConfig, setLayoutDraftConfig] =
    useState<LayoutConfig>(defaultLayoutConfig);
  const [layoutConfigError, setLayoutConfigError] = useState("");
  const [blockedSeats, setBlockedSeats] = useState<Set<number>>(new Set());

  // ── Load bus data from API ────────────────────────────────
  useEffect(() => {
    if (!busId) return;
    const numericId = Number(busId);
    if (Number.isNaN(numericId)) return;

    setLoading(true);
    setApiError("");

    Promise.all([
      fetchBusDetail(numericId),
      fetchSeatLayout(numericId),
      fetchDriverOptions(),
      fetchRouteOptions(),
    ])
      .then(([detail, seatRows, drivers, routes]) => {
        setBusData(detail);
        setDriverOptions(drivers);
        setRouteOptions(routes);

        // Map to local state
        const info: BusInfo = {
          code: detail.busNumber,
          seats: String(detail.seatCapacity),
          brand: detail.busBrand,
          condition: detail.busCondition ?? "",
          type: detail.busType ?? "",
          insuranceExp: detail.insuranceExpDate ?? "",
          status: (detail.status as BusInfo["status"]) ?? "active",
          startTime: detail.startTime ?? "",
          endTime: detail.endTime ?? "",
          registrationNumber: detail.registrationNumber ?? "",
          routeId: detail.routeId ?? null,
          routeName: detail.routeName ?? "",
        };
        setBusInfo(info);
        setBusDraft(info);

        // Map amenities — match by DB key
        const enabledKeys = (detail.amenities || []).map((a) => a.toLowerCase());
        const mapped = initialAmenities.map((a) => ({
          ...a,
          enabled: enabledKeys.includes(a.key),
        }));
        setAmenities(mapped);
        setAmenityDraft(mapped);

        // Map driver
        if (detail.driverName) {
          const drv: Driver = {
            name: detail.driverName,
            id: detail.driverId ? String(detail.driverId) : "",
            phone: detail.driverPhone ?? "",
            rating: detail.driverRating ? String(detail.driverRating) : "0",
            trips: 0,
          };
          setAssignedDriver(drv);
          setDriverDraft(drv);
        }

        // Map seat layout from API rows into LayoutConfig
        if (seatRows && seatRows.length > 0) {
          const hasBackRow = seatRows.some((r) => r.lastRow && r.lastRow.length > 0);
          const normalRows = seatRows.filter((r) => !r.lastRow || r.lastRow.length === 0);
          const backRow = seatRows.find((r) => r.lastRow && r.lastRow.length > 0);
          const leftPer = normalRows.length > 0 ? normalRows[0].left.length : 2;
          const rightPer = normalRows.length > 0 ? normalRows[0].right.length : 2;
          const cfg: LayoutConfig = {
            rows: normalRows.length,
            leftSeatsPerRow: leftPer,
            rightSeatsPerRow: rightPer,
            rearRowSeats: backRow?.lastRow?.length ?? 0,
            driverLeftSeats: 0,
          };
          setLayoutConfig(cfg);
          setLayoutDraftConfig(cfg);
        }
      })
      .catch((e) => setApiError(e.message))
      .finally(() => setLoading(false));
  }, [busId]);

  const openAmenityModal = () => {
    // Reset draft from latest saved values every time the editor opens.
    setAmenityDraft(amenities);
    setIsAmenityModalOpen(true);
  };

  const handleAmenityToggle = (amenityKey: string) => {
    setAmenityDraft((current) =>
      current.map((amenity) =>
        amenity.key === amenityKey
          ? { ...amenity, enabled: !amenity.enabled }
          : amenity,
      ),
    );
  };

  /** Build a consistent SaveBusRequest from current state with optional overrides. */
  const buildSaveRequest = (overrides: Partial<{
    amenities: string[];
    driverId: number | null;
    routeId: number | null;
    status: string;
    busNumber: string;
    busBrand: string;
    seatCapacity: number;
    busType: string;
    busCondition: string;
    startTime: string | null;
    endTime: string | null;
    registrationNumber: string;
    insuranceExpDate: string;
  }> = {}) => ({
    busNumber: overrides.busNumber ?? busInfo.code,
    busBrand: overrides.busBrand ?? busInfo.brand,
    seatCapacity: overrides.seatCapacity ?? Number(busInfo.seats),
    busType: overrides.busType ?? busInfo.type,
    busCondition: overrides.busCondition ?? busInfo.condition,
    status: overrides.status ?? busInfo.status,
    amenities: overrides.amenities ?? amenities.filter((a) => a.enabled).map((a) => a.key),
    startTime: overrides.startTime !== undefined ? overrides.startTime : (busInfo.startTime || null),
    endTime: overrides.endTime !== undefined ? overrides.endTime : (busInfo.endTime || null),
    registrationNumber: overrides.registrationNumber ?? busInfo.registrationNumber,
    insuranceExpDate: overrides.insuranceExpDate ?? busInfo.insuranceExp,
    driverId: overrides.driverId !== undefined ? overrides.driverId : (busData?.driverId ?? null),
    routeId: overrides.routeId !== undefined ? overrides.routeId : (busInfo.routeId ?? null),
  });

  const handleSaveAmenities = () => {
    const enabledKeys = amenityDraft.filter((a) => a.enabled).map((a) => a.key);
    setSaving(true);
    const numericId = Number(busId);
    updateBus(numericId, buildSaveRequest({ amenities: enabledKeys }))
      .then(() => {
        setAmenities(amenityDraft);
        setIsAmenityModalOpen(false);
      })
      .catch((e) => setApiError(e.message))
      .finally(() => setSaving(false));
  };

  const openDriverModal = () => {
    setDriverDraft(assignedDriver);
    setDriverFormError("");
    setIsDriverModalOpen(true);
  };

  const handleDriverSelect = (driverId: string) => {
    const selected = driverOptions.find((d) => String(d.driverId) === driverId);
    if (selected) {
      setDriverDraft((prev) => ({
        ...prev,
        name: selected.name,
        id: String(selected.driverId),
      }));
    } else {
      setDriverDraft((prev) => ({ ...prev, name: "", id: "" }));
    }
    setDriverFormError("");
  };

  const handleSaveDriver = () => {
    if (!driverDraft.id) {
      setDriverFormError("Please select a driver.");
      return;
    }

    setDriverFormError("");
    setSaving(true);
    const numericId = Number(busId);
    updateBus(numericId, buildSaveRequest({ driverId: Number(driverDraft.id) || null }))
      .then(() => {
        setAssignedDriver({ ...driverDraft });
        if (busData) {
          setBusData({ ...busData, driverId: Number(driverDraft.id), driverName: driverDraft.name, driverPhone: driverDraft.phone });
        }
        setIsDriverModalOpen(false);
      })
      .catch((e) => setDriverFormError(e.message))
      .finally(() => setSaving(false));
  };

  const openEditBusModal = () => {
    // Load current bus fields into modal draft before editing.
    setBusDraft(busInfo);
    setBusFormError("");
    setIsEditBusModalOpen(true);
  };

  const handleSaveBus = () => {
    const normalizedCode = busDraft.code.trim();
    const normalizedSeats = busDraft.seats.trim();
    const normalizedBrand = busDraft.brand.trim();

    if (!/^[A-Za-z]{2,4}-\d{2,4}$/.test(normalizedCode)) {
      setBusFormError("Bus Number must follow a format like ND-1151.");
      return;
    }

    if (!/^\d+$/.test(normalizedSeats) || Number(normalizedSeats) <= 0) {
      setBusFormError("Seats must be a positive whole number.");
      return;
    }

    if (!normalizedBrand || !busDraft.condition || !busDraft.type) {
      setBusFormError("Brand, condition, and type are required.");
      return;
    }

    setBusFormError("");
    setSaving(true);
    const numericId = Number(busId);
    updateBus(numericId, buildSaveRequest({
      busNumber: busDraft.code,
      busBrand: busDraft.brand,
      seatCapacity: Number(busDraft.seats),
      busType: busDraft.type,
      busCondition: busDraft.condition,
      status: busDraft.status,
      startTime: busDraft.startTime || null,
      endTime: busDraft.endTime || null,
      registrationNumber: busDraft.registrationNumber,
      insuranceExpDate: busDraft.insuranceExp,
      routeId: busDraft.routeId,
    }))
      .then(() => {
        setBusInfo(busDraft);
        setIsEditBusModalOpen(false);
      })
      .catch((e) => setBusFormError(e.message))
      .finally(() => setSaving(false));
  };

  const openEditLayoutModal = () => {
    const seatsFromBusDraft = Number.parseInt(busDraft.seats, 10);
    const seatsPerRow =
      layoutConfig.leftSeatsPerRow + layoutConfig.rightSeatsPerRow;
    const normalizedRows = Number.isNaN(seatsFromBusDraft)
      ? layoutConfig.rows
      : Math.floor(seatsFromBusDraft / seatsPerRow);
    const normalizedRearRowSeats = Number.isNaN(seatsFromBusDraft)
      ? layoutConfig.rearRowSeats
      : seatsFromBusDraft - normalizedRows * seatsPerRow;

    setLayoutDraftConfig({
      ...layoutConfig,
      rows: Math.max(0, normalizedRows),
      rearRowSeats: Math.max(0, Math.min(8, normalizedRearRowSeats)),
      driverLeftSeats: layoutConfig.driverLeftSeats,
    });
    setLayoutConfigError("");
    setBusFormError("");
    setIsEditBusModalOpen(false);
    setIsEditLayoutModalOpen(true);
  };

  const appliedLayoutSeatCount = useMemo(
    () => getLayoutSeatCount(layoutConfig),
    [layoutConfig],
  );

  const draftLayoutSeatCount = useMemo(
    () => getLayoutSeatCount(layoutDraftConfig),
    [layoutDraftConfig],
  );
  const blockedSeatCount = blockedSeats.size;

  const previewMaxWidth = useMemo(() => {
    const cols = layoutConfig.leftSeatsPerRow + layoutConfig.rightSeatsPerRow;
    const base = cols * 60 + 120;
    return Math.max(280, Math.min(560, base));
  }, [layoutConfig.leftSeatsPerRow, layoutConfig.rightSeatsPerRow]);

  const layoutRows = useMemo(() => {
    return buildSeatLayoutRows(layoutConfig);
  }, [layoutConfig]);

  const seatPreview = useMemo((): {
    driverSide: number[];
    rows: SeatPreviewRow[];
  } => {
    let seatNumber = 1;
    const driverSide =
      layoutConfig.driverLeftSeats > 0
        ? Array.from(
            { length: layoutConfig.driverLeftSeats },
            () => seatNumber++,
          )
        : [];

    const rows: SeatPreviewRow[] = layoutRows.map((row) => {
      if (row.lastRow) {
        const bench = row.lastRow.map(() => seatNumber++);
        return { kind: "bench", seats: bench };
      }

      const right = (row.right ?? []).map(() => seatNumber++);
      const left = row.left.map(() => seatNumber++);
      return { kind: "row", left, right };
    });

    return { driverSide, rows };
  }, [layoutConfig.driverLeftSeats, layoutRows]);

  const updateLayoutDraft = (field: keyof LayoutConfig, value: number) => {
    setLayoutDraftConfig((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleApplyLayoutConfig = () => {
    const normalizedRows = Math.max(0, Math.min(20, layoutDraftConfig.rows));
    const normalizedLeftSeats = Math.max(
      1,
      Math.min(3, layoutDraftConfig.leftSeatsPerRow),
    );
    const normalizedRightSeats = Math.max(
      1,
      Math.min(3, layoutDraftConfig.rightSeatsPerRow),
    );
    const normalizedRearSeats = Math.max(
      0,
      Math.min(8, layoutDraftConfig.rearRowSeats),
    );
    const normalizedDriverLeft = Math.max(
      0,
      Math.min(3, layoutDraftConfig.driverLeftSeats),
    );

    const nextConfig: LayoutConfig = {
      rows: normalizedRows,
      leftSeatsPerRow: normalizedLeftSeats,
      rightSeatsPerRow: normalizedRightSeats,
      rearRowSeats: normalizedRearSeats,
      driverLeftSeats: normalizedDriverLeft,
    };

    const totalSeats = getLayoutSeatCount(nextConfig);
    if (totalSeats < 10 || totalSeats > 80) {
      setLayoutConfigError("Total seats should be between 10 and 80.");
      return;
    }

    setLayoutConfig(nextConfig);
    setLayoutDraftConfig(nextConfig);
    setLayoutConfigError("");
    setBusDraft((current) => ({ ...current, seats: String(totalSeats) }));
    setBlockedSeats((current) => {
      const next = new Set<number>();
      current.forEach((seatId) => {
        if (seatId <= totalSeats) {
          next.add(seatId);
        }
      });
      return next;
    });
  };

  const handleSeatBlockToggle = (seatId: number) => {
    setBlockedSeats((current) => {
      const next = new Set(current);
      if (next.has(seatId)) {
        next.delete(seatId);
      } else {
        next.add(seatId);
      }
      return next;
    });
  };

  const renderLayoutSeat = (seatId: number) => {
    const isBlocked = blockedSeats.has(seatId);
    return (
      <button
        type="button"
        key={seatId}
        onClick={() => handleSeatBlockToggle(seatId)}
        aria-pressed={isBlocked}
        aria-label={`Seat ${seatId} ${isBlocked ? "blocked" : "available"}`}
        className={[
          "grid h-11 w-11 place-items-center rounded-lg border text-sm font-semibold shadow-inner transition duration-150",
          isBlocked
            ? "border-[#e39b9b] bg-[#f7d9d9] text-[#9b1c1c] hover:bg-[#f2caca]"
            : "border-[#d6d9df] bg-[#e5e7eb] text-[#374151] hover:bg-[#dce0e7]",
        ].join(" ")}
      >
        {seatId}
      </button>
    );
  };

  const handleToggleMaintenance = () => {
    const numericId = Number(busId);
    const newStatus = busInfo.status === "active" ? "maintenance" : "active";
    setSaving(true);
    updateBus(numericId, buildSaveRequest({ status: newStatus }))
      .then(() => {
        setBusInfo((current) => ({
          ...current,
          status: newStatus as BusInfo["status"],
        }));
      })
      .catch((e) => setApiError(e.message))
      .finally(() => setSaving(false));
  };

  const handleDeleteBus = () => {
    const numericId = Number(busId);
    setSaving(true);
    deleteBusApi(numericId)
      .then(() => {
        setIsDeleteModalOpen(false);
        setIsBusDeleted(true);
      })
      .catch((e) => setApiError(e.message))
      .finally(() => setSaving(false));
  };

  const scheduleItems = [
    {
      time: "Today, 09:00 PM",
      route: "Colombo - Kandy",
      driver: assignedDriver.name,
      bookedText: "38/45 Booked",
      highlighted: true,
    },
    {
      time: "Tomorrow, 08:00 PM",
      route: "Kandy - Colombo",
      driver: assignedDriver.name,
      bookedText: "29/45 Booked",
      highlighted: false,
    },
    {
      time: "Friday, 07:30 AM",
      route: "Colombo - Galle",
      driver: assignedDriver.name,
      bookedText: "33/45 Booked",
      highlighted: false,
    },
    {
      time: "Saturday, 10:15 PM",
      route: "Galle - Colombo",
      driver: assignedDriver.name,
      bookedText: "17/45 Booked",
      highlighted: false,
    },
  ];

  // Overview and Schedule tabs share this same source, but with different limits.
  const visibleScheduleItems = isFullScheduleVisible
    ? scheduleItems
    : scheduleItems.slice(0, 2);
  const revenuePoints = useMemo(
    () => generateBusRevenue(busData?.busId ?? 0),
    [busData],
  );
  const totalRevenueLast30Days = useMemo(
    () => revenuePoints.reduce((sum, point) => sum + point.revenue, 0),
    [revenuePoints],
  );
  const averageRevenuePerDay = useMemo(
    () =>
      Math.round(totalRevenueLast30Days / Math.max(revenuePoints.length, 1)),
    [totalRevenueLast30Days, revenuePoints.length],
  );
  const revenueChartLabels = useMemo(
    () =>
      revenueChartLabelIndexes
        .map((index) => ({ index, point: revenuePoints[index] }))
        .filter((item): item is { index: number; point: BusRevenuePoint } =>
          Boolean(item.point),
        ),
    [revenuePoints],
  );
  const formatShortDate = (isoDate: string) =>
    new Date(isoDate).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    });
  const formatCurrencyShort = (amount: number) =>
    `Rs.${Math.round(amount / 1000)}k`;

  const chartHeight = 300;
  const chartWidth = 760;
  const chartPadding = { top: 24, right: 26, bottom: 44, left: 64 };
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const minRevenue = Math.min(...revenuePoints.map((point) => point.revenue));
  const maxRevenue = Math.max(...revenuePoints.map((point) => point.revenue));
  const yMin = Math.max(0, Math.floor((minRevenue - 800) / 500) * 500);
  const yMax = Math.ceil((maxRevenue + 800) / 500) * 500;
  const yRange = Math.max(1, yMax - yMin);
  const yTicks = Array.from({ length: 5 }, (_, index) =>
    Math.round(yMin + (index * yRange) / 4),
  );
  const getX = (index: number) =>
    chartPadding.left +
    (index / Math.max(revenuePoints.length - 1, 1)) * plotWidth;
  const getY = (value: number) =>
    chartPadding.top + ((yMax - value) / yRange) * plotHeight;
  const revenueLinePoints = revenuePoints
    .map((point, index) => `${getX(index)},${getY(point.revenue)}`)
    .join(" ");
  const revenueAreaPoints = [
    `${chartPadding.left},${chartPadding.top + plotHeight}`,
    ...revenuePoints.map(
      (point, index) => `${getX(index)},${getY(point.revenue)}`,
    ),
    `${chartPadding.left + plotWidth},${chartPadding.top + plotHeight}`,
  ].join(" ");

  return (
    <>
      {loading ? (
        <div className="mx-auto max-w-7xl space-y-4 py-12 text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-[#2642a6]" />
          <p className="text-sm text-[#64748b]">Loading bus details...</p>
        </div>
      ) : apiError && !busData ? (
        <div className="mx-auto max-w-7xl space-y-4 py-12 text-center">
          <h1 className="text-xl font-extrabold text-[#111827]">Bus Not Found</h1>
          <p className="text-sm text-[#64748b]">{apiError}</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard/buses')}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#203b96]"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Back to Buses
          </button>
        </div>
      ) : (
      <div className="mx-auto max-w-7xl space-y-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard/buses')}
              className="flex items-center gap-2 text-sm text-[#202535] transition duration-200 hover:-translate-x-0.5"
              aria-label="Go back"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span className="font-semibold">Back</span>
            </button>

            <section
              className="dashboard-card animate-dash-in rounded-xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm"
              style={{ animationDelay: "80ms" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-28 w-44 shrink-0 items-center justify-center rounded-lg bg-[#e8ecf4]">
                    <FontAwesomeIcon icon={faBus} className="text-4xl text-[#6b7a99]" />
                  </div>
                  <div>
                    <span
                      className={[
                        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold",
                        busInfo.status === "active"
                          ? "bg-[#e7f8eb] text-[#0f9b45]"
                          : busInfo.status === "maintenance"
                            ? "bg-[#fff3d8] text-[#99680b]"
                            : "bg-[#f3f4f6] text-[#6b7280]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "h-2.5 w-2.5 rounded-full",
                          busInfo.status === "active"
                            ? "animate-status-dot bg-[#0fb24a]"
                            : busInfo.status === "maintenance"
                              ? "bg-[#efaf00]"
                              : "bg-[#9ca3af]",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                      {busInfo.status.charAt(0).toUpperCase() + busInfo.status.slice(1)}
                    </span>
                    <h1 className="mt-1 text-lg font-extrabold tracking-tight text-[#1f2737]">
                      {busInfo.code}
                    </h1>
                    <p className="mt-1 text-sm text-[#5d677e]">
                      <FontAwesomeIcon
                        icon={faUsers}
                        className="mr-2 text-sm"
                      />
                      {busInfo.seats} Seats
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={openEditBusModal}
                    disabled={isBusDeleted}
                    className="rounded-lg border border-[#d5d9e3] bg-white px-4 py-2 text-sm font-bold text-[#2f394d] transition duration-200 hover:-translate-y-0.5"
                  >
                    <FontAwesomeIcon icon={faPen} className="mr-2" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleMaintenance}
                    disabled={isBusDeleted}
                    className="rounded-lg border border-[#e2cf8f] bg-[#fff7db] px-4 py-2 text-sm font-bold text-[#99680b] transition duration-200 hover:-translate-y-0.5"
                  >
                    <FontAwesomeIcon
                      icon={faScrewdriverWrench}
                      className="mr-2"
                    />
                    {busInfo.status === "maintenance"
                      ? "Mark Active"
                      : "Maintenance"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="rounded-lg bg-[#f25555] px-5 py-2 text-sm font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#e64747]"
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
                <h2 className="text-sm font-bold text-[#8d1f1f]">
                  Bus deleted
                </h2>
                <p className="mt-2 text-sm text-[#9a5555]">
                  This is the delete action for the UI flow.
                </p>
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
                <article
                  className="dashboard-card animate-dash-in rounded-xl border border-[#dee1e8] bg-[#f7f8fc] p-4 shadow-sm"
                  style={{ animationDelay: "130ms" }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[#1f2737]">
                      Vehicle Specs
                    </h2>
                    <FontAwesomeIcon
                      icon={faEllipsis}
                      className="text-[#6f7788]"
                    />
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      ["Brand", busInfo.brand],
                      ["Condition", busInfo.condition ? busInfo.condition.replace(/_/g, " ") : "—"],
                      ["Type", busInfo.type ? busInfo.type.replace(/_/g, " ") : "—"],
                      ["Registration", busInfo.registrationNumber || "—"],
                      ["Route", busInfo.routeName || "Not assigned"],
                      ["Start Time", busInfo.startTime || "—"],
                      ["End Time", busInfo.endTime || "—"],
                      ["Insurance Exp", busInfo.insuranceExp || "—"],
                    ].map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-start justify-between gap-3 border-b border-[#eceef4] pb-1.5 last:border-0 last:pb-0"
                      >
                        <span className="shrink-0 text-[#7b8394]">{key}</span>
                        <span className="min-w-0 break-words text-right font-semibold text-[#2c3448] capitalize">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>

                <article
                  className="dashboard-card animate-dash-in rounded-xl border border-[#dee1e8] bg-[#f7f8fc] p-4 shadow-sm"
                  style={{ animationDelay: "170ms" }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[#1f2737]">
                      Assigned Driver
                    </h2>
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
                      <p className="text-sm font-bold text-[#1f2737]">
                        {assignedDriver.name}
                      </p>
                      <p className="text-sm text-[#8a93a4]">
                        ID: {assignedDriver.id}
                      </p>
                      <p className="text-sm font-semibold text-[#efaf00]">
                        <FontAwesomeIcon icon={faStar} className="mr-1" />
                        {assignedDriver.rating}{" "}
                        <span className="text-[#8a93a4]">
                          ({assignedDriver.trips} trips)
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-[#d8dce6] px-3 py-2 text-sm font-semibold text-[#2f394d] transition duration-200 hover:bg-[#f0f3fa]"
                    >
                      <FontAwesomeIcon icon={faPhone} className="mr-2" />
                      {assignedDriver.phone}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[#d8dce6] px-3 py-2 text-sm font-semibold text-[#2f394d] transition duration-200 hover:bg-[#f0f3fa]"
                    >
                      <FontAwesomeIcon icon={faComment} className="mr-2" />
                      Message
                    </button>
                  </div>
                </article>

                <article
                  className="dashboard-card animate-dash-in overflow-hidden rounded-xl border border-[#dee1e8] bg-[#f7f8fc] shadow-sm"
                  style={{ animationDelay: "210ms" }}
                >
                  <img
                    src={mapImage}
                    alt="Map showing the current bus location"
                    className="h-40 w-full object-cover"
                  />
                  <div className="flex items-end justify-between p-4">
                    <div>
                      <p className="text-sm font-semibold text-[#8a93a4]">
                        Current Location
                      </p>
                      <p className="text-sm font-bold text-[#232c3f]">
                        NH44, Near Electronic City
                      </p>
                      <p className="text-sm text-[#8a93a4]">
                        Last updated: 2 min ago
                      </p>
                    </div>
                    <FontAwesomeIcon
                      icon={faLocationDot}
                      className="pb-2 text-xl text-[#263247]"
                    />
                  </div>
                </article>

                <article
                  className="dashboard-card animate-dash-in rounded-xl border border-[#dee1e8] bg-[#f7f8fc] p-4 shadow-sm"
                  style={{ animationDelay: "250ms" }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[#1f2737]">
                      Amenities
                    </h2>
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
                        key={amenity.key}
                        className={[
                          "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition duration-200 hover:-translate-y-0.5",
                          amenity.enabled
                            ? "border-[#e5e8f0] bg-[#f2f4f8] text-[#3a4255]"
                            : "border-[#eceff5] bg-[#f7f8fb] text-[#9fa7b7]",
                        ].join(" ")}
                      >
                        <FontAwesomeIcon
                          icon={amenity.icon}
                          className="text-xs"
                        />
                        {amenity.name}
                      </div>
                    ))}
                  </div>
                </article>
              </section>
            )}

            {!isBusDeleted ? (
              <section
                className="dashboard-card animate-dash-in overflow-hidden rounded-xl border border-[#dee1e8] bg-[#f7f8fc] shadow-sm"
                style={{ animationDelay: "300ms" }}
              >
                <div className="flex gap-6 border-b border-[#dee1e8] px-5 pt-3">
                  {[
                    { label: "Overview", value: "overview" as DashboardTab },
                    { label: "Schedule", value: "schedule" as DashboardTab },
                    { label: "Revenue", value: "revenue" as DashboardTab },
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setActiveTab(tab.value)}
                      className={[
                        "border-b-2 pb-3 text-sm font-semibold transition duration-200",
                        activeTab === tab.value
                          ? "border-[#2642a6] text-[#2642a6]"
                          : "border-transparent text-[#6f7788] hover:text-[#50586a]",
                      ].join(" ")}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === "overview" ? (
                  <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[2fr_1fr]">
                    <article className="dashboard-card rounded-xl border border-[#e6e8ef] bg-[#f7f8fc] p-5">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-[#1f2737]">
                            Revenue Trends
                          </h3>
                          <p className="text-sm text-[#8a93a4]">
                            Revenue earned by this bus over the last 30 days
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-md border border-[#d6dae4] bg-white px-3 py-1 text-sm text-[#3d4558] transition duration-200 hover:bg-[#f2f5fd]"
                        >
                          Last 30 Days
                        </button>
                      </div>

                      <svg
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                        className="h-[300px] w-full rounded-lg bg-[#f9fafd]"
                        role="img"
                        aria-label="30-day revenue trend for the selected bus"
                      >
                        <line
                          x1={chartPadding.left}
                          y1={chartPadding.top}
                          x2={chartPadding.left}
                          y2={chartPadding.top + plotHeight}
                          stroke="#d8dcea"
                        />
                        <line
                          x1={chartPadding.left}
                          y1={chartPadding.top + plotHeight}
                          x2={chartPadding.left + plotWidth}
                          y2={chartPadding.top + plotHeight}
                          stroke="#d8dcea"
                        />

                        {yTicks.map((tick) => (
                          <line
                            key={tick}
                            x1={chartPadding.left}
                            y1={getY(tick)}
                            x2={chartPadding.left + plotWidth}
                            y2={getY(tick)}
                            stroke="#e5e8f0"
                          />
                        ))}

                        <polygon
                          points={revenueAreaPoints}
                          fill="rgba(79,125,247,0.14)"
                        />
                        <polyline
                          fill="none"
                          stroke="#3258d6"
                          strokeWidth="3"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          points={revenueLinePoints}
                        />

                        {revenuePoints.map((point, index) =>
                          index % 5 === 0 ||
                          index === revenuePoints.length - 1 ? (
                            <circle
                              key={point.date}
                              cx={getX(index)}
                              cy={getY(point.revenue)}
                              r="2.7"
                              fill="#3258d6"
                            />
                          ) : null,
                        )}

                        <g fill="#7b8394" fontSize="11">
                          {yTicks.map((tick) => (
                            <text
                              key={tick}
                              x={chartPadding.left - 8}
                              y={getY(tick) + 4}
                              textAnchor="end"
                            >
                              {formatCurrencyShort(tick)}
                            </text>
                          ))}
                        </g>

                        <g fill="#7b8394" fontSize="11">
                          {revenueChartLabels.map(({ index, point }) => (
                            <text
                              key={point.date}
                              x={getX(index)}
                              y={chartHeight - 14}
                              textAnchor="middle"
                            >
                              {formatShortDate(point.date)}
                            </text>
                          ))}
                        </g>
                      </svg>

                      <div className="mt-2 grid grid-cols-2 gap-4 border-t border-[#eceff5] pt-3 text-center">
                        <div>
                          <p className="text-sm text-[#8a93a4]">
                            Total Revenue
                          </p>
                          <p className="text-sm font-extrabold text-[#1f2737]">
                            Rs.{totalRevenueLast30Days.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-[#8a93a4]">Avg. Per Day</p>
                          <p className="text-sm font-extrabold text-[#1f2737]">
                            Rs.{averageRevenuePerDay.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </article>

                    <article className="dashboard-card rounded-xl border border-[#e6e8ef] bg-[#f7f8fc] p-5">
                      <h3 className="text-sm font-bold text-[#1f2737]">
                        Upcoming Schedule
                      </h3>
                      <div className="mt-4 space-y-4">
                        {visibleScheduleItems.map((item) => (
                          <div
                            key={`${item.time}-${item.route}`}
                            className={[
                              "border-l-2 pl-4",
                              item.highlighted ? "border-[#2642a6]" : "border-[#d0d5e0]",
                            ].join(" ")}
                          >
                            <p
                              className={[
                                "text-sm font-bold",
                                item.highlighted ? "text-[#2642a6]" : "text-[#6e7587]",
                              ].join(" ")}
                            >
                              {item.time}
                            </p>
                            <p className="text-sm font-extrabold text-[#1f2737]">
                              {item.route}
                            </p>
                            <p className="text-sm text-[#8a93a4]">
                              Driver: {item.driver}
                            </p>
                            <p className="mt-1 inline-block rounded bg-[#edf2ff] px-2 py-0.5 text-sm font-semibold text-[#2642a6]">
                              {item.bookedText}
                            </p>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("schedule");
                          setIsFullScheduleVisible(true);
                        }}
                        className="mt-4 w-full rounded-lg border border-[#d9dde7] bg-[#f5f7fb] py-2 text-sm font-semibold text-[#495162] transition duration-200 hover:bg-[#eef2fa]"
                      >
                        View Full Schedule
                      </button>
                    </article>
                  </div>
                ) : null}

                {activeTab === "schedule" ? (
                  <div className="p-4">
                    <article className="dashboard-card rounded-xl border border-[#e6e8ef] bg-[#f7f8fc] p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[#1f2737]">
                          Bus Schedule
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            setIsFullScheduleVisible((value) => !value)
                          }
                          className="rounded-md border border-[#d6dae4] bg-white px-3 py-1 text-sm font-semibold text-[#3d4558] transition duration-200 hover:bg-[#f2f5fd]"
                        >
                          {isFullScheduleVisible
                            ? "Show Less"
                            : "View Full Schedule"}
                        </button>
                      </div>
                      <div className="space-y-4">
                        {visibleScheduleItems.map((item) => (
                          <div
                            key={`${item.time}-${item.route}`}
                            className={
                              item.highlighted
                                ? "rounded-lg border-l-4 border-[#2642a6] bg-[#f3f6ff] px-4 py-3"
                                : "rounded-lg border-l-4 border-[#d0d5e0] bg-[#f8f9fd] px-4 py-3"
                            }
                          >
                            <p
                              className={
                                item.highlighted
                                  ? "text-sm font-bold text-[#2642a6]"
                                  : "text-sm font-bold text-[#6e7587]"
                              }
                            >
                              {item.time}
                            </p>
                            <p className="text-sm font-extrabold text-[#1f2737]">
                              {item.route}
                            </p>
                            <p className="text-sm text-[#8a93a4]">
                              Driver: {item.driver}
                            </p>
                            <p className="mt-1 inline-block rounded bg-[#edf2ff] px-2 py-0.5 text-sm font-semibold text-[#2642a6]">
                              {item.bookedText}
                            </p>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>
                ) : null}

                {activeTab === "revenue" ? (
                  <div className="p-4">
                    <article className="dashboard-card rounded-xl border border-[#e6e8ef] bg-[#f7f8fc] p-5">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-[#1f2737]">
                            Revenue Trends
                          </h3>
                          <p className="text-sm text-[#8a93a4]">
                            Revenue earned by this bus over the last 30 days
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-md border border-[#d6dae4] bg-white px-3 py-1 text-sm text-[#3d4558] transition duration-200 hover:bg-[#f2f5fd]"
                        >
                          Last 30 Days
                        </button>
                      </div>

                      <svg
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                        className="h-[300px] w-full rounded-lg bg-[#f9fafd]"
                        role="img"
                        aria-label="30-day revenue trend for the selected bus"
                      >
                        <line
                          x1={chartPadding.left}
                          y1={chartPadding.top}
                          x2={chartPadding.left}
                          y2={chartPadding.top + plotHeight}
                          stroke="#d8dcea"
                        />
                        <line
                          x1={chartPadding.left}
                          y1={chartPadding.top + plotHeight}
                          x2={chartPadding.left + plotWidth}
                          y2={chartPadding.top + plotHeight}
                          stroke="#d8dcea"
                        />

                        {yTicks.map((tick) => (
                          <line
                            key={tick}
                            x1={chartPadding.left}
                            y1={getY(tick)}
                            x2={chartPadding.left + plotWidth}
                            y2={getY(tick)}
                            stroke="#e5e8f0"
                          />
                        ))}

                        <polygon
                          points={revenueAreaPoints}
                          fill="rgba(79,125,247,0.14)"
                        />
                        <polyline
                          fill="none"
                          stroke="#3258d6"
                          strokeWidth="3"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          points={revenueLinePoints}
                        />

                        {revenuePoints.map((point, index) =>
                          index % 5 === 0 ||
                          index === revenuePoints.length - 1 ? (
                            <circle
                              key={point.date}
                              cx={getX(index)}
                              cy={getY(point.revenue)}
                              r="2.7"
                              fill="#3258d6"
                            />
                          ) : null,
                        )}

                        <g fill="#7b8394" fontSize="11">
                          {yTicks.map((tick) => (
                            <text
                              key={tick}
                              x={chartPadding.left - 8}
                              y={getY(tick) + 4}
                              textAnchor="end"
                            >
                              {formatCurrencyShort(tick)}
                            </text>
                          ))}
                        </g>

                        <g fill="#7b8394" fontSize="11">
                          {revenueChartLabels.map(({ index, point }) => (
                            <text
                              key={point.date}
                              x={getX(index)}
                              y={chartHeight - 14}
                              textAnchor="middle"
                            >
                              {formatShortDate(point.date)}
                            </text>
                          ))}
                        </g>
                      </svg>

                      <div className="mt-2 grid grid-cols-2 gap-4 border-t border-[#eceff5] pt-3 text-center">
                        <div>
                          <p className="text-sm text-[#8a93a4]">
                            Total Revenue
                          </p>
                          <p className="text-sm font-extrabold text-[#1f2737]">
                            Rs.{totalRevenueLast30Days.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-[#8a93a4]">Avg. Per Day</p>
                          <p className="text-sm font-extrabold text-[#1f2737]">
                            Rs.{averageRevenuePerDay.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </article>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
      )}

      {isAmenityModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#101426]/45 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#d8deea] bg-[#f7f8fc] shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="flex items-center justify-between border-b border-[#e1e5ef] px-6 py-4">
              <div>
                <h2 className="text-sm font-extrabold text-[#1f2737]">
                  Edit Amenities
                </h2>
                <p className="text-sm text-[#6d778e]">
                  Enable or disable amenities for this bus.
                </p>
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
                  key={amenity.key}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-[#e3e7f0] bg-[#f9fafd] px-4 py-3"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-[#2f394d]">
                    <FontAwesomeIcon icon={amenity.icon} className="text-xs" />
                    {amenity.name}
                  </span>
                  <input
                    type="checkbox"
                    checked={amenity.enabled}
                    onChange={() => handleAmenityToggle(amenity.key)}
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#101426]/45 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#d8deea] bg-[#f7f8fc] shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="flex items-center justify-between border-b border-[#e1e5ef] px-6 py-4">
              <div>
                <h2 className="text-sm font-extrabold text-[#1f2737]">
                  Change Driver
                </h2>
                <p className="text-sm text-[#6d778e]">
                  Update assigned driver details.
                </p>
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
              <div className="md:col-span-2">
                <label htmlFor="driver-select" className="mb-1 block text-sm font-semibold text-[#45516b]">Select Driver</label>
                <select id="driver-select" value={driverDraft.id}
                  onChange={(e) => handleDriverSelect(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none">
                  <option value="">-- Select a driver --</option>
                  {driverOptions.map((d) => (
                    <option key={d.driverId} value={d.driverId}>{d.name} (ID: {d.driverId})</option>
                  ))}
                </select>
              </div>
              {driverDraft.id ? (
                <>
                  <div>
                    <p className="mb-1 block text-sm font-semibold text-[#45516b]">Driver Name</p>
                    <div className="flex h-11 w-full items-center rounded-lg border border-[#d7dde9] bg-[#eef1f7] px-3 text-sm text-[#6a7284]">{driverDraft.name}</div>
                  </div>
                  <div>
                    <p className="mb-1 block text-sm font-semibold text-[#45516b]">Driver ID</p>
                    <div className="flex h-11 w-full items-center rounded-lg border border-[#d7dde9] bg-[#eef1f7] px-3 text-sm text-[#6a7284]">{driverDraft.id}</div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#e1e5ef] px-6 py-4">
              {driverFormError ? (
                <p className="mr-auto text-sm font-semibold text-[#d14343]">
                  {driverFormError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setDriverFormError("");
                  setIsDriverModalOpen(false);
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#101426]/45 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#d8deea] bg-[#f7f8fc] shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="flex items-center justify-between border-b border-[#e1e5ef] px-6 py-4">
              <div>
                <h2 className="text-sm font-extrabold text-[#1f2737]">
                  Edit Bus
                </h2>
                <p className="text-sm text-[#6d778e]">
                  Update basic bus details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBusFormError("");
                  setIsEditBusModalOpen(false);
                }}
                className="grid h-9 w-9 place-items-center rounded-md text-[#6d778e] transition duration-200 hover:bg-[#eceff7] hover:text-[#1f2737]"
                aria-label="Close bus editor"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
              {/* Bus Number */}
              <div>
                <label htmlFor="bus-code" className="mb-1 block text-sm font-semibold text-[#45516b]">Bus Number</label>
                <input id="bus-code" value={busDraft.code}
                  onChange={(e) => setBusDraft((p) => ({ ...p, code: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* Registration Number */}
              <div>
                <label htmlFor="bus-reg" className="mb-1 block text-sm font-semibold text-[#45516b]">Registration Number</label>
                <input id="bus-reg" value={busDraft.registrationNumber}
                  onChange={(e) => setBusDraft((p) => ({ ...p, registrationNumber: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* Seats */}
              <div>
                <label htmlFor="bus-seats" className="mb-1 block text-sm font-semibold text-[#45516b]">Seats</label>
                <input id="bus-seats" value={busDraft.seats}
                  onChange={(e) => setBusDraft((p) => ({ ...p, seats: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* Brand */}
              <div>
                <label htmlFor="bus-brand" className="mb-1 block text-sm font-semibold text-[#45516b]">Brand</label>
                <input id="bus-brand" value={busDraft.brand}
                  onChange={(e) => setBusDraft((p) => ({ ...p, brand: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* Bus Condition — dropdown with DB ENUM values */}
              <div>
                <label htmlFor="bus-condition" className="mb-1 block text-sm font-semibold text-[#45516b]">Condition</label>
                <select id="bus-condition" value={busDraft.condition}
                  onChange={(e) => setBusDraft((p) => ({ ...p, condition: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none">
                  <option value="">Select condition</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="needs_maintenance">Needs Maintenance</option>
                </select>
              </div>
              {/* Bus Type — dropdown with DB ENUM values */}
              <div>
                <label htmlFor="bus-type" className="mb-1 block text-sm font-semibold text-[#45516b]">Type</label>
                <select id="bus-type" value={busDraft.type}
                  onChange={(e) => setBusDraft((p) => ({ ...p, type: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none">
                  <option value="">Select type</option>
                  <option value="highway">Highway</option>
                  <option value="long_distance">Long Distance</option>
                  <option value="trip_booking">Trip Booking</option>
                  <option value="corporate">Corporate</option>
                </select>
              </div>
              {/* Status */}
              <div>
                <label htmlFor="bus-status" className="mb-1 block text-sm font-semibold text-[#45516b]">Status</label>
                <select id="bus-status" value={busDraft.status}
                  onChange={(e) => setBusDraft((p) => ({ ...p, status: e.target.value as BusInfo["status"] }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none">
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {/* Route */}
              <div>
                <label htmlFor="bus-route" className="mb-1 block text-sm font-semibold text-[#45516b]">Route</label>
                <select id="bus-route" value={busDraft.routeId ?? ""}
                  onChange={(e) => {
                    const rid = e.target.value ? Number(e.target.value) : null;
                    const rName = routeOptions.find((r) => r.routeId === rid)?.routeName ?? "";
                    setBusDraft((p) => ({ ...p, routeId: rid, routeName: rName }));
                  }}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none">
                  <option value="">No route assigned</option>
                  {routeOptions.map((r) => (
                    <option key={r.routeId} value={r.routeId}>{r.routeName}</option>
                  ))}
                </select>
              </div>
              {/* Start Time */}
              <div>
                <label htmlFor="bus-start-time" className="mb-1 block text-sm font-semibold text-[#45516b]">Start Time</label>
                <input id="bus-start-time" type="time" value={busDraft.startTime}
                  onChange={(e) => setBusDraft((p) => ({ ...p, startTime: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* End Time */}
              <div>
                <label htmlFor="bus-end-time" className="mb-1 block text-sm font-semibold text-[#45516b]">End Time</label>
                <input id="bus-end-time" type="time" value={busDraft.endTime}
                  onChange={(e) => setBusDraft((p) => ({ ...p, endTime: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* Insurance Expiry Date */}
              <div>
                <label htmlFor="bus-insurance" className="mb-1 block text-sm font-semibold text-[#45516b]">Insurance Expiry</label>
                <input id="bus-insurance" type="date" value={busDraft.insuranceExp}
                  onChange={(e) => setBusDraft((p) => ({ ...p, insuranceExp: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d7dde9] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
            </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#e1e5ef] px-6 py-4">
              {busFormError ? (
                <p className="mr-auto text-sm font-semibold text-[#d14343]">
                  {busFormError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={openEditLayoutModal}
                className="rounded-lg border border-[#c7d2f2] bg-[#edf2ff] px-4 py-2 text-sm font-semibold text-[#2642a6] transition duration-200 hover:bg-[#e3ebff]"
              >
                Edit Layout
              </button>
              <button
                type="button"
                onClick={() => {
                  setBusFormError("");
                  setIsEditBusModalOpen(false);
                }}
                className="rounded-lg border border-[#d3d9e6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#e9edf7]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBus}
                className="rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-bold text-white transition duration-200 hover:bg-[#203b96]"
              >
                Save Bus
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditLayoutModalOpen ? (
        <div className="fixed inset-0 z-50 bg-[#f6f7f9]">
          <div className="flex h-full flex-col">
            <header className="border-b border-[#e2e8f0] bg-white px-5 py-4">
              <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditLayoutModalOpen(false);
                    setIsEditBusModalOpen(true);
                  }}
                  className="grid h-10 w-10 place-items-center rounded-full text-[#111827] transition duration-200 hover:bg-[#eef2f8]"
                  aria-label="Back to edit bus"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                </button>
                <div className="text-center">
                  <h2 className="text-lg font-bold text-[#111827]">
                    Edit Bus Layout
                  </h2>
                  <p className="text-xs text-[#7f8ea3]">Bus {busDraft.code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditLayoutModalOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full text-[#111827] transition duration-200 hover:bg-[#eef2f8]"
                  aria-label="Close bus layout editor"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                <section
                  className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm mx-auto"
                  style={{ maxWidth: `${previewMaxWidth}px` }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold tracking-[0.04em] text-[#334155]">
                      Bus Layout Preview
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#fce7e7] px-3 py-1 text-xs font-bold text-[#9b1c1c]">
                        {blockedSeatCount} Blocked
                      </span>
                      <span className="rounded-full bg-[#edf2ff] px-3 py-1 text-xs font-bold text-[#2d4db2]">
                        {Math.max(appliedLayoutSeatCount - blockedSeatCount, 0)}{" "}
                        Available
                      </span>
                    </div>
                  </div>

                  <div className="relative rounded-xl border border-[#e9edf5] bg-[#fbfcff] p-4 md:p-5">
                    <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#6b7280] shadow-sm">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f3f4f6] text-[#9ca3af]">
                        <FontAwesomeIcon icon={faCircleUser} />
                      </span>
                      Driver
                    </div>

                    {seatPreview.driverSide.length ? (
                      <div className="absolute left-4 top-4 flex items-center gap-2">
                        {seatPreview.driverSide.map((seatId) =>
                          renderLayoutSeat(seatId),
                        )}
                      </div>
                    ) : null}

                    <div className="pointer-events-none absolute bottom-6 left-1/2 top-16 w-px -translate-x-1/2 border-l border-dashed border-[#d9e0ee]" />
                    <div className="pointer-events-none absolute left-1/2 top-[52%] -translate-x-1/2 rounded-full bg-[#f1f5f9] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
                      Aisle
                    </div>

                    <div className="space-y-3 pt-16 pb-6">
                      {seatPreview.rows.map((row, rowIndex) => {
                        if (row.kind === "bench") {
                          return (
                            <div
                              key={`layout-row-last-${rowIndex + 1}`}
                              className="space-y-1"
                            >
                              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
                                Rear Bench
                              </p>
                              <div
                                className="grid justify-center gap-2"
                                style={{
                                  gridTemplateColumns: `repeat(${row.seats.length}, 48px)`,
                                }}
                              >
                                {row.seats.map((seatId) =>
                                  renderLayoutSeat(seatId),
                                )}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={`layout-row-${rowIndex + 1}`}
                            className="grid items-center justify-center gap-3"
                            style={{
                              gridTemplateColumns: `repeat(${layoutConfig.leftSeatsPerRow}, 48px) 32px repeat(${layoutConfig.rightSeatsPerRow}, 48px)`,
                            }}
                          >
                            {row.left.map((seatId) => renderLayoutSeat(seatId))}
                            <span aria-hidden className="h-4" />
                            {row.right.map((seatId) =>
                              renderLayoutSeat(seatId),
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <aside className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm lg:sticky lg:top-4">
                  <h3 className="text-sm font-bold tracking-[0.04em] text-[#334155]">
                    Layout Controls
                  </h3>
                  <p className="mt-1 text-xs text-[#7a8799]">
                    Set seat counts, then press OK to regenerate layout.
                  </p>

                  <div className="mt-4 space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-[#4b5568]">
                        Rows (front to back)
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={layoutDraftConfig.rows}
                        onChange={(event) =>
                          updateLayoutDraft(
                            "rows",
                            Number.parseInt(event.target.value || "0", 10),
                          )
                        }
                        className="h-10 w-full rounded-lg border border-[#d6deec] bg-[#fbfcff] px-3 text-sm text-[#243244] outline-none focus:border-[#9db3ee]"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[#4b5568]">
                          Left Seats / Row
                        </span>
                        <select
                          value={layoutDraftConfig.leftSeatsPerRow}
                          onChange={(event) =>
                            updateLayoutDraft(
                              "leftSeatsPerRow",
                              Number.parseInt(event.target.value, 10),
                            )
                          }
                          className="h-10 w-full rounded-lg border border-[#d6deec] bg-[#fbfcff] px-3 text-sm text-[#243244] outline-none focus:border-[#9db3ee]"
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[#4b5568]">
                          Right Seats / Row
                        </span>
                        <select
                          value={layoutDraftConfig.rightSeatsPerRow}
                          onChange={(event) =>
                            updateLayoutDraft(
                              "rightSeatsPerRow",
                              Number.parseInt(event.target.value, 10),
                            )
                          }
                          className="h-10 w-full rounded-lg border border-[#d6deec] bg-[#fbfcff] px-3 text-sm text-[#243244] outline-none focus:border-[#9db3ee]"
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-[#4b5568]">
                        Rear Bench Seats
                      </span>
                      <select
                        value={layoutDraftConfig.rearRowSeats}
                        onChange={(event) =>
                          updateLayoutDraft(
                            "rearRowSeats",
                            Number.parseInt(event.target.value, 10),
                          )
                        }
                        className="h-10 w-full rounded-lg border border-[#d6deec] bg-[#fbfcff] px-3 text-sm text-[#243244] outline-none focus:border-[#9db3ee]"
                      >
                        <option value={0}>0</option>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={5}>5</option>
                        <option value={6}>6</option>
                        <option value={7}>7</option>
                        <option value={8}>8</option>
                      </select>
                    </label>

                    <div className="flex items-center justify-between rounded-lg border border-[#dce5f4] bg-[#f7faff] px-3 py-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6c7f9a]">
                          Draft Total Seats
                        </p>
                        <p className="mt-1 text-lg font-extrabold text-[#1f2937]">
                          {draftLayoutSeatCount}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6c7f9a]">
                          Driver Left Seat
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setLayoutDraftConfig((current) => ({
                              ...current,
                              driverLeftSeats: current.driverLeftSeats ? 0 : 1,
                            }))
                          }
                          className={[
                            "relative h-6 w-11 rounded-full transition-colors duration-150",
                            layoutDraftConfig.driverLeftSeats
                              ? "bg-[#1474f2]"
                              : "bg-[#d7dde9]",
                          ].join(" ")}
                          aria-pressed={layoutDraftConfig.driverLeftSeats > 0}
                        >
                          <span
                            className={[
                              "absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition duration-150",
                              layoutDraftConfig.driverLeftSeats
                                ? "left-[22px]"
                                : "left-[3px]",
                            ].join(" ")}
                          />
                        </button>
                      </div>
                    </div>

                    {layoutDraftConfig.driverLeftSeats ? (
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[#4b5568]">
                          Seats beside driver
                        </span>
                        <select
                          value={layoutDraftConfig.driverLeftSeats}
                          onChange={(event) =>
                            updateLayoutDraft(
                              "driverLeftSeats",
                              Number.parseInt(event.target.value, 10),
                            )
                          }
                          className="h-10 w-full rounded-lg border border-[#d6deec] bg-[#fbfcff] px-3 text-sm text-[#243244] outline-none focus:border-[#9db3ee]"
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </label>
                    ) : null}

                    {layoutConfigError ? (
                      <p className="text-xs font-semibold text-[#d14343]">
                        {layoutConfigError}
                      </p>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleApplyLayoutConfig}
                      className="w-full rounded-lg bg-[#1474f2] px-4 py-2 text-sm font-bold text-white transition duration-200 hover:bg-[#1268d8]"
                    >
                      OK - Apply Layout
                    </button>

                    <div className="flex flex-wrap justify-center gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditLayoutModalOpen(false);
                          setIsEditBusModalOpen(true);
                        }}
                        className="rounded-lg border border-[#d3d9e6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#e9edf7]"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Save seat layout to API
                          const numericId = Number(busId);
                          const rows = buildSeatLayoutRows(layoutConfig);
                          const apiRows: ApiSeatLayoutRow[] = rows.map((row, idx) => ({
                            rowNum: idx + 1,
                            left: row.left,
                            right: row.right ?? [],
                            lastRow: row.lastRow ?? null,
                          }));
                          setSaving(true);
                          saveSeatLayoutApi(numericId, { rows: apiRows })
                            .then(() => {
                              setIsEditLayoutModalOpen(false);
                              setIsEditBusModalOpen(true);
                            })
                            .catch((e) => setLayoutConfigError(e.message))
                            .finally(() => setSaving(false));
                        }}
                        disabled={saving}
                        className="rounded-lg bg-[#1474f2] px-5 py-2 text-sm font-bold text-white transition duration-200 hover:bg-[#1268d8]"
                      >
                        {saving ? "Saving..." : "Save Layout"}
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#101426]/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#f0d6d6] bg-[#fff7f7] shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="border-b border-[#efdcdc] px-6 py-4">
              <h2 className="text-sm font-extrabold text-[#8d1f1f]">
                Delete Bus
              </h2>
              <p className="text-sm text-[#9a5555]">
                Are you sure you want to delete {busInfo.code}?
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded-lg border border-[#d3d9e6] bg-white px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#f5f7fc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBus}
                className="rounded-lg bg-[#e04444] px-5 py-2 text-sm font-bold text-white transition duration-200 hover:bg-[#d43939]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default BusDetail;
