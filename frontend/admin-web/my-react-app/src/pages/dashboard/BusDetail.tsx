import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useMemo, useRef, useState } from "react";
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
  faTrash,
  faTv,
  faUsers,
  faVideo,
  faWifi,
  faXmark,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import adminProfileImage from "../../assets/images/adminProfilePlaceholder.svg";
import { getBusImage } from "../../utils/busImage";
import {
  fetchAdminDriver,
  updateAdminDriver,
  validateAdminDriverRequest,
  type AdminDriver,
  type SaveAdminDriverRequest,
} from "../../services/driverService";

// Google Maps API key supplied by the repository root .env through vite.config.ts.
const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();

/*
  Google Maps Script Loader - Lazy loads the Google Maps API
 
  This prevents loading the Google Maps script if it's already loaded,
  optimizing performance by ensuring the script is loaded only once
  even if multiple components need it.
*/
let mapsScriptLoaded = false;
let mapsScriptPromise: Promise<void> | null = null;
let mapsAuthFailed = false;
const MAPS_AUTH_FAILURE_EVENT = "trackngo-google-maps-auth-failure";

/*
  Loads the Google Maps JavaScript API dynamically
  
  Uses a promise-based approach to load the script asynchronously
  and handles both success and error cases.
  
  @returns Promise that resolves when the script is loaded
*/
function loadMapsScript(): Promise<void> {
  if (!GOOGLE_MAPS_KEY) {
    return Promise.reject(new Error("Google Maps API key is missing"));
  }
  if (mapsAuthFailed) {
    return Promise.reject(new Error("Google Maps authorization failed"));
  }
  if (mapsScriptLoaded || window.google?.maps) {
    mapsScriptLoaded = true;
    return Promise.resolve();
  }
  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const mapsWindow = window as Window & { gm_authFailure?: () => void };
    const previousAuthFailure = mapsWindow.gm_authFailure;

    // Google reports invalid keys and referrer/billing restrictions through this
    // callback while still returning a successful script response.
    mapsWindow.gm_authFailure = () => {
      mapsAuthFailed = true;
      mapsScriptLoaded = false;
      mapsScriptPromise = null;
      previousAuthFailure?.();
      window.dispatchEvent(new Event(MAPS_AUTH_FAILURE_EVENT));
      reject(new Error("Google Maps authorization failed"));
    };

    script.id = "trackngo-google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&libraries=marker&loading=async`;
    script.async = true;
    script.onload = () => {
      if (mapsAuthFailed) return;
      mapsScriptLoaded = true;
      resolve();
    };
    script.onerror = () => {
      mapsScriptPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });
  return mapsScriptPromise;
}

function buildEmbedMapUrl(location: string) {
  const query = `${location.trim() || "Colombo"}, Sri Lanka`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=14&output=embed`;
}

/*
  BusLocationMap Component - Displays a map with a location marker
  
  This component renders a Google Map centered on the given location
  (geocoded to coordinates). A bus marker is placed at the location.
  The component handles cleanup on unmount to prevent state updates
  on unmounted components.
  
  @param locationName - The location name to geocode and display
 */
function BusLocationMap({ locationName }: { locationName: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [useEmbedFallback, setUseEmbedFallback] = useState(!GOOGLE_MAPS_KEY);

  useEffect(() => {
    let cancelled = false;
    setUseEmbedFallback(!GOOGLE_MAPS_KEY);
    const handleMapsAuthFailure = () => {
      if (!cancelled) setUseEmbedFallback(true);
    };
    window.addEventListener(MAPS_AUTH_FAILURE_EVENT, handleMapsAuthFailure);

    async function init() {
      try {
        // Load Google Maps API
        await loadMapsScript();
        if (cancelled || !mapRef.current) return;

        // Geocode the location name to coordinates
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: `${locationName}, Sri Lanka` }, (results, status) => {
          if (cancelled || !mapRef.current) return;

          // Use geocoded location or fallback to Colombo, Sri Lanka
          const center =
            status === "OK" && results && results[0]
              ? results[0].geometry.location
              : new google.maps.LatLng(6.9271, 79.8612);

          // Create the map
          const map = new google.maps.Map(mapRef.current, {
            center,
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });

          // Add a bus marker to the map
          new google.maps.Marker({
            position: center,
            map,
            title: locationName,
            icon: {
              url: "https://maps.google.com/mapfiles/kml/shapes/bus.png",
              scaledSize: new google.maps.Size(36, 36),
            },
          });
        });
      } catch {
        if (!cancelled) setUseEmbedFallback(true);
      }
    }

    init();
    // Cleanup: prevent state updates if component unmounts
    return () => {
      cancelled = true;
      window.removeEventListener(MAPS_AUTH_FAILURE_EVENT, handleMapsAuthFailure);
    };
  }, [locationName]);

  if (useEmbedFallback) {
    return (
      <iframe
        title={`Map preview for ${locationName}`}
        src={buildEmbedMapUrl(locationName)}
        className="h-40 w-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  return <div ref={mapRef} className="h-40 w-full" />;
}

// API Service Imports - Bus management and configuration endpoints
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

/*
 Type Definitions for Bus Management
 
 These types represent the domain models and UI state for the bus detail page
*/

// Amenity - A feature/facility available on the bus
type Amenity = {
  key: string;   // DB value: "ac", "wifi", "charging_ports", etc.
  name: string;  // Display label
  icon: IconDefinition;
  enabled: boolean;
};

// Driver - Information about the assigned driver
type Driver = {
  name: string;
  id: string;
  phone: string;
  rating: string;
  trips: number;
};

function saveRequestFromAdminDriver(driver: AdminDriver): SaveAdminDriverRequest {
  return {
    firstName: driver.firstName,
    lastName: driver.lastName ?? "",
    email: driver.email,
    password: "",
    phoneNumber: driver.phoneNumber,
    licenseNumber: driver.licenseNumber,
    licenceExpiry: driver.licenceExpiry,
    yearsOfExperience: driver.yearsOfExperience,
    accountNumber: driver.accountNumber ?? "",
    bankName: driver.bankName ?? "",
    status: driver.status,
    isVerified: driver.isVerified,
    isPhoneVerified: driver.isPhoneVerified,
    joinedDate: driver.joinedDate ?? new Date().toISOString().slice(0, 10),
    profilePhoto: driver.profilePhoto,
  };
}

// BusInfo - Detailed information about the bus
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
  returnStartTime: string;
  returnEndTime: string;
  registrationNumber: string;
  routeId: number | null;
  routeName: string;
};

// Dashboard Tab Types - Navigation states for different views
type DashboardTab = "overview" | "schedule" | "revenue";

// BusRevenuePoint - Single data point for revenue chart
type BusRevenuePoint = {
  date: string;
  revenue: number;
};

// SeatLayoutRow - Representation of a single row of seats
type SeatLayoutRow = {
  left: string[];
  right?: string[];
  lastRow?: string[];
};

// SeatPreviewRow - UI representation of seats for layout preview
type SeatPreviewRow =
  | { kind: "bench"; seats: number[] }
  | { kind: "row"; left: number[]; right: number[] };

// LayoutConfig - Configuration for the bus seating layout
type LayoutConfig = {
  rows: number;
  leftSeatsPerRow: number;
  rightSeatsPerRow: number;
  rearRowSeats: number;
  driverLeftSeats: number;
};

// Seat letter labels used for seat naming (e.g., "1A", "1B", "2A", etc.)
const seatLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/*
  Default Seating Layout Configuration
  Standard layout: 10 rows × 2 left + 2 right seats + 5 rear row seats
  This can be customized by administrators
*/
const defaultLayoutConfig: LayoutConfig = {
  rows: 10,
  leftSeatsPerRow: 2,
  rightSeatsPerRow: 2,
  rearRowSeats: 5,
  driverLeftSeats: 0,
};

/*
  Calculates total seat count from a layout configuration
  
  Formula: (rows × (leftSeatsPerRow + rightSeatsPerRow)) + rearRowSeats + driverLeftSeats
  
  @param config The layout configuration
  @returns Total number of seats
*/
const getLayoutSeatCount = (config: LayoutConfig): number =>
  config.rows * (config.leftSeatsPerRow + config.rightSeatsPerRow) +
  config.rearRowSeats +
  config.driverLeftSeats;

/*
  Builds the seat layout rows from a configuration
  
  Generates seat IDs like "1A", "1B", "2A", "2B", etc. for normal rows,
  and handles the rear row separately with different numbering.
  
  @param config The layout configuration
  @returns Array of seat layout rows
*/
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

  // Add rear row if configured
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


/*
  Amenities Configuration
  Available amenities that can be enabled/disabled for a bus
*/
const initialAmenities: Amenity[] = [
  { key: "wifi", name: "Wi-Fi", icon: faWifi, enabled: false },
  { key: "ac", name: "A/C", icon: faSnowflake, enabled: false },
  { key: "charging_ports", name: "Charging", icon: faChargingStation, enabled: false },
  { key: "entertainment", name: "Ent.sys", icon: faTv, enabled: false },
  { key: "gps", name: "GPS", icon: faLocationDot, enabled: false },
  { key: "cctv", name: "CCTV", icon: faVideo, enabled: false },
];

/*
  Revenue Generation - Generates mock revenue data for charts
  
  Creates a 30-day revenue history using a deterministic algorithm
  that factors in weekday patterns, trends, and seasonal variations.
  This is used for the revenue dashboard chart visualization.
  
  @param seed Base value for deterministic random generation
  @returns Array of 30 daily revenue points
 */
const generateBusRevenue = (seed: number): BusRevenuePoint[] => {
  const start = new Date("2026-01-26");
  // Weekday factors: weekends have higher revenue (1.18-1.28x), weekdays lower (0.9-1.12x)
  const weekdayFactor = [0.9, 0.95, 1, 1.05, 1.12, 1.28, 1.18];

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    // Calculate revenue with trend, seasonal, and weekday factors
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

// Chart label indices - Show labels at these revenue data points
const revenueChartLabelIndexes = [0, 5, 10, 15, 20, 25, 29];


function BusDetail() {
  const { busId } = useParams<{ busId: string }>();
  const navigate = useNavigate();

  // ── API Loading and Error States ──────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [busData, setBusData] = useState<BusDetailDto | null>(null);
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([]);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);

  // ── Amenities Management ──────────────────────────────────────
  const [amenities, setAmenities] = useState<Amenity[]>(initialAmenities);
  const [isAmenityModalOpen, setIsAmenityModalOpen] = useState(false);
  const [amenityDraft, setAmenityDraft] = useState<Amenity[]>(initialAmenities);

  // ── Driver Assignment ─────────────────────────────────────────
  const [assignedDriver, setAssignedDriver] = useState<Driver>({
    name: "", id: "", phone: "", rating: "0", trips: 0,
  });
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [driverDraft, setDriverDraft] = useState<Driver>({
    name: "", id: "", phone: "", rating: "0", trips: 0,
  });
  const [adminDriverDraft, setAdminDriverDraft] = useState<SaveAdminDriverRequest | null>(null);
  const [driverDetailsLoading, setDriverDetailsLoading] = useState(false);

  // ── Bus Information ───────────────────────────────────────────
  const [busInfo, setBusInfo] = useState<BusInfo>({
    code: "", seats: "0", brand: "", condition: "", type: "", insuranceExp: "",
    status: "active", startTime: "", endTime: "", returnStartTime: "", returnEndTime: "",
    registrationNumber: "", routeId: null, routeName: "",
  });
  const [isEditBusModalOpen, setIsEditBusModalOpen] = useState(false);
  const [isEditLayoutModalOpen, setIsEditLayoutModalOpen] = useState(false);
  const [busDraft, setBusDraft] = useState<BusInfo>({
    code: "", seats: "0", brand: "", condition: "", type: "", insuranceExp: "",
    status: "active", startTime: "", endTime: "", returnStartTime: "", returnEndTime: "",
    registrationNumber: "", routeId: null, routeName: "",
  });

  // ── Bus Deletion ──────────────────────────────────────────────
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBusDeleted, setIsBusDeleted] = useState(false);

  // ── Tab Navigation and Schedule ───────────────────────────────
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [isFullScheduleVisible, setIsFullScheduleVisible] = useState(false);
  const [isScheduleEditing, setIsScheduleEditing] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState({
    startTime: "",
    endTime: "",
    returnStartTime: "",
    returnEndTime: "",
  });
  const [scheduleFormError, setScheduleFormError] = useState("");

  // ── Form Errors ───────────────────────────────────────────────
  const [driverFormError, setDriverFormError] = useState("");
  const [busFormError, setBusFormError] = useState("");

  // ── Seat Layout Configuration ─────────────────────────────────
  const [layoutConfig, setLayoutConfig] =
    useState<LayoutConfig>(defaultLayoutConfig);
  const [layoutDraftConfig, setLayoutDraftConfig] =
    useState<LayoutConfig>(defaultLayoutConfig);
  const [layoutConfigError, setLayoutConfigError] = useState("");
  const [blockedSeats, setBlockedSeats] = useState<Set<number>>(new Set());

  // ── Load bus data from API ────────────────────────────────────
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

        // Map API response to local BusInfo state
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
          returnStartTime: detail.returnStartTime ?? "",
          returnEndTime: detail.returnEndTime ?? "",
          registrationNumber: detail.registrationNumber ?? "",
          routeId: detail.routeId ?? null,
          routeName: detail.routeName ?? "",
        };
        setBusInfo(info);
        setBusDraft(info);

        // Map amenities — enable those returned from API
        const enabledKeys = (detail.amenities || []).map((a) => a.toLowerCase());
        const mapped = initialAmenities.map((a) => ({
          ...a,
          enabled: enabledKeys.includes(a.key),
        }));
        setAmenities(mapped);
        setAmenityDraft(mapped);

        // Map driver information if assigned
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

  // ── Amenities Handlers ────────────────────────────────────────
  
  /**
   * Opens the amenities edit modal
   * Resets draft from current saved values to discard unsaved changes
   */
  const openAmenityModal = () => {
    setAmenityDraft(amenities);
    setIsAmenityModalOpen(true);
  };

  /**
   * Toggles an amenity's enabled state in the draft
   * 
   * @param amenityKey The key of the amenity to toggle
   */
  const handleAmenityToggle = (amenityKey: string) => {
    setAmenityDraft((current) =>
      current.map((amenity) =>
        amenity.key === amenityKey
          ? { ...amenity, enabled: !amenity.enabled }
          : amenity,
      ),
    );
  };

  /**
   * Builds a consistent save request from current bus state
   * 
   * This helper allows applying partial overrides to create the request
   * without modifying the component state first. Useful for saving specific
   * fields like amenities, driver, etc.
   * 
   * @param overrides Optional fields to override in the request
   * @returns Complete SaveBusRequest object
   */
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
    returnStartTime: string | null;
    returnEndTime: string | null;
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
    returnStartTime: overrides.returnStartTime !== undefined ? overrides.returnStartTime : (busInfo.returnStartTime || null),
    returnEndTime: overrides.returnEndTime !== undefined ? overrides.returnEndTime : (busInfo.returnEndTime || null),
    registrationNumber: overrides.registrationNumber ?? busInfo.registrationNumber,
    insuranceExpDate: overrides.insuranceExpDate ?? busInfo.insuranceExp,
    driverId: overrides.driverId !== undefined ? overrides.driverId : (busData?.driverId ?? null),
    routeId: overrides.routeId !== undefined ? overrides.routeId : (busInfo.routeId ?? null),
  });

  /**
   * Saves amenities to the API and updates state
   */
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

  // ── Driver Assignment Handlers ────────────────────────────────

  const loadDriverDetails = (driverId: string) => {
    if (!driverId) {
      setAdminDriverDraft(null);
      return;
    }
    setDriverDetailsLoading(true);
    setAdminDriverDraft(null);
    fetchAdminDriver(Number(driverId))
      .then((driver) => setAdminDriverDraft(saveRequestFromAdminDriver(driver)))
      .catch((error: unknown) => {
        setAdminDriverDraft(null);
        setDriverFormError(error instanceof Error ? error.message : "Could not load driver details.");
      })
      .finally(() => setDriverDetailsLoading(false));
  };

  /**
   * Opens the driver assignment modal
   * Resets draft from current saved values
   */
  const openDriverModal = () => {
    setDriverDraft(assignedDriver);
    setAdminDriverDraft(null);
    setDriverFormError("");
    setIsDriverModalOpen(true);
    loadDriverDetails(assignedDriver.id);
  };

  /**
   * Handles driver selection from dropdown
   * Updates the draft with selected driver's information
   * 
   * @param driverId The ID of the selected driver
   */
  const handleDriverSelect = (driverId: string) => {
    const selected = driverOptions.find((d) => String(d.driverId) === driverId);
    if (selected) {
      setDriverDraft((prev) => ({
        ...prev,
        name: selected.name,
        id: String(selected.driverId),
      }));
      loadDriverDetails(String(selected.driverId));
    } else {
      setDriverDraft((prev) => ({ ...prev, name: "", id: "" }));
      setAdminDriverDraft(null);
    }
    setDriverFormError("");
  };

  /**
   * Saves driver assignment to API
   * Validates that a driver is selected before saving
   */
  const handleSaveDriver = () => {
    if (!driverDraft.id) {
      setDriverFormError("Please select a driver.");
      return;
    }
    if (driverDetailsLoading) {
      setDriverFormError("Please wait for the selected driver's details to finish loading.");
      return;
    }
    if (!adminDriverDraft) {
      setDriverFormError("The selected driver's details could not be loaded. Please select the driver again.");
      return;
    }

    const validationError = validateAdminDriverRequest(adminDriverDraft, false);
    if (validationError) {
      setDriverFormError(`${validationError.field}: ${validationError.message}`);
      return;
    }

    setDriverFormError("");
    setSaving(true);
    const numericId = Number(busId);
    const saveDriverDetails = adminDriverDraft
      ? updateAdminDriver(Number(driverDraft.id), adminDriverDraft)
      : Promise.resolve(null);
    saveDriverDetails
      .then((updatedDriver) => updateBus(numericId, buildSaveRequest({ driverId: Number(driverDraft.id) || null }))
        .then(() => updatedDriver))
      .then((updatedDriver) => {
        const updatedName = updatedDriver
          ? `${updatedDriver.firstName} ${updatedDriver.lastName ?? ""}`.trim()
          : driverDraft.name;
        setAssignedDriver({
          ...driverDraft,
          name: updatedName,
          phone: updatedDriver?.phoneNumber ?? driverDraft.phone,
          rating: updatedDriver?.averageRating?.toString() ?? driverDraft.rating,
          trips: updatedDriver?.driverTrips ?? driverDraft.trips,
        });
        if (busData) {
          setBusData({
            ...busData,
            driverId: Number(driverDraft.id),
            driverName: updatedName,
            driverPhone: updatedDriver?.phoneNumber ?? driverDraft.phone,
          });
        }
        setIsDriverModalOpen(false);
      })
      .catch((error: unknown) => setDriverFormError(error instanceof Error ? error.message : "Could not save driver changes."))
      .finally(() => setSaving(false));
  };

  // ── Bus Information Handlers ──────────────────────────────────

  /**
   * Opens the bus edit modal
   * Loads current bus info into draft before opening
   */
  const openEditBusModal = () => {
    setBusDraft(busInfo);
    setBusFormError("");
    setIsEditBusModalOpen(true);
  };

  /**
   * Saves bus information changes to API
   * Validates bus number format, seat count, and required fields
   */
  const handleSaveBus = () => {
    const normalizedCode = busDraft.code.trim();
    const normalizedSeats = busDraft.seats.trim();
    const normalizedBrand = busDraft.brand.trim();

    // Validate bus number format (e.g., ND-1151)
    if (!/^[A-Za-z]{2,4}-\d{2,4}$/.test(normalizedCode)) {
      setBusFormError("Bus Number must follow a format like ND-1151.");
      return;
    }

    // Validate seat count is positive integer
    if (!/^\d+$/.test(normalizedSeats) || Number(normalizedSeats) <= 0) {
      setBusFormError("Seats must be a positive whole number.");
      return;
    }

    // Validate required fields
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
      returnStartTime: busDraft.returnStartTime || null,
      returnEndTime: busDraft.returnEndTime || null,
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

  // ── Seat Layout Handlers ─────────────────────────────────────

  /**
   * Opens the seat layout edit modal
   * Calculates normalized layout based on seat capacity
   */
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

  // ── Computed Values for Seat Layout ───────────────────────────

  /**
   * Calculate total seats in current applied layout
   */
  const appliedLayoutSeatCount = useMemo(
    () => getLayoutSeatCount(layoutConfig),
    [layoutConfig],
  );

  /**
   * Calculate total seats in draft layout being edited
   */
  const draftLayoutSeatCount = useMemo(
    () => getLayoutSeatCount(layoutDraftConfig),
    [layoutDraftConfig],
  );

  // Number of seats marked as blocked/unavailable
  const blockedSeatCount = blockedSeats.size;

  /**
   * Calculate the optimal preview width based on seat configuration
   */
  const previewMaxWidth = useMemo(() => {
    const cols = layoutConfig.leftSeatsPerRow + layoutConfig.rightSeatsPerRow;
    const base = cols * 60 + 120;
    return Math.max(280, Math.min(560, base));
  }, [layoutConfig.leftSeatsPerRow, layoutConfig.rightSeatsPerRow]);

  /**
   * Generate seat layout rows for the applied configuration
   */
  const layoutRows = useMemo(() => {
    return buildSeatLayoutRows(layoutConfig);
  }, [layoutConfig]);

  /**
   * Build seat preview data for rendering
   * Assigns sequential seat numbers and organizes them by row type
   */
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

  /**
   * Updates a specific layout configuration field in the draft
   * 
   * @param field The configuration field to update
   * @param value The new value
   */
  const updateLayoutDraft = (field: keyof LayoutConfig, value: number) => {
    setLayoutDraftConfig((current) => ({
      ...current,
      [field]: value,
    }));
  };

  /**
   * Applies the layout configuration with validation
   * 
   * Normalizes values to safe ranges and validates total seat count (10-80 seats).
   * Updates seat capacity in bus draft if layout is valid.
   */
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

    // Validate total seat count
    const totalSeats = getLayoutSeatCount(nextConfig);
    if (totalSeats < 10 || totalSeats > 80) {
      setLayoutConfigError("Total seats should be between 10 and 80.");
      return;
    }

    // Apply the layout and update bus draft
    setLayoutConfig(nextConfig);
    setLayoutDraftConfig(nextConfig);
    setLayoutConfigError("");
    setBusDraft((current) => ({ ...current, seats: String(totalSeats) }));
    
    // Clean up blocked seats that exceed new total
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

  /**
   * Toggles a seat's blocked status
   * Blocked seats cannot be booked by passengers
   * 
   * @param seatId The seat number to toggle
   */
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

  /**
   * Renders a single seat in the layout preview
   * Shows blocked status visually and allows toggling
   * 
   * @param seatId The seat number to render
   * @returns Rendered seat button element
   */
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
            : "border-[#d6dbe6] bg-[#e5e7eb] text-[#374151] hover:bg-[#dce0e7]",
        ].join(" ")}
      >
        {seatId}
      </button>
    );
  };

  // ── Bus Status & Deletion Handlers ───────────────────────────

  /**
   * Toggles bus status between active and maintenance
   * Other statuses (inactive) are not toggled by this function
   */
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

  /**
   * Deletes the bus from the system
   * Shows a success state instead of navigating away
   */
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

  // ── Schedule Computation ─────────────────────────────────────

  /**
   * Builds schedule items for display
   * 
   * Generates upcoming trips for the next 4 days based on bus route and schedule.
   * Each item includes the departure time, route, driver, and booked seat count.
   */
  const scheduleItems = useMemo(() => {
    const capacity = busInfo.seats ? Number(busInfo.seats) : 0;
    const routeLabel = busInfo.routeName || "Unassigned Route";
    const driverLabel = assignedDriver.name || "Unassigned";
    const today = new Date();

    /**
     * Formats a date as "Today", "Tomorrow", or "Weekday, DD Mon"
     * 
     * @param daysFromNow Number of days in the future (0 = today)
     * @returns Formatted day label
     */
    const formatDay = (daysFromNow: number): string => {
      if (daysFromNow === 0) return "Today";
      if (daysFromNow === 1) return "Tomorrow";
      const d = new Date(today);
      d.setDate(today.getDate() + daysFromNow);
      return d.toLocaleDateString("en-US", { weekday: "long", day: "2-digit", month: "short" });
    };

    /**
     * Converts 24-hour time format to 12-hour with AM/PM
     * Handles null/invalid times gracefully
     * 
     * @param timeStr Time string in "HH:mm:ss" or "HH:mm" format
     * @returns Formatted time in "hh:mm AM/PM" format
     */
    const fmt12 = (timeStr: string | null): string => {
      if (!timeStr) return "—";
      const [h, m] = timeStr.split(":").map(Number);
      const suffix = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
    };

    const forwardTime = fmt12(busInfo.startTime);
    const returnTime = fmt12(busInfo.returnStartTime);

    const items = Array.from({ length: 4 }, (_, i) => {
      const day = formatDay(i);
      const dayItems: Array<{
        time: string;
        route: string;
        driver: string;
        bookedText: string;
        highlighted: boolean;
      }> = [];

      if (busInfo.startTime) {
        dayItems.push({
          time: `${day}, ${forwardTime}`,
          route: `${routeLabel} (Forward)`,
          driver: driverLabel,
          bookedText: `${Math.floor(Math.random() * capacity) || 0}/${capacity} Booked`,
          highlighted: i === 0,
        });
      }

      if (busInfo.returnStartTime) {
        dayItems.push({
          time: `${day}, ${returnTime}`,
          route: `${routeLabel} (Return)`,
          driver: driverLabel,
          bookedText: `${Math.floor(Math.random() * capacity) || 0}/${capacity} Booked`,
          highlighted: false,
        });
      }

      return dayItems;
    }).flat();

    return items.length > 0 ? items : [{
      time: "No schedule",
      route: routeLabel,
      driver: driverLabel,
      bookedText: `0/${capacity} Booked`,
      highlighted: true,
    }];
  }, [busInfo.startTime, busInfo.returnStartTime, busInfo.routeName, busInfo.seats, assignedDriver.name]);

  /**
   * Determine which schedule items to show based on view state
   * Limited view shows first 2 items, full view shows all 4
   */
  const visibleScheduleItems = isFullScheduleVisible
    ? scheduleItems
    : scheduleItems.slice(0, 2);

  // ── Revenue Analytics Computation ────────────────────────────

  /**
   * Generate 30 days of revenue data for the chart
   */
  const revenuePoints = useMemo(
    () => generateBusRevenue(busData?.busId ?? 0),
    [busData],
  );

  /**
   * Calculate total revenue over last 30 days
   */
  const totalRevenueLast30Days = useMemo(
    () => revenuePoints.reduce((sum, point) => sum + point.revenue, 0),
    [revenuePoints],
  );

  /**
   * Calculate average revenue per day
   */
  const averageRevenuePerDay = useMemo(
    () =>
      Math.round(totalRevenueLast30Days / Math.max(revenuePoints.length, 1)),
    [totalRevenueLast30Days, revenuePoints.length],
  );

  /**
   * Extract chart label data at specific intervals
   * Only shows labels for selected data points to avoid clutter
   */
  const revenueChartLabels = useMemo(
    () =>
      revenueChartLabelIndexes
        .map((index) => ({ index, point: revenuePoints[index] }))
        .filter((item): item is { index: number; point: BusRevenuePoint } =>
          Boolean(item.point),
        ),
    [revenuePoints],
  );

  /**
   * Formats an ISO date string to "Mon DD" format
   * 
   * @param isoDate Date in ISO string format
   * @returns Formatted date string
   */
  const formatShortDate = (isoDate: string) =>
    new Date(isoDate).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    });

  /**
   * Formats currency amount to compact format (e.g., "Rs.50k")
   * 
   * @param amount The amount in smallest currency unit
   * @returns Formatted currency string
   */
  const formatCurrencyShort = (amount: number) =>
    `Rs.${Math.round(amount / 1000)}k`;

  // ── SVG Chart Calculations ───────────────────────────────────
  // These calculations position and scale the revenue chart correctly

  const chartHeight = 300;
  const chartWidth = 760;
  const chartPadding = { top: 24, right: 26, bottom: 44, left: 64 };
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;

  // Find Y-axis range with padding
  const minRevenue = Math.min(...revenuePoints.map((point) => point.revenue));
  const maxRevenue = Math.max(...revenuePoints.map((point) => point.revenue));
  const yMin = Math.max(0, Math.floor((minRevenue - 800) / 500) * 500);
  const yMax = Math.ceil((maxRevenue + 800) / 500) * 500;
  const yRange = Math.max(1, yMax - yMin);

  // Generate Y-axis tick labels
  const yTicks = Array.from({ length: 5 }, (_, index) =>
    Math.round(yMin + (index * yRange) / 4),
  );

  /**
   * Convert data index to X pixel coordinate
   */
  const getX = (index: number) =>
    chartPadding.left +
    (index / Math.max(revenuePoints.length - 1, 1)) * plotWidth;

  /**
   * Convert revenue value to Y pixel coordinate
   */
  const getY = (value: number) =>
    chartPadding.top + ((yMax - value) / yRange) * plotHeight;

  /**
   * Generate points for the revenue line path
   */
  const revenueLinePoints = revenuePoints
    .map((point, index) => `${getX(index)},${getY(point.revenue)}`)
    .join(" ");

  /**
   * Generate points for the filled area under the revenue curve
   * Includes bottom edge to create a closed path
   */
  const revenueAreaPoints = [
    `${chartPadding.left},${chartPadding.top + plotHeight}`,
    ...revenuePoints.map(
      (point, index) => `${getX(index)},${getY(point.revenue)}`,
    ),
    `${chartPadding.left + plotWidth},${chartPadding.top + plotHeight}`,
  ].join(" ");

  // ── Main Component Render ───────────────────────────────────

  return (
    <>
      {/* Loading State - Show spinner while fetching initial data */}
      {loading ? (
        <div className="mx-auto max-w-7xl space-y-4 py-12 text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-[#2642a6]" />
          <p className="text-sm text-[#64748b]">Loading bus details...</p>
        </div>
      ) : apiError && !busData ? (
        /* Error State - Show error message and back button */
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
      /* Success State - Display bus details and management UI */
      <div className="mx-auto max-w-7xl space-y-4">
            {/* Back Navigation */}
            <button
              type="button"
              onClick={() => navigate('/dashboard/buses')}
              className="flex items-center gap-2 text-sm text-[#202535] transition duration-200 hover:-translate-x-0.5"
              aria-label="Go back"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span className="font-semibold">Back</span>
            </button>

            {/* Header Section - Bus image, status badge, and action buttons */}
            <section
              className="dashboard-card animate-dash-in rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] p-5 shadow-sm"
              style={{ animationDelay: "80ms" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Bus Image and Basic Info */}
                <div className="flex items-center gap-4">
                  {getBusImage(busInfo.brand, amenities.filter(a => a.enabled).map(a => a.key)) ? (
                    <img
                      src={getBusImage(busInfo.brand, amenities.filter(a => a.enabled).map(a => a.key))!}
                      alt={busInfo.brand}
                      className="h-28 w-44 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-44 shrink-0 items-center justify-center rounded-lg bg-[#e8ecf4]">
                      <FontAwesomeIcon icon={faBus} className="text-4xl text-[#6b7a99]" />
                    </div>
                  )}
                  <div>
                    {/* Status Badge - Shows active/maintenance/inactive with indicator dot */}
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

                {/* Action Buttons - Edit, Maintenance Toggle, Delete */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={openEditBusModal}
                    disabled={isBusDeleted}
                    className="rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-bold text-[#2f394d] transition duration-200 hover:-translate-y-0.5"
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

            {/* Deleted State Alert - Shows when bus has been deleted */}
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
                  className="mt-4 rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold text-[#2f394d] transition duration-200 hover:bg-[#f2f5fd]"
                >
                  Restore Bus
                </button>
              </section>
            ) : (
              /* Main Content Grid - 4 information cards displayed in a responsive layout */
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1.2fr_1.2fr_1fr]">
                {/* Card 1: Vehicle Specifications */}
                {/* Displays key bus details like brand, condition, type, registration, and schedule info */}
                <article
                  className="dashboard-card animate-dash-in rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] p-4 shadow-sm"
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
                    {/* Render each spec as a key-value pair with divider */}
                    {[
                      ["Brand", busInfo.brand],
                      ["Condition", busInfo.condition ? busInfo.condition.replace(/_/g, " ") : "—"],
                      ["Type", busInfo.type ? busInfo.type.replace(/_/g, " ") : "—"],
                      ["Registration", busInfo.registrationNumber || "—"],
                      ["Route", busInfo.routeName || "Not assigned"],
                      ["Start Time", busInfo.startTime || "—"],
                      ["End Time", busInfo.endTime || "—"],
                      ["Return Start", busInfo.returnStartTime || "—"],
                      ["Return End", busInfo.returnEndTime || "—"],
                      ["Insurance Exp", busInfo.insuranceExp || "—"],
                    ].map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-start justify-between gap-3 border-b border-[#f1f5f9] pb-1.5 last:border-0 last:pb-0"
                      >
                        <span className="shrink-0 text-[#7b8394]">{key}</span>
                        <span className="min-w-0 break-words text-right font-semibold text-[#2c3448] capitalize">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>

                {/* Card 2: Assigned Driver Information */}
                {/* Shows driver profile, ID, rating, and provides quick contact options */}
                <article
                  className="dashboard-card animate-dash-in rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] p-4 shadow-sm"
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
                  {/* Quick contact buttons for phone and messaging */}
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm font-semibold text-[#2f394d] transition duration-200 hover:bg-[#f0f3fa]"
                    >
                      <FontAwesomeIcon icon={faPhone} className="mr-2" />
                      {assignedDriver.phone}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm font-semibold text-[#2f394d] transition duration-200 hover:bg-[#f0f3fa]"
                    >
                      <FontAwesomeIcon icon={faComment} className="mr-2" />
                      Message
                    </button>
                  </div>
                </article>

                {/* Card 3: Route Location Map */}
                {/* Shows the starting location of the bus route with embedded map visualization */}
                <article
                  className="dashboard-card animate-dash-in overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] shadow-sm"
                  style={{ animationDelay: "210ms" }}
                >
                  <BusLocationMap locationName={busInfo.routeName ? busInfo.routeName.split(" to ")[0] : "Colombo"} />
                  <div className="flex items-end justify-between p-4">
                    <div>
                      <p className="text-sm font-semibold text-[#8a93a4]">
                        Current Location
                      </p>
                      <p className="text-sm font-bold text-[#232c3f]">
                        {busInfo.routeName ? busInfo.routeName.split(" to ")[0] : "Not assigned"}
                      </p>
                      <p className="text-sm text-[#8a93a4]">
                        Start location
                      </p>
                    </div>
                    <FontAwesomeIcon
                      icon={faLocationDot}
                      className="pb-2 text-xl text-[#263247]"
                    />
                  </div>
                </article>

                {/* Card 4: Bus Amenities */}
                {/* Lists available amenities with enabled/disabled visual indicator */}
                <article
                  className="dashboard-card animate-dash-in rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] p-4 shadow-sm"
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
                    {/* Each amenity shown as a badge with icon, enabled amenities highlighted */}
                    {amenities.map((amenity) => (
                      <div
                        key={amenity.key}
                        className={[
                          "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition duration-200 hover:-translate-y-0.5",
                          amenity.enabled
                            ? "border-[#e5e7eb] bg-[#f2f4f8] text-[#3a4255]"
                            : "border-[#f1f5f9] bg-[#f7f8fb] text-[#9fa7b7]",
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
              /* Tab Section - Overview, Schedule, Revenue tabs with dynamic content switching */
              <section
                className="dashboard-card animate-dash-in overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] shadow-sm"
                style={{ animationDelay: "300ms" }}
              >
                {/* Tab Navigation - Three main tabs for managing bus information */}
                <div className="flex gap-6 border-b border-[#e5e7eb] px-5 pt-3">
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

                {/* Tab Content: Overview Tab */}
                {/* Shows revenue chart and upcoming schedule preview */}
                {activeTab === "overview" ? (
                  <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[2fr_1fr]">
                    {/* Revenue Trends Chart */}
                    {/* SVG-based area and line chart showing 30-day revenue with customizable Y-axis scaling */}
                    <article className="dashboard-card rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] p-5">
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
                          className="rounded-md border border-[#d6dbe6] bg-white px-3 py-1 text-sm text-[#3d4558] transition duration-200 hover:bg-[#f2f5fd]"
                        >
                          Last 30 Days
                        </button>
                      </div>

                      {/* SVG Revenue Chart - Renders area fill and line path with axis labels */}
                      <svg
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                        className="h-[300px] w-full rounded-lg bg-[#f9fafd]"
                        role="img"
                        aria-label="30-day revenue trend for the selected bus"
                      >
                        {/* Y-axis vertical line */}
                        <line
                          x1={chartPadding.left}
                          y1={chartPadding.top}
                          x2={chartPadding.left}
                          y2={chartPadding.top + plotHeight}
                          stroke="#d8dcea"
                        />
                        {/* X-axis horizontal line */}
                        <line
                          x1={chartPadding.left}
                          y1={chartPadding.top + plotHeight}
                          x2={chartPadding.left + plotWidth}
                          y2={chartPadding.top + plotHeight}
                          stroke="#d8dcea"
                        />

                        {/* Y-axis grid lines at each tick */}
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

                        {/* Semi-transparent area fill under the revenue line */}
                        <polygon
                          points={revenueAreaPoints}
                          fill="rgba(79,125,247,0.14)"
                        />
                        {/* Revenue line path with smooth curves */}
                        <polyline
                          fill="none"
                          stroke="#3258d6"
                          strokeWidth="3"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          points={revenueLinePoints}
                        />

                        {/* Data point markers - circles at regular intervals and endpoints */}
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

                        {/* Y-axis labels - Revenue amounts on the left */}
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

                        {/* X-axis labels - Dates at selected intervals */}
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

                      {/* Revenue Summary Statistics */}
                      <div className="mt-2 grid grid-cols-2 gap-4 border-t border-[#f1f5f9] pt-3 text-center">
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

                    {/* Upcoming Schedule Preview */}
                    {/* Shows next scheduled trips with passenger booking status */}
                    <article className="dashboard-card rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] p-5">
                      <h3 className="text-sm font-bold text-[#1f2737]">
                        Upcoming Schedule
                      </h3>
                      <div className="mt-4 space-y-4">
                        {/* Schedule items - Today's trip highlighted in blue */}
                        {visibleScheduleItems.map((item) => (
                          <div
                            key={`${item.time}-${item.route}`}
                            className={[
                              "border-l-2 pl-4",
                              item.highlighted ? "border-[#2642a6]" : "border-[#d6dbe6]",
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
                      {/* Button to switch to full schedule tab and expand view */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("schedule");
                          setIsFullScheduleVisible(true);
                        }}
                        className="mt-4 w-full rounded-lg border border-[#d6dbe6] bg-[#f5f7fb] py-2 text-sm font-semibold text-[#495162] transition duration-200 hover:bg-[#eef2fa]"
                      >
                        View Full Schedule
                      </button>
                    </article>
                  </div>
                ) : null}

                {activeTab === "schedule" ? (
                  <div className="p-4 space-y-4">
                    {/* Schedule edit form */}
                    {isScheduleEditing ? (
                      <article className="dashboard-card rounded-xl border border-[#d6dbe6] bg-[#f7f8fc] p-5">
                        <h3 className="mb-4 text-sm font-bold text-[#1f2737]">Edit Schedule</h3>
                        {scheduleFormError && (
                          <p className="mb-3 rounded-lg bg-[#fef2f2] px-4 py-2 text-sm font-semibold text-[#dc2626]">
                            {scheduleFormError}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-[#45516b]">Forward Departure</label>
                            <input
                              type="time"
                              value={scheduleDraft.startTime}
                              onChange={(e) => setScheduleDraft((p) => ({ ...p, startTime: e.target.value }))}
                              className="h-10 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 text-sm text-[#273246] outline-none focus:border-[#2642a6]"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-[#45516b]">Forward Arrival</label>
                            <input
                              type="time"
                              value={scheduleDraft.endTime}
                              onChange={(e) => setScheduleDraft((p) => ({ ...p, endTime: e.target.value }))}
                              className="h-10 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 text-sm text-[#273246] outline-none focus:border-[#2642a6]"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-[#45516b]">Return Departure</label>
                            <input
                              type="time"
                              value={scheduleDraft.returnStartTime}
                              onChange={(e) => setScheduleDraft((p) => ({ ...p, returnStartTime: e.target.value }))}
                              className="h-10 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 text-sm text-[#273246] outline-none focus:border-[#2642a6]"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-[#45516b]">Return Arrival</label>
                            <input
                              type="time"
                              value={scheduleDraft.returnEndTime}
                              onChange={(e) => setScheduleDraft((p) => ({ ...p, returnEndTime: e.target.value }))}
                              className="h-10 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 text-sm text-[#273246] outline-none focus:border-[#2642a6]"
                            />
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => { setIsScheduleEditing(false); setScheduleFormError(""); }}
                            className="rounded-lg border border-[#d6dbe6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#e9edf7]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              if (!scheduleDraft.startTime) {
                                setScheduleFormError("Departure time is required.");
                                return;
                              }
                              setScheduleFormError("");
                              setSaving(true);
                              const numericId = Number(busId);
                              updateBus(numericId, buildSaveRequest({
                                startTime: scheduleDraft.startTime || null,
                                endTime: scheduleDraft.endTime || null,
                                returnStartTime: scheduleDraft.returnStartTime || null,
                                returnEndTime: scheduleDraft.returnEndTime || null,
                              }))
                                .then(() => {
                                  setBusInfo((p) => ({
                                    ...p,
                                    startTime: scheduleDraft.startTime,
                                    endTime: scheduleDraft.endTime,
                                    returnStartTime: scheduleDraft.returnStartTime,
                                    returnEndTime: scheduleDraft.returnEndTime,
                                  }));
                                  setIsScheduleEditing(false);
                                })
                                .catch((e: Error) => setScheduleFormError(e.message))
                                .finally(() => setSaving(false));
                            }}
                            className="rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-bold text-white transition duration-200 hover:bg-[#203b96] disabled:opacity-60"
                          >
                            {saving ? "Saving…" : "Save Schedule"}
                          </button>
                        </div>
                      </article>
                    ) : null}

                    <article className="dashboard-card rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[#1f2737]">
                          Bus Schedule
                        </h3>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setScheduleDraft({
                                startTime: busInfo.startTime,
                                endTime: busInfo.endTime,
                                returnStartTime: busInfo.returnStartTime,
                                returnEndTime: busInfo.returnEndTime,
                              });
                              setScheduleFormError("");
                              setIsScheduleEditing((v) => !v);
                            }}
                            className="rounded-md border border-[#d6dbe6] bg-white px-3 py-1 text-sm font-semibold text-[#2642a6] transition duration-200 hover:bg-[#f2f5fd]"
                          >
                            {isScheduleEditing ? "Cancel Edit" : "Edit Schedule"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsFullScheduleVisible((value) => !value)}
                            className="rounded-md border border-[#d6dbe6] bg-white px-3 py-1 text-sm font-semibold text-[#3d4558] transition duration-200 hover:bg-[#f2f5fd]"
                          >
                            {isFullScheduleVisible ? "Show Less" : "View Full Schedule"}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {visibleScheduleItems.map((item) => (
                          <div
                            key={`${item.time}-${item.route}`}
                            className={
                              item.highlighted
                                ? "rounded-lg border-l-4 border-[#2642a6] bg-[#f3f6ff] px-4 py-3"
                                : "rounded-lg border-l-4 border-[#d6dbe6] bg-[#f8f9fd] px-4 py-3"
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
                    <article className="dashboard-card rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] p-5">
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
                          className="rounded-md border border-[#d6dbe6] bg-white px-3 py-1 text-sm text-[#3d4558] transition duration-200 hover:bg-[#f2f5fd]"
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

                      <div className="mt-2 grid grid-cols-2 gap-4 border-t border-[#f1f5f9] pt-3 text-center">
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
          <div className="w-full max-w-xl rounded-2xl border border-[#d6dbe6] bg-[#f7f8fc] shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
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
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-[#e5e7eb] bg-[#f9fafd] px-4 py-3"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-[#2f394d]">
                    <FontAwesomeIcon icon={amenity.icon} className="text-xs" />
                    {amenity.name}
                  </span>
                  <input
                    type="checkbox"
                    checked={amenity.enabled}
                    onChange={() => handleAmenityToggle(amenity.key)}
                    className="h-4 w-4 rounded border-[#d6dbe6] text-[#2642a6] focus:ring-[#2642a6]"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#e5e7eb] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsAmenityModalOpen(false)}
                className="rounded-lg border border-[#d6dbe6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#e9edf7]"
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
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[#101426]/45 p-3 sm:items-center sm:p-4">
          <div className="my-2 flex max-h-[calc(100vh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#d6dbe6] bg-[#f7f8fc] shadow-[0_28px_80px_rgba(17,27,52,0.32)] sm:my-6 sm:max-h-[calc(100vh-3rem)]">
            <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-4 py-4 sm:px-6">
              <div className="min-w-0 pr-3">
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
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[#6d778e] transition duration-200 hover:bg-[#eceff7] hover:text-[#1f2737]"
                aria-label="Close driver editor"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 gap-4 px-4 py-5 sm:px-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="driver-select" className="mb-1 block text-sm font-semibold text-[#45516b]">Select Driver</label>
                <select id="driver-select" value={driverDraft.id}
                  onChange={(e) => handleDriverSelect(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none">
                  <option value="">-- Select a driver --</option>
                  {driverOptions.map((d) => (
                    <option key={d.driverId} value={d.driverId}>{d.name} (ID: {d.driverId})</option>
                  ))}
                </select>
              </div>
              {driverDraft.id ? (
                driverDetailsLoading ? (
                  <div className="md:col-span-2 py-5 text-center text-sm text-[#64748b]"><FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />Loading driver details...</div>
                ) : adminDriverDraft ? (
                  <>
                    <label className="text-sm font-semibold text-[#45516b]">First name<input value={adminDriverDraft.firstName} onChange={(event) => setAdminDriverDraft({ ...adminDriverDraft, firstName: event.target.value })} className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2642a6]" /></label>
                    <label className="text-sm font-semibold text-[#45516b]">Last name<input value={adminDriverDraft.lastName} onChange={(event) => setAdminDriverDraft({ ...adminDriverDraft, lastName: event.target.value })} className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2642a6]" /></label>
                    <label className="text-sm font-semibold text-[#45516b]">Email<input type="email" value={adminDriverDraft.email} onChange={(event) => setAdminDriverDraft({ ...adminDriverDraft, email: event.target.value })} className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2642a6]" /></label>
                    <label className="text-sm font-semibold text-[#45516b]">Phone number<input inputMode="numeric" maxLength={10} value={adminDriverDraft.phoneNumber} onChange={(event) => setAdminDriverDraft({ ...adminDriverDraft, phoneNumber: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="0XXXXXXXXX" className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2642a6]" /></label>
                    <label className="text-sm font-semibold text-[#45516b]">License number<input maxLength={8} value={adminDriverDraft.licenseNumber} onChange={(event) => setAdminDriverDraft({ ...adminDriverDraft, licenseNumber: event.target.value.toUpperCase().replace(/[^B0-9]/g, '').slice(0, 8) })} placeholder="B1234567" className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2642a6]" /></label>
                    <label className="text-sm font-semibold text-[#45516b]">License expiry<input type="date" value={adminDriverDraft.licenceExpiry} onChange={(event) => setAdminDriverDraft({ ...adminDriverDraft, licenceExpiry: event.target.value })} className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2642a6]" /></label>
                    <label className="text-sm font-semibold text-[#45516b]">Years of experience<input type="number" min={0} value={adminDriverDraft.yearsOfExperience} onChange={(event) => setAdminDriverDraft({ ...adminDriverDraft, yearsOfExperience: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2642a6]" /></label>
                    <label className="text-sm font-semibold text-[#45516b]">Status<select value={adminDriverDraft.status} onChange={(event) => setAdminDriverDraft({ ...adminDriverDraft, status: event.target.value })} className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2642a6]"><option value="active">Active</option><option value="on_leave">On leave</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select></label>
                    <label className="text-sm font-semibold text-[#45516b]">Bank account number<input value={adminDriverDraft.accountNumber} onChange={(event) => setAdminDriverDraft({ ...adminDriverDraft, accountNumber: event.target.value })} className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2642a6]" /></label>
                    <label className="text-sm font-semibold text-[#45516b]">Bank name<input value={adminDriverDraft.bankName} onChange={(event) => setAdminDriverDraft({ ...adminDriverDraft, bankName: event.target.value })} className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2642a6]" /></label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#45516b]"><input type="checkbox" checked={adminDriverDraft.isVerified} onChange={(event) => setAdminDriverDraft({ ...adminDriverDraft, isVerified: event.target.checked })} className="h-4 w-4 accent-[#2642a6]" /> License verified</label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#45516b]"><input type="checkbox" checked={adminDriverDraft.isPhoneVerified} onChange={(event) => setAdminDriverDraft({ ...adminDriverDraft, isPhoneVerified: event.target.checked })} className="h-4 w-4 accent-[#2642a6]" /> Phone verified</label>
                  </>
                ) : null
              ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[#e5e7eb] px-4 py-4 sm:px-6">
              {driverFormError ? (
                <p className="mr-auto min-w-0 basis-full text-sm font-semibold text-[#d14343] sm:basis-auto">
                  {driverFormError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setDriverFormError("");
                  setIsDriverModalOpen(false);
                }}
                className="rounded-lg border border-[#d6dbe6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#e9edf7]"
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
          <div className="w-full max-w-xl rounded-2xl border border-[#d6dbe6] bg-[#f7f8fc] shadow-[0_28px_80px_rgba(17,27,52,0.32)]">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
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
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* Registration Number */}
              <div>
                <label htmlFor="bus-reg" className="mb-1 block text-sm font-semibold text-[#45516b]">Registration Number</label>
                <input id="bus-reg" value={busDraft.registrationNumber}
                  onChange={(e) => setBusDraft((p) => ({ ...p, registrationNumber: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* Seats */}
              <div>
                <label htmlFor="bus-seats" className="mb-1 block text-sm font-semibold text-[#45516b]">Seats</label>
                <input id="bus-seats" value={busDraft.seats}
                  onChange={(e) => setBusDraft((p) => ({ ...p, seats: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* Brand */}
              <div>
                <label htmlFor="bus-brand" className="mb-1 block text-sm font-semibold text-[#45516b]">Brand</label>
                <input id="bus-brand" value={busDraft.brand}
                  onChange={(e) => setBusDraft((p) => ({ ...p, brand: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* Bus Condition — dropdown with DB ENUM values */}
              <div>
                <label htmlFor="bus-condition" className="mb-1 block text-sm font-semibold text-[#45516b]">Condition</label>
                <select id="bus-condition" value={busDraft.condition}
                  onChange={(e) => setBusDraft((p) => ({ ...p, condition: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none">
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
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none">
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
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none">
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
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none">
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
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* End Time */}
              <div>
                <label htmlFor="bus-end-time" className="mb-1 block text-sm font-semibold text-[#45516b]">End Time</label>
                <input id="bus-end-time" type="time" value={busDraft.endTime}
                  onChange={(e) => setBusDraft((p) => ({ ...p, endTime: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* Return Start Time */}
              <div>
                <label htmlFor="bus-return-start-time" className="mb-1 block text-sm font-semibold text-[#45516b]">Return Start Time</label>
                <input id="bus-return-start-time" type="time" value={busDraft.returnStartTime}
                  onChange={(e) => setBusDraft((p) => ({ ...p, returnStartTime: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* Return End Time */}
              <div>
                <label htmlFor="bus-return-end-time" className="mb-1 block text-sm font-semibold text-[#45516b]">Return End Time</label>
                <input id="bus-return-end-time" type="time" value={busDraft.returnEndTime}
                  onChange={(e) => setBusDraft((p) => ({ ...p, returnEndTime: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
              {/* Insurance Expiry Date */}
              <div>
                <label htmlFor="bus-insurance" className="mb-1 block text-sm font-semibold text-[#45516b]">Insurance Expiry</label>
                <input id="bus-insurance" type="date" value={busDraft.insuranceExp}
                  onChange={(e) => setBusDraft((p) => ({ ...p, insuranceExp: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-[#d6dbe6] bg-[#f9fafd] px-3 text-sm text-[#273246] outline-none" />
              </div>
            </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#e5e7eb] px-6 py-4">
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
                className="rounded-lg border border-[#d6dbe6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#e9edf7]"
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
            <header className="border-b border-[#e5e7eb] bg-white px-5 py-4">
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
                  className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm mx-auto"
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

                  <div className="relative rounded-xl border border-[#e5e7eb] bg-[#fbfcff] p-4 md:p-5">
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

                    <div className="pointer-events-none absolute bottom-6 left-1/2 top-16 w-px -translate-x-1/2 border-l border-dashed border-[#e5e7eb]" />
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

                <aside className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm lg:sticky lg:top-4">
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
                        className="h-10 w-full rounded-lg border border-[#d6dbe6] bg-[#fbfcff] px-3 text-sm text-[#243244] outline-none focus:border-[#9db3ee]"
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
                          className="h-10 w-full rounded-lg border border-[#d6dbe6] bg-[#fbfcff] px-3 text-sm text-[#243244] outline-none focus:border-[#9db3ee]"
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
                          className="h-10 w-full rounded-lg border border-[#d6dbe6] bg-[#fbfcff] px-3 text-sm text-[#243244] outline-none focus:border-[#9db3ee]"
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
                        className="h-10 w-full rounded-lg border border-[#d6dbe6] bg-[#fbfcff] px-3 text-sm text-[#243244] outline-none focus:border-[#9db3ee]"
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
                          className="h-10 w-full rounded-lg border border-[#d6dbe6] bg-[#fbfcff] px-3 text-sm text-[#243244] outline-none focus:border-[#9db3ee]"
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
                        className="rounded-lg border border-[#d6dbe6] bg-[#f3f6fc] px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#e9edf7]"
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

                          // Map blocked numeric IDs to seat labels
                          const allLabels: string[] = [];
                          for (const row of rows) {
                            for (const l of row.left) allLabels.push(l);
                            if (row.right) for (const r of row.right) allLabels.push(r);
                            if (row.lastRow) for (const lr of row.lastRow) allLabels.push(lr);
                          }
                          const blockedLabels = Array.from(blockedSeats)
                            .filter((id) => id >= 1 && id <= allLabels.length)
                            .map((id) => allLabels[id - 1]);

                          setSaving(true);
                          saveSeatLayoutApi(numericId, { rows: apiRows, blockedSeats: blockedLabels })
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
            <div className="border-b border-[#e5e7eb] px-6 py-4">
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
                className="rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold text-[#36425c] transition duration-200 hover:bg-[#f5f7fc]"
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
