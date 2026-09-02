import {
  earliestBookableDate,
  earliestBookableDateString,
  formatLocalDate,
  isAfterLatestBookableDate,
  isBeforeEarliestBookableDate,
  isUnbookableBookingDate,
  latestBookableDate,
  MAX_BOOKING_LEAD_DAYS,
  MIN_BOOKING_LEAD_DAYS,
  normalizeBookableDate,
  parseBookingDate,
} from '../../utils/bookingDate';

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysFromToday(offset: number): Date {
  const today = startOfToday();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
}

describe('bookingDate', () => {
  describe('earliestBookableDate', () => {
    it('is one day ahead of today, so same-day travel cannot be booked', () => {
      expect(formatLocalDate(earliestBookableDate())).toBe(formatLocalDate(daysFromToday(1)));
      expect(MIN_BOOKING_LEAD_DAYS).toBe(1);
    });

    it('exposes the same day as a yyyy-mm-dd string', () => {
      expect(earliestBookableDateString()).toBe(formatLocalDate(daysFromToday(1)));
    });
  });

  describe('isBeforeEarliestBookableDate', () => {
    it('rejects today', () => {
      expect(isBeforeEarliestBookableDate(startOfToday())).toBe(true);
    });

    it('rejects yesterday', () => {
      expect(isBeforeEarliestBookableDate(daysFromToday(-1))).toBe(true);
    });

    it('accepts tomorrow', () => {
      expect(isBeforeEarliestBookableDate(daysFromToday(1))).toBe(false);
    });

    it('accepts a date well in the future', () => {
      expect(isBeforeEarliestBookableDate(daysFromToday(30))).toBe(false);
    });

    it('ignores the time of day on the selected date', () => {
      const today = startOfToday();
      const lateToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      expect(isBeforeEarliestBookableDate(lateToday)).toBe(true);
    });
  });

  describe('latestBookableDate', () => {
    it('is MAX_BOOKING_LEAD_DAYS ahead of today', () => {
      expect(formatLocalDate(latestBookableDate())).toBe(formatLocalDate(daysFromToday(MAX_BOOKING_LEAD_DAYS)));
    });
  });

  describe('isAfterLatestBookableDate', () => {
    it('accepts a date within the booking window', () => {
      expect(isAfterLatestBookableDate(daysFromToday(30))).toBe(false);
    });

    it('accepts the last bookable day itself', () => {
      expect(isAfterLatestBookableDate(daysFromToday(MAX_BOOKING_LEAD_DAYS))).toBe(false);
    });

    it('rejects a date past the booking window', () => {
      expect(isAfterLatestBookableDate(daysFromToday(MAX_BOOKING_LEAD_DAYS + 1))).toBe(true);
    });
  });

  describe('isUnbookableBookingDate', () => {
    it("rejects today's date string", () => {
      expect(isUnbookableBookingDate(formatLocalDate(startOfToday()))).toBe(true);
    });

    it("accepts tomorrow's date string", () => {
      expect(isUnbookableBookingDate(formatLocalDate(daysFromToday(1)))).toBe(false);
    });

    it('rejects a date past the booking window', () => {
      expect(isUnbookableBookingDate(formatLocalDate(daysFromToday(MAX_BOOKING_LEAD_DAYS + 1)))).toBe(true);
    });

    it('rejects malformed and missing dates', () => {
      expect(isUnbookableBookingDate('not-a-date')).toBe(true);
      expect(isUnbookableBookingDate('2026-02-30')).toBe(true);
      expect(isUnbookableBookingDate(undefined)).toBe(true);
      expect(isUnbookableBookingDate(null)).toBe(true);
    });
  });

  describe('normalizeBookableDate', () => {
    it('pulls today forward to the earliest bookable date', () => {
      expect(formatLocalDate(normalizeBookableDate(startOfToday())))
        .toBe(formatLocalDate(daysFromToday(1)));
    });

    it('leaves an already-bookable date untouched', () => {
      const future = daysFromToday(5);
      expect(formatLocalDate(normalizeBookableDate(future))).toBe(formatLocalDate(future));
    });

    it('pulls a too-far-out date back to the latest bookable date', () => {
      const tooFar = daysFromToday(MAX_BOOKING_LEAD_DAYS + 10);
      expect(formatLocalDate(normalizeBookableDate(tooFar))).toBe(formatLocalDate(latestBookableDate()));
    });
  });

  describe('parseBookingDate', () => {
    it('parses a valid date', () => {
      expect(formatLocalDate(parseBookingDate('2026-03-14') as Date)).toBe('2026-03-14');
    });

    it('returns null for an impossible calendar date', () => {
      expect(parseBookingDate('2026-13-01')).toBeNull();
    });
  });
});
