/**
 * corporateApi.ts
 *
 * All API calls specific to the Corporate user flow.
 * Endpoints are backed by:
 *   - GET  /api/users/{id}/profile            → UserProfileDto
 *   - GET  /api/users/{id}/corporate/profile  → CorporateProfileDto (full corporate fields)
 *   - GET  /api/corporate/contracts?userId={id} → CorporateContract[]
 *   - POST /api/corporate/contracts            → create contract
 *   - GET  /api/corporate/invoices?userId={id} → CorporateInvoice[]
 *
 * Note: The backend exposes /api/users/{id}/profile which already returns
 * companyName and contactPersonName from the corporate_user join.
 * Full contract + invoice endpoints are built on top of the corporate_contract
 * and corporate_invoices tables in the schema.
 */

import { httpGet, httpPost, httpPut } from "./http";

/* ── Shared wrapper (matches ApiResponse<T> from Spring) ──────────── */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/* ── DTOs ─────────────────────────────────────────────────────────── */

export interface CorporateProfileDto {
  userId: number;
  fullName: string | null;
  phoneNumber: string | null;
  email: string | null;
  profilePhoto: string | null;
  companyName: string | null;
  contactPersonName: string | null;
  contactPersonDesignation: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  businessRegistrationNumber: string | null;
  industry: string | null;
  website: string | null;
  employeeCount: number | null;
  userType: string;
}

export type ContractStatus = "pending" | "active" | "expired" | "cancelled";
export type ShiftType = "morning" | "evening" | "both";
export type WorkingDays = "weekdays" | "all_days";
export type BusType = "standard" | "mini";

/** One pickup or drop-off point: a Google Places result plus the shift time. */
export interface ShiftLeg {
  location: string;
  latitude: number;
  longitude: number;
  time: string; // "HH:MM:SS"
}

export interface CorporateContract {
  contractId: number;
  contractName: string;
  startingLocation: string;
  destination: string;
  shiftType: ShiftType;
  startShiftTime: string;   // "HH:MM:SS"
  endShiftTime: string;     // "HH:MM:SS"
  morningPickup: ShiftLeg | null;
  morningDropoff: ShiftLeg | null;
  morningDistanceKm: number | null;
  eveningPickup: ShiftLeg | null;
  eveningDropoff: ShiftLeg | null;
  eveningDistanceKm: number | null;
  employeeCount: number;
  workingDays: WorkingDays;
  busType: BusType;
  /** True when the selected bus has air conditioning — independent of bus size. */
  isAc: boolean;
  distanceKm: number | null;
  status: ContractStatus;
  /** Set once the corporate user confirms the final offer after admin approval. */
  finalizedAt: string | null;
  billingAmount: number;
  startDate: string;        // "YYYY-MM-DD"
  endDate: string;          // "YYYY-MM-DD"
  createdAt: string;
  corporateUserId: number;
  busId: number | null;
  busIds: number[] | null;
  advanceAmount: number | null;
  advancePaymentStatus: 'pending' | 'paid' | 'waived' | 'refunded';
  advancePaidAt: string | null;
  originalBillingAmount: number | null;
  discountAmount: number | null;
  carriedBalance: number;
  renewedFromContractId?: number | null;
  cancellation: ContractCancellation;
  /** The corporate client's ask to renew this contract — always available while active, not just near its end date. */
  renewalRequestStatus: 'none' | 'requested' | 'approved' | 'declined';
}

/** Mutual-consent cancellation state for a corporate contract. */
export interface ContractCancellation {
  status: "none" | "pending" | "accepted" | "rejected";
  requestedBy: "admin" | "corporate" | null;
  reason: string | null;
  requestedAt: string | null;
  effectiveDate: string | null;
  responseReason: string | null;
}

export type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

export interface CorporateInvoice {
  invoiceNumber: number;
  contractId: number;
  busId: number | null;
  busNumber: string | null;
  amount: number;
  status: InvoiceStatus;
  date: string;       // "YYYY-MM-DD" — period start
  periodEnd: string | null;
  dueDate: string | null;
  invoiceType?: 'monthly' | 'carried_balance' | 'adjustment';
  stripeTransactionId: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ContractBus {
  busId: number;
  busNumber: string | null;
  busBrand: string | null;
  registrationNumber: string | null;
  seatCapacity: number | null;
  amenities: string | null;   // JSON array string, e.g. '["ac","wifi"]'
  busCondition: string | null;
  status: string | null;
  routeName: string | null;
  driverId: number | null;
  driverName: string | null;
  driverPhone: string | null;
}

export interface CorporateContractDetail extends CorporateContract {
  companyName: string | null;
  contactPersonName: string | null;
  contactPhone: string | null;
  bus: ContractBus | null;
  buses: ContractBus[];
  invoices: CorporateInvoice[];
  totalBilled: number;
  totalPaid: number;
  outstandingAmount: number;
  adminNote: string | null;
}

export interface CreateContractRequest {
  contractName: string;
  shiftType: ShiftType;
  morningPickup: ShiftLeg | null;
  morningDropoff: ShiftLeg | null;
  morningDistanceKm: number | null;
  eveningPickup: ShiftLeg | null;
  eveningDropoff: ShiftLeg | null;
  eveningDistanceKm: number | null;
  employeeCount: number;
  workingDays: WorkingDays;
  busType: BusType;
  /** True when the selected bus has air conditioning — drives the AC surcharge. */
  isAc: boolean;
  busIds: number[];
  startDate: string;
  endDate: string;
  corporateUserId: number;
  /** Set when submitting a renewal (after admin approved the renewal request) so its approval skips the advance deposit. */
  renewedFromContractId?: number;
}

/**
 * Fetches corporate buses that are free for the given contract term.
 * GET /api/corporate/buses/available
 *
 * Pass `renewedFromContractId` when this is a renewal: the predecessor
 * contract stays active (and so keeps "reserving" its own buses) until its
 * renewal is approved, so without this the same buses the client already
 * has would never show as available again for a back-to-back renewal.
 */
export async function getAvailableCorporateBuses(
  startDate: string,
  endDate: string,
  filters?: { minSeats?: number; search?: string; amenity?: string; renewedFromContractId?: number },
): Promise<ContractBus[]> {
  const res = await httpGet<ApiResponse<ContractBus[]>>(
    "/api/corporate/buses/available",
    { startDate, endDate, ...filters },
  );
  return res.data ?? [];
}

export interface PricingEstimateRequest {
  morningDistanceKm: number | null;
  eveningDistanceKm: number | null;
  employeeCount: number;
  shiftType: ShiftType;
  workingDays: WorkingDays;
  busType: BusType;
  /** True when the selected bus has air conditioning — drives the AC surcharge. */
  isAc: boolean;
}

/**
 * Live preview of the standard monthly billing amount, computed server-side
 * from each shift's real road distance, employee-driven bus size and bus
 * type surcharge.
 * POST /api/corporate/contracts/estimate
 */
export async function estimateContractPricing(
  request: PricingEstimateRequest,
): Promise<number> {
  const res = await httpPost<ApiResponse<number>>(
    "/api/corporate/contracts/estimate",
    undefined,
    request,
  );
  return res.data ?? 0;
}

/**
 * Calculates fair prorated carried balance from predecessor contract,
 * deducting any unused days.
 * GET /api/corporate/contracts/carried-balance
 */
export async function getCarriedBalance(
  predecessorContractId: number,
  startDate?: string,
): Promise<number> {
  const res = await httpGet<ApiResponse<number>>(
    "/api/corporate/contracts/carried-balance",
    { predecessorContractId, startDate },
  );
  return res.data ?? 0;
}

/* ── Support contact ──────────────────────────────────────────────── */

export interface SupportContact {
  name: string;
  role: string;
  phone: string;
}

/**
 * Fetches the admin-configured support contact shown while a contract is
 * awaiting review, replacing what used to be a hardcoded name/phone.
 * GET /api/admin/support-contact
 */
export async function getSupportContact(): Promise<SupportContact> {
  const res = await httpGet<ApiResponse<SupportContact>>("/api/admin/support-contact");
  return res.data;
}

/* ── Profile ──────────────────────────────────────────────────────── */

/**
 * Fetches the full corporate user profile via the existing profile endpoint.
 * GET /api/users/{userId}/profile
 * Returns the UserProfileDto which already includes companyName, contactPersonName.
 */
export async function getCorporateProfile(
  userId: number,
): Promise<CorporateProfileDto> {
  return httpGet<CorporateProfileDto>(`/api/users/${userId}/profile`);
}

/**
 * Updates the corporate user's full profile.
 * POST /api/users/{userId}/corporate
 */
export async function updateCorporateProfile(
  userId: number,
  data: Partial<Omit<CorporateProfileDto, "userId" | "userType">>,
): Promise<CorporateProfileDto> {
  const existing = await getCorporateProfile(userId);
  const payload = {
    companyName: data.companyName ?? existing?.companyName ?? "",
    businessRegistrationNumber: data.businessRegistrationNumber ?? existing?.businessRegistrationNumber ?? "",
    industry: data.industry ?? existing?.industry ?? "",
    address: data.address ?? existing?.address ?? "",
    website: data.website ?? existing?.website ?? "",
    employeeCount: data.employeeCount ?? existing?.employeeCount ?? null,
    contactPersonName: data.contactPersonName ?? existing?.contactPersonName ?? "",
    contactPersonDesignation: data.contactPersonDesignation ?? existing?.contactPersonDesignation ?? "",
    contactPhone: data.contactPhone ?? existing?.contactPhone ?? "",
    contactEmail: data.contactEmail ?? existing?.contactEmail ?? "",
    profilePhoto: data.profilePhoto ?? existing?.profilePhoto ?? "",
  };
  await httpPost<any>(`/api/users/${userId}/corporate`, undefined, payload);
  return getCorporateProfile(userId);
}

/* ── Contracts ────────────────────────────────────────────────────── */

/**
 * Fetches all contracts for a given corporate user.
 * GET /api/corporate/contracts?userId={userId}
 */
export async function getCorporateContracts(
  userId: number,
): Promise<CorporateContract[]> {
  try {
    const res = await httpGet<ApiResponse<CorporateContract[]>>(
      "/api/corporate/contracts",
      { userId },
    );
    return res.data ?? [];
  } catch (err) {
    console.warn("[CorporateApi] getCorporateContracts failed:", err);
    return [];
  }
}

/**
 * Creates a new corporate contract.
 * POST /api/corporate/contracts
 */
export async function createCorporateContract(
  request: CreateContractRequest,
): Promise<CorporateContract> {
  const res = await httpPost<ApiResponse<CorporateContract>>(
    "/api/corporate/contracts",
    undefined,
    request,
  );
  if (!res.success || !res.data) {
    throw new Error(res.message || "Failed to create contract.");
  }
  return res.data;
}

/**
 * Requests to cancel a pending or active contract, with a required reason.
 * Admin must accept via {@link respondToContractCancellation} before
 * anything changes.
 * POST /api/corporate/contracts/{contractId}/cancel-request
 */
export async function requestContractCancellation(
  contractId: number,
  reason: string,
): Promise<CorporateContract> {
  const res = await httpPost<ApiResponse<CorporateContract>>(
    `/api/corporate/contracts/${contractId}/cancel-request`,
    undefined,
    { role: "corporate", reason },
  );
  if (!res.success || !res.data) {
    throw new Error(res.message || "Failed to request cancellation.");
  }
  return res.data;
}

/**
 * Accepts or declines a cancellation request admin filed. When accepting an
 * admin-initiated cancellation of an already-active contract, `cancelTiming`
 * ("immediate" or "scheduled") is required so the corporate user can choose
 * between cancelling right away or keeping the contract running for the
 * standard notice period; it's ignored for every other case, since those
 * always take effect immediately.
 * POST /api/corporate/contracts/{contractId}/cancel-response
 */
export async function respondToContractCancellation(
  contractId: number,
  accept: boolean,
  responseReason?: string,
  cancelTiming?: "immediate" | "scheduled",
): Promise<CorporateContract> {
  const res = await httpPost<ApiResponse<CorporateContract>>(
    `/api/corporate/contracts/${contractId}/cancel-response`,
    undefined,
    { role: "corporate", accept, responseReason, cancelTiming },
  );
  if (!res.success || !res.data) {
    throw new Error(res.message || "Failed to respond to cancellation request.");
  }
  return res.data;
}

/**
 * Renews a contract nearing its end date by submitting a new pending
 * contract that continues from where this one leaves off, cloning its
 * route/shift/bus setup. Goes through the same admin-approval flow as any
 * new contract request.
 * POST /api/corporate/contracts/{contractId}/renew
 */
export async function renewContract(
  contractId: number,
  userId: number,
): Promise<CorporateContract> {
  const res = await httpPost<ApiResponse<CorporateContract>>(
    `/api/corporate/contracts/${contractId}/renew`,
    undefined,
    { role: "corporate", userId },
  );
  if (!res.success || !res.data) {
    throw new Error(res.message || "Failed to submit renewal request.");
  }
  return res.data;
}

/**
 * Asks admin for permission to renew an active contract — available any
 * time, not just near its end date. Admin must accept before the client can
 * proceed to fill out and submit the actual renewal contract (see
 * {@link createCorporateContract}'s `renewedFromContractId`).
 * POST /api/corporate/contracts/{contractId}/renewal-request
 */
export async function requestContractRenewal(
  contractId: number,
  userId: number,
): Promise<CorporateContract> {
  const res = await httpPost<ApiResponse<CorporateContract>>(
    `/api/corporate/contracts/${contractId}/renewal-request`,
    undefined,
    { userId },
  );
  if (!res.success || !res.data) {
    throw new Error(res.message || "Failed to send renewal request.");
  }
  return res.data;
}

/**
 * Confirms the final offer after admin approval, turning an "approved"
 * pending request into a true running contract.
 * PUT /api/corporate/contracts/{contractId}/finalize?userId={userId}
 */
export async function finalizeCorporateContract(
  contractId: number,
  userId: number,
): Promise<CorporateContract> {
  const res = await httpPut<ApiResponse<CorporateContract>>(
    `/api/corporate/contracts/${contractId}/finalize?userId=${userId}`,
  );
  if (!res.success || !res.data) {
    throw new Error(res.message || "Failed to finalize contract.");
  }
  return res.data;
}

/**
 * Fetches the full detail of a single contract — bus + driver, company info and
 * the invoice history for that contract.
 * GET /api/corporate/contracts/{contractId}?userId={userId}
 *
 * Falls back to composing the detail from the list endpoints when the backend
 * does not expose the detail endpoint yet.
 */
export async function getCorporateContractDetail(
  contractId: number,
  userId: number,
): Promise<CorporateContractDetail | null> {
  try {
    const res = await httpGet<ApiResponse<CorporateContractDetail>>(
      `/api/corporate/contracts/${contractId}`,
      { userId },
    );
    if (res.data) return res.data;
  } catch (err) {
    console.warn("[CorporateApi] getCorporateContractDetail failed, falling back:", err);
  }

  // Fallback: build the detail from the list endpoints.
  const [contracts, invoices] = await Promise.all([
    getCorporateContracts(userId),
    getCorporateInvoices(userId),
  ]);
  const contract = contracts.find((c) => c.contractId === contractId);
  if (!contract) return null;

  const contractInvoices = invoices.filter((inv) => inv.contractId === contractId);
  const sumBy = (statuses: InvoiceStatus[]) =>
    contractInvoices
      .filter((inv) => statuses.includes(inv.status))
      .reduce((total, inv) => total + (inv.amount ?? 0), 0);

  return {
    ...contract,
    companyName: null,
    contactPersonName: null,
    buses: [],
    contactPhone: null,
    bus: null,
    adminNote: null,
    invoices: contractInvoices,
    totalBilled: sumBy(["paid", "pending", "overdue"]),
    totalPaid: sumBy(["paid"]),
    outstandingAmount: sumBy(["pending", "overdue"]),
  };
}

/* ── Invoices ─────────────────────────────────────────────────────── */

/**
 * Fetches all invoices for a given corporate user (across all their contracts).
 * GET /api/corporate/invoices?userId={userId}
 */
export async function getCorporateInvoices(
  userId: number,
): Promise<CorporateInvoice[]> {
  try {
    const res = await httpGet<ApiResponse<CorporateInvoice[]>>(
      "/api/corporate/invoices",
      { userId },
    );
    return res.data ?? [];
  } catch (err) {
    console.warn("[CorporateApi] getCorporateInvoices failed:", err);
    return [];
  }
}

export async function payAdvanceDeposit(
  contractId: number,
  payload: { sessionId: string }
): Promise<CorporateContract> {
  const res = await httpPost<ApiResponse<CorporateContract>>(
    `/api/corporate/contracts/${contractId}/advance-payment`,
    undefined,
    payload
  );
  if (!res.success || !res.data) {
    throw new Error(res.message || "Failed to process advance payment.");
  }
  return res.data;
}

/**
 * Fetches a single invoice's detail, for the pay screen.
 * GET /api/corporate/invoices/{invoiceNumber}
 */
export async function getCorporateInvoice(invoiceNumber: number): Promise<CorporateInvoice | null> {
  try {
    const res = await httpGet<ApiResponse<CorporateInvoice>>(`/api/corporate/invoices/${invoiceNumber}`);
    return res.data ?? null;
  } catch (err) {
    console.warn("[CorporateApi] getCorporateInvoice failed:", err);
    return null;
  }
}

/**
 * Confirms payment of a monthly invoice after a successful Stripe checkout.
 * POST /api/corporate/invoices/{invoiceNumber}/pay
 */
export async function payCorporateInvoice(
  invoiceNumber: number,
  payload: { sessionId: string },
): Promise<void> {
  const res = await httpPost<ApiResponse<null>>(
    `/api/corporate/invoices/${invoiceNumber}/pay`,
    undefined,
    payload,
  );
  if (!res.success) {
    throw new Error(res.message || "Failed to confirm invoice payment.");
  }
}

/* ── Profile validation ───────────────────────────────────────────── */

const PLACEHOLDER_VALUES = new Set([
  "test", "tests", "testing", "n/a", "na", "none", "asdf", "asdfgh",
  "xxx", "xxxx", "abc", "abcd", "sample", "demo", "example",
  "placeholder", "unknown", "company", "address",
]);

/**
 * Mirrors the backend's `ProfileValidation.isRealText` so obviously-fake
 * input ("test", "asdf", "1111", ...) is caught immediately in the form
 * instead of round-tripping to the server first.
 */
export function isRealProfileText(value: string, minLength: number): boolean {
  const trimmed = value.trim();
  if (trimmed.length < minLength) return false;
  if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) return false;
  return new Set(trimmed.split("")).size > 1;
}

/**
 * Mirrors the backend's `ProfileValidation.isValidSriLankanPhone`: a 9-digit
 * subscriber number (first digit 1-9) optionally prefixed with a trunk "0"
 * or the "+94"/"94" country code, e.g. "0771234567" or "+94 77 123 4567".
 */
export function isValidSriLankanPhone(value: string): boolean {
  const digits = value.replace(/[^0-9]/g, "");
  let local = digits;
  if (local.startsWith("94") && local.length === 11) {
    local = local.slice(2);
  } else if (local.startsWith("0") && local.length === 10) {
    local = local.slice(1);
  }
  return /^[1-9]\d{8}$/.test(local);
}

/** Mirrors the backend's `ProfileValidation.isValidEmail` — a plausible "local@domain.tld" shape. */
export function isValidProfileEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/* ── Helpers ──────────────────────────────────────────────────────── */

/**
 * Formats a YYYY-MM-DD date string into a human-readable label.
 * e.g. "2024-01-12" → "Jan 12, 2024"
 */
export function formatContractDate(dateStr: string): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats a HH:MM:SS time string into "HH:MM AM/PM".
 */
export function formatShiftTime(timeStr: string): string {
  if (!timeStr) return "—";
  const [hourStr, minuteStr] = timeStr.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/**
 * Formats a number as a Sri Lankan Rupees currency string.
 * e.g. 19240.50 → "Rs.19,240.50"
 */
export function formatAmount(amount: number): string {
  if (amount == null || isNaN(amount)) return "Rs.0.00";
  return `Rs.${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Computes the total outstanding balance (sum of pending + overdue invoices).
 */
export function computeOutstandingBalance(
  invoices: CorporateInvoice[],
): number {
  return invoices
    .filter((inv) => inv.status === "pending" || inv.status === "overdue")
    .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
}

/**
 * Parses the `amenities` JSON column of a bus into a list of amenity keys.
 * Accepts both a JSON array string and a comma separated string.
 */
export function parseBusAmenities(amenities: string | null | undefined): string[] {
  if (!amenities) return [];
  try {
    const parsed = JSON.parse(amenities);
    if (Array.isArray(parsed)) return parsed.map((a) => String(a));
  } catch {
    // Not JSON — fall through to comma separated handling.
  }
  return amenities
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

/**
 * Number of whole days between today and the contract end date.
 * Negative once the contract has already ended.
 */
export function daysRemaining(endDate: string): number {
  if (!endDate) return 0;
  const [year, month, day] = endDate.split("-").map(Number);
  const end = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Fraction (0–1) of the contract period that has already elapsed.
 */
export function contractProgress(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const toDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).getTime();
  };
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (end <= start) return 1;
  const now = Date.now();
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

/**
 * Formats a HH:MM:SS pair into a shift duration label, e.g. "12h 30m".
 */
export function formatShiftDuration(start: string, end: string): string {
  if (!start || !end) return "—";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/* ── Contract classification ──────────────────────────────────────── */

/**
 * True once the contract's end date has passed.
 */
export function isContractEnded(contract: CorporateContract): boolean {
  return !!contract.endDate && daysRemaining(contract.endDate) < 0;
}

/**
 * True once admin has approved the contract (status = active) but the
 * corporate user hasn't yet confirmed the final offer. Shown under Pending
 * Contracts as "Request Approved" — clicking it still opens the negotiation
 * screen, where the user can now proceed to accept it.
 */
export function isAwaitingFinalization(contract: CorporateContract): boolean {
  return contract.status?.toLowerCase() === "active" && !contract.finalizedAt;
}

/**
 * True once the corporate user has accepted an admin-initiated cancellation
 * of an active contract and chosen to keep it running until the notice
 * period ends, rather than cancelling immediately. The contract is still
 * `status = 'active'` in the DB until the scheduled job cancels it on
 * `cancellation.effectiveDate`, so it should read as something other than
 * plain "Active" in the meantime.
 */
export function isScheduledForCancellation(contract: CorporateContract): boolean {
  return (
    contract.status?.toLowerCase() === "active" &&
    contract.cancellation.status === "accepted" &&
    !!contract.cancellation.effectiveDate
  );
}

/**
 * A contract is only *running* while its status is active, it has been
 * finalized by the corporate user, AND its end date has not passed. The DB
 * keeps `status = 'active'` after `end_date` until an admin expires it, so
 * the date guard is what keeps finished contracts out of the active list.
 */
export function isContractRunning(contract: CorporateContract): boolean {
  return (
    contract.status?.toLowerCase() === "active" &&
    !!contract.finalizedAt &&
    !isContractEnded(contract)
  );
}

/**
 * A contract belongs to the "previous" list once it has been expired/cancelled,
 * or once an active contract has run past its end date.
 */
export function isContractCompleted(contract: CorporateContract): boolean {
  const status = contract.status?.toLowerCase();
  if (status === "expired" || status === "cancelled") return true;
  return status === "active" && !!contract.finalizedAt && isContractEnded(contract);
}

/** Contracts within this many days of their end date surface a renewal reminder. */
export const RENEWAL_REMINDER_WINDOW_DAYS = 30;

/**
 * True once a running contract is within the renewal reminder window of its
 * end date (including already past it) — surfaces the "Renew Contract"
 * banner/action. Mirrors the same window the backend's daily reminder
 * scheduler uses, so the UI and the notification agree on when renewal
 * becomes relevant.
 */
export function isRenewalDue(contract: CorporateContract): boolean {
  return (
    contract.status?.toLowerCase() === "active" &&
    !!contract.finalizedAt &&
    daysRemaining(contract.endDate) <= RENEWAL_REMINDER_WINDOW_DAYS
  );
}

/**
 * Label + colour for a finished contract: an active contract that simply ran to
 * its end date reads as "Completed", not "Expired".
 */
export function describeCompletedContract(
  contract: CorporateContract,
): { label: string; colour: string } {
  switch (contract.status?.toLowerCase()) {
    case "cancelled":
      return { label: "Cancelled", colour: "#F59E0B" };
    case "expired":
      return { label: "Expired", colour: "#EF4444" };
    default:
      return { label: "Completed", colour: "#10B981" };
  }
}

/**
 * Maps contract status from the DB ENUM into a display label.
 */
export function displayContractStatus(
  status: ContractStatus,
): "Active" | "Expiring Soon" | "Expired" | "Pending" | "Cancelled" {
  switch (status?.toLowerCase()) {
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "pending":
      return "Pending";
    case "cancelled":
      return "Cancelled";
    default:
      return "Active";
  }
}

/**
 * Maps invoice status to a label with consistent capitalisation.
 */
export function displayInvoiceStatus(
  status: InvoiceStatus,
): "Paid" | "Pending" | "Overdue" | "Cancelled" {
  switch (status) {
    case "paid":
      return "Paid";
    case "pending":
      return "Pending";
    case "overdue":
      return "Overdue";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending";
  }
}
