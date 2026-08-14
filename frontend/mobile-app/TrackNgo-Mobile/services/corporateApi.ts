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
  await httpPost<any>(`/api/users/${userId}/corporate`, data);
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
 * Maps contract status from the DB ENUM into a display label.
 */
export function displayContractStatus(
  status: ContractStatus,
): "Active" | "Expiring Soon" | "Expired" | "Pending" | "Cancelled" {
  switch (status) {
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
