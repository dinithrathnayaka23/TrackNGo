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
  address: string | null;
  businessRegistrationNumber: string | null;
  industry: string | null;
  userType: string;
}

export type ContractStatus = "pending" | "active" | "expired" | "cancelled";

export interface CorporateContract {
  contractId: number;
  contractName: string;
  startingLocation: string;
  destination: string;
  startShiftTime: string;   // "HH:MM:SS"
  endShiftTime: string;     // "HH:MM:SS"
  status: ContractStatus;
  billingAmount: number;
  startDate: string;        // "YYYY-MM-DD"
  endDate: string;          // "YYYY-MM-DD"
  createdAt: string;
  corporateUserId: number;
  busId: number | null;
}

export type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

export interface CorporateInvoice {
  invoiceNumber: number;
  contractId: number;
  amount: number;
  status: InvoiceStatus;
  date: string;       // "YYYY-MM-DD"
  dueDate: string | null;
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
  invoices: CorporateInvoice[];
  totalBilled: number;
  totalPaid: number;
  outstandingAmount: number;
}

export interface CreateContractRequest {
  contractName: string;
  startingLocation: string;
  destination: string;
  startShiftTime: string;
  endShiftTime: string;
  billingAmount: number;
  startDate: string;
  endDate: string;
  corporateUserId: number;
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
    contactPersonName: data.contactPersonName ?? existing?.contactPersonName ?? "",
    contactPersonDesignation: data.contactPersonDesignation ?? existing?.contactPersonDesignation ?? "",
    contactPhone: data.contactPhone ?? existing?.contactPhone ?? "",
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
    contactPhone: null,
    bus: null,
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
 * A contract is only *running* while its status is active AND its end date has
 * not passed. The DB keeps `status = 'active'` after `end_date` until an admin
 * expires it, so the date guard is what keeps finished contracts out of the
 * active list.
 */
export function isContractRunning(contract: CorporateContract): boolean {
  return contract.status?.toLowerCase() === "active" && !isContractEnded(contract);
}

/**
 * A contract belongs to the "previous" list once it has been expired/cancelled,
 * or once an active contract has run past its end date.
 */
export function isContractCompleted(contract: CorporateContract): boolean {
  const status = contract.status?.toLowerCase();
  if (status === "expired" || status === "cancelled") return true;
  return status === "active" && isContractEnded(contract);
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
