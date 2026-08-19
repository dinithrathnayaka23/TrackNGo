import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faTruckMedical,
  faShieldHalved,
  faFireExtinguisher,
  faExternalLinkAlt,
  faWindowMinimize,
  faUserShield,
} from "@fortawesome/free-solid-svg-icons";
import {
  fetchActiveEmergencyNumbers,
  fetchActiveSosAlerts,
  SOS_API_BASE,
  type EmergencyServiceNumbers,
  type SosAlertData,
  type SosAlertStatusAction,
  updateSosAlertStatus,
} from "../services/sosAlertService";

const DEFAULT_EMERGENCY_NUMBERS: EmergencyServiceNumbers = {
  ambulance: "1990",
  police: "119",
  fireBrigade: "110",
};

// Parses a latitude and longitude pair from the alert's shared location string.
export function parseGps(
  location: string | null,
): { lat: number; lng: number; label: string } | null {
  if (!location) return null;
  const match = location.match(/([\d.-]+)[,\s]+([\d.-]+)/);
  if (!match) return null;
  return {
    lat: parseFloat(match[1]),
    lng: parseFloat(match[2]),
    label: location
      .replace(/^[\d.,\s-]+/, "")
      .replace(/^-\s*/, "")
      .trim(),
  };
}

// Formats an alert timestamp for the SOS popup header.
export function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function SosAlertPopup() {
  const [alerts, setAlerts] = useState<SosAlertData[]>([]);
  const [emergencyNumbers, setEmergencyNumbers] =
    useState<EmergencyServiceNumbers>(DEFAULT_EMERGENCY_NUMBERS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<
    "resolve" | "dismiss" | ""
  >("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Polls the backend for active alerts and the latest emergency numbers.
  useEffect(() => {
    let active = true;

    const fetchAlerts = async () => {
      try {
        const data = await fetchActiveSosAlerts();
        if (active) {
          setAlerts(data);
          // If no more active alerts, reset state
          if (data.length === 0) {
            setMinimized(false);
            setCurrentIndex(0);
          }
        }
      } catch {
        // silently retry on next interval
      }
    };

    const fetchEmergencyNumbers = async () => {
      try {
        const data = await fetchActiveEmergencyNumbers();
        if (active && data) {
          setEmergencyNumbers({
            ambulance:
              data.ambulance || DEFAULT_EMERGENCY_NUMBERS.ambulance,
            police: data.police || DEFAULT_EMERGENCY_NUMBERS.police,
            fireBrigade:
              data.fireBrigade || DEFAULT_EMERGENCY_NUMBERS.fireBrigade,
          });
        }
      } catch {
        // keep fallback numbers if request fails
      }
    };

    fetchAlerts();
    fetchEmergencyNumbers();
    const interval = setInterval(() => {
      fetchAlerts();
      fetchEmergencyNumbers();
    }, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const alert = alerts.length > 0 ? (alerts[currentIndex] ?? alerts[0]) : null;

  if (!alert) return null;

  const gps = parseGps(alert.sharedLocation);
  const mapSrc = gps
    ? `https://maps.google.com/maps?q=${gps.lat},${gps.lng}&z=14&output=embed`
    : null;
  const mapLink = gps
    ? `https://www.google.com/maps?q=${gps.lat},${gps.lng}`
    : null;
  const isPassengerAlert = alert.triggeredByType === "passenger";
  const topUserName = isPassengerAlert
    ? alert.passengerName || alert.name || "Unknown"
    : alert.driverName || alert.name || "Unknown";
  const topUserId = isPassengerAlert ? alert.passengerId : alert.driverId;
  const busDetails = alert.busNumber
    ? `${alert.busNumber}${alert.startLocation || alert.endLocation ? ` / ${alert.startLocation || "Unknown"} to ${alert.endLocation || "Unknown"}` : ""}`
    : alert.startLocation || alert.endLocation
      ? `${alert.startLocation || "Unknown"} to ${alert.endLocation || "Unknown"}`
      : "N/A";
  const passengerMobile =
    alert.passengerPhoneNumber || (isPassengerAlert ? alert.phoneNumber : null);
  const driverMobile = alert.driverPhoneNumber || alert.phoneNumber;
  const callDriverLabel = alert.busNumber
    ? `Call Driver of ${alert.busNumber}`
    : "Call Driver";

  // Sends the selected alert action and removes the handled alert from the popup list.
  const handleStatusChange = async (action: SosAlertStatusAction) => {
    setUpdatingStatus(true);
    try {
      await updateSosAlertStatus(alert.sosId, action);
      setAlerts((prev) => prev.filter((a) => a.sosId !== alert.sosId));
      setCurrentIndex(0);
      setSelectedStatus("");
    } catch {
      // retry on next poll
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Minimized floating badge
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-full bg-red-600 px-5 py-3 text-white shadow-2xl transition hover:bg-red-700 hover:scale-105 animate-in"
      >
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
        </span>
        <span className="text-sm font-bold">
          SOS Alert{alerts.length > 1 ? `s (${alerts.length})` : ""} — Click to
          expand
        </span>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]" />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="relative w-full max-w-[960px] rounded-2xl bg-white shadow-2xl animate-in">
          {/* Alert badge for multiple alerts */}
          {alerts.length > 1 && (
            <div className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow-lg">
              {alerts.length}
            </div>
          )}

          {/* Minimize button (top-right) */}
          <button
            type="button"
            onClick={() => setMinimized(true)}
            title="Minimize alert"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[#64748b] transition hover:bg-[#f3f4f6] hover:text-[#334155]"
          >
            <FontAwesomeIcon icon={faWindowMinimize} className="text-xs" />
          </button>

          <div className="flex flex-col md:flex-row">
            {/* LEFT: Map section */}
            <div className="flex-1 p-6 pb-2 md:pb-6">
              {/* Header */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-200">
                  <svg
                    className="h-6 w-6 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v.01M12 12v4" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-[#111827]">
                    SOS ALERT - EMERGENCY
                    <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  </h2>
                  <p className="text-sm text-[#64748b]">
                    Triggered: {formatTime(alert.triggeredAt)} &middot; Signal:
                    Critical
                  </p>
                </div>
              </div>

              {/* Map */}
              <div
                className="relative overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f0f2f5]"
                style={{ height: 260 }}
              >
                {mapSrc ? (
                  <iframe
                    title="SOS Location"
                    src={mapSrc}
                    className="h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[#94a3b8]">
                    Location data unavailable
                  </div>
                )}

                {/* GPS overlay */}
                {gps && (
                  <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between bg-gradient-to-t from-white/95 to-transparent px-4 pb-3 pt-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748b]">
                        Current GPS
                      </p>
                      <p className="font-mono text-sm font-semibold text-[#111827]">
                        {gps.lat.toFixed(4)}&deg; N, &nbsp;{gps.lng.toFixed(4)}
                        &deg; E
                      </p>
                    </div>
                    {mapLink && (
                      <a
                        href={mapLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-bold text-[#2563eb] hover:underline"
                      >
                        FULL MAP{" "}
                        <FontAwesomeIcon
                          icon={faExternalLinkAlt}
                          className="text-[10px]"
                        />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Emergency service buttons */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <a
                  href={`tel:${emergencyNumbers.ambulance}`}
                  className="flex flex-col items-center gap-1 rounded-xl border border-[#e5e7eb] bg-white py-2.5 shadow-sm transition hover:border-red-200 hover:bg-red-50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50">
                    <FontAwesomeIcon
                      icon={faTruckMedical}
                      className="text-red-500 text-sm"
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#111827]">
                    Ambulance
                  </span>
                  <span className="text-[14px] text-[#94a3b8]">
                    {emergencyNumbers.ambulance}
                  </span>
                </a>

                <a
                  href={`tel:${emergencyNumbers.police}`}
                  className="flex flex-col items-center gap-1 rounded-xl border border-[#e5e7eb] bg-white py-2.5 shadow-sm transition hover:border-red-200 hover:bg-red-50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50">
                    <FontAwesomeIcon
                      icon={faShieldHalved}
                      className="text-red-500 text-sm"
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#111827]">
                    Police
                  </span>
                  <span className="text-[14px] text-[#94a3b8]">
                    {emergencyNumbers.police}
                  </span>
                </a>

                <a
                  href={`tel:${emergencyNumbers.fireBrigade}`}
                  className="flex flex-col items-center gap-1 rounded-xl border border-[#e5e7eb] bg-white py-2.5 shadow-sm transition hover:border-red-200 hover:bg-red-50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50">
                    <FontAwesomeIcon
                      icon={faFireExtinguisher}
                      className="text-red-500 text-sm"
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#111827]">
                    Fire Brigade
                  </span>
                  <span className="text-[14px] text-[#94a3b8]">
                    {emergencyNumbers.fireBrigade}
                  </span>
                </a>
              </div>
            </div>

            {/* RIGHT: Info section */}
            <div className="flex-1 border-t border-[#e5e7eb] p-6 pt-4 md:border-t-0 md:border-l md:pt-6">
              {/* User card */}
              <div className="mb-4 flex items-center gap-4">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[#e5e7eb]">
                  {alert.profilePhoto ? (
                    <img
                      src={
                        alert.profilePhoto.startsWith("http")
                          ? alert.profilePhoto
                          : `${SOS_API_BASE}/${alert.profilePhoto}`
                      }
                      alt={alert.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-bold text-[#94a3b8]">
                      {alert.name?.charAt(0) || "?"}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-[#111827]">
                    {topUserName.trim() || "Unknown"}
                  </h3>
                  <p className="text-sm font-semibold text-red-500">
                    User ID: #{topUserId ?? "N/A"}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <hr className="mb-3 border-[#e5e7eb]" />

              {/* SOS details summary */}
              <div className="mb-3 rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#64748b]">
                  SOS Details
                </p>
                <div className="space-y-1 text-sm text-[#111827]">
                  {isPassengerAlert ? (
                    <>
                      <p>
                        <span className="font-semibold">Passenger:</span>{" "}
                        {alert.passengerName || "N/A"}
                      </p>
                      <p>
                        <span className="font-semibold">Bus:</span> {busDetails}
                      </p>
                      <p>
                        <span className="font-semibold">Driver :</span>{" "}
                        {alert.driverName || "N/A"} /{" "}
                        <span className="font-semibold">User Id:</span> #
                        {alert.driverId ?? "N/A"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        <span className="font-semibold">Driver :</span>{" "}
                        {alert.driverName || "N/A"} /{" "}
                        <span className="font-semibold">User Id:</span> #
                        {alert.driverId ?? "N/A"}
                      </p>
                      <p>
                        <span className="font-semibold">Bus:</span> {busDetails}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Call passenger */}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-[#64748b]">Call Passenger</span>
                <a
                  href={passengerMobile ? `tel:${passengerMobile}` : "#"}
                  className={`flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-semibold text-[#111827] shadow-sm transition ${passengerMobile ? "hover:bg-[#f9fafb]" : "pointer-events-none opacity-60"}`}
                >
                  <FontAwesomeIcon icon={faPhone} className="text-green-600" />
                  {passengerMobile || "N/A"}
                </a>
              </div>

              {/* Call driver */}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-[#64748b]">
                  {callDriverLabel}
                </span>
                <a
                  href={driverMobile ? `tel:${driverMobile}` : "#"}
                  className={`flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-semibold text-[#111827] shadow-sm transition ${driverMobile ? "hover:bg-[#f9fafb]" : "pointer-events-none opacity-60"}`}
                >
                  <FontAwesomeIcon icon={faPhone} className="text-green-600" />
                  {driverMobile || "N/A"}
                </a>
              </div>

              {/* Emergency contacts of the person */}
              {alert.emergencyContacts &&
                alert.emergencyContacts.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-2 flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={faUserShield}
                        className="text-xs text-[#64748b]"
                      />
                      <p className="text-xs font-bold uppercase tracking-widest text-[#64748b]">
                        {isPassengerAlert
                          ? "Passenger Emergency Contacts"
                          : "Driver Emergency Contacts"}
                      </p>
                    </div>
                    <div className="space-y-2 rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-2">
                      {alert.emergencyContacts.map((ec) => (
                        <div
                          key={ec.contactId}
                          className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#111827]">
                              {ec.name}
                            </p>
                            {ec.relationship ? (
                              <p className="text-[11px] text-[#94a3b8]">
                                {ec.relationship}
                              </p>
                            ) : (
                              <p className="text-[11px] text-[#94a3b8]">
                                Emergency contact
                              </p>
                            )}
                          </div>
                          <a
                            href={ec.teleNumber ? `tel:${ec.teleNumber}` : "#"}
                            className={`flex items-center gap-1.5 rounded-md border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] transition ${ec.teleNumber ? "hover:bg-[#f0fdf4]" : "pointer-events-none opacity-60"}`}
                          >
                            <FontAwesomeIcon
                              icon={faPhone}
                              className="text-[10px] text-green-600"
                            />
                            {ec.teleNumber || "N/A"}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Status dropdown + OK button */}
              <div className="flex items-center gap-2">
                <select
                  aria-label="SOS status action"
                  value={selectedStatus}
                  onChange={(e) =>
                    setSelectedStatus(
                      e.target.value as "resolve" | "dismiss" | "",
                    )
                  }
                  disabled={updatingStatus}
                  className="flex-1 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] shadow-sm transition hover:bg-[#f9fafb] disabled:opacity-50 appearance-none cursor-pointer"
                >
                  <option value="">Select Status</option>
                  <option value="resolve">Resolved</option>
                  <option value="dismiss">False Alarm</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedStatus) handleStatusChange(selectedStatus);
                  }}
                  disabled={!selectedStatus || updatingStatus}
                  className="rounded-lg bg-[#2563eb] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {updatingStatus ? "Updating..." : "OK"}
                </button>
              </div>

              {/* Multiple alerts navigator */}
              {alerts.length > 1 && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  {alerts.map((_, i) => (
                    <button
                      key={alerts[i].sosId}
                      type="button"
                      aria-label={`View SOS alert ${i + 1}`}
                      onClick={() => {
                        setCurrentIndex(i);
                        setSelectedStatus("");
                      }}
                      className={`h-2 w-2 rounded-full transition ${
                        i === currentIndex
                          ? "bg-red-500 scale-125"
                          : "bg-[#d1d5db]"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes animate-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-in { animation: animate-in 0.3s ease-out; }
      `}</style>
    </>
  );
}

export default SosAlertPopup;
