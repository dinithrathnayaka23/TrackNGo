/**
 * Seat bookings must be made at least one full day ahead: a passenger cannot
 * book a seat for the day they are travelling. The earliest bookable journey
 * date is therefore tomorrow, not today.
 *
 * Keep this in step with BookingFlowService.MIN_BOOKING_LEAD_DAYS on the
 * backend, which enforces the same rule for callers that bypass the app.
 */
export const MIN_BOOKING_LEAD_DAYS = 1;

/**
 * Without a ceiling a journey date could be set arbitrarily far out, long
 * past any schedule the operator can actually commit to. Keep this in step
 * with MAX_BOOKING_LEAD_DAYS on the backend's BookingFlowService, which
 * enforces the same rule for callers that bypass the app.
 */
export const MAX_BOOKING_LEAD_DAYS = 90;

export const BOOKING_LEAD_TIME_MESSAGE =
  'Bookings must be made at least one day in advance. Please choose tomorrow or a later date.';

export const BOOKING_MAX_LEAD_TIME_MESSAGE =
  `Bookings can only be made up to ${MAX_BOOKING_LEAD_DAYS} days in advance.`;

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** The first journey date a passenger is allowed to book. */
export function earliestBookableDate(): Date {
  const today = startOfToday();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + MIN_BOOKING_LEAD_DAYS);
}

/** The last journey date a passenger is allowed to book. */
export function latestBookableDate(): Date {
  const today = startOfToday();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + MAX_BOOKING_LEAD_DAYS);
}

export function formatLocalDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function parseBookingDate(dateText?: string | null): Date | null {
  const match = (dateText ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

/** True for today and any earlier day - both are now too late to book. */
export function isBeforeEarliestBookableDate(date: Date): boolean {
  const selected = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return selected.getTime() < earliestBookableDate().getTime();
}

/** True once a date is further out than the booking window allows. */
export function isAfterLatestBookableDate(date: Date): boolean {
  const selected = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return selected.getTime() > latestBookableDate().getTime();
}

export function isUnbookableBookingDate(dateText?: string | null): boolean {
  const parsed = parseBookingDate(dateText);
  return !parsed || isBeforeEarliestBookableDate(parsed) || isAfterLatestBookableDate(parsed);
}

export function normalizeBookableDate(date: Date): Date {
  if (isBeforeEarliestBookableDate(date)) return earliestBookableDate();
  if (isAfterLatestBookableDate(date)) return latestBookableDate();
  return date;
}

export function earliestBookableDateString(): string {
  return formatLocalDate(earliestBookableDate());
}
