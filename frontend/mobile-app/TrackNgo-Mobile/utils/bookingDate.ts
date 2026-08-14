export const PAST_BOOKING_DATE_MESSAGE = 'Please choose today or a future date. Past dates cannot be booked.';

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

export function isPastCalendarDate(date: Date): boolean {
  const selected = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return selected.getTime() < startOfToday().getTime();
}

export function isPastOrInvalidBookingDate(dateText?: string | null): boolean {
  const parsed = parseBookingDate(dateText);
  return !parsed || isPastCalendarDate(parsed);
}

export function normalizeBookableDate(date: Date): Date {
  return isPastCalendarDate(date) ? startOfToday() : date;
}

export function todayDateString(): string {
  return formatLocalDate(startOfToday());
}