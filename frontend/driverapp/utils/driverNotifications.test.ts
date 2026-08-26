import {
  sectionForDate,
  sectionForType,
  timeAgo,
} from "./driverNotifications";

describe("driver notification helpers", () => {
  it("groups recent timestamps into the expected sections", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    expect(sectionForDate(today.toISOString())).toBe("Today");
    expect(sectionForDate(yesterday.toISOString())).toBe("Yesterday");
  });

  it("formats relative time for recent activity", () => {
    const recentDate = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    expect(timeAgo(recentDate)).toBe("3m ago");
  });

  it("routes each notification type to its tab", () => {
    expect(sectionForType("booking")).toBe("Bookings");
    expect(sectionForType("cancellation")).toBe("Bookings");
    expect(sectionForType("journey")).toBe("Journeys");
    expect(sectionForType("rating")).toBe("Ratings");
    expect(sectionForType("complaint")).toBe("Support");
    expect(sectionForType("sos")).toBe("Support");
  });

  it("matches types case-insensitively", () => {
    expect(sectionForType("BOOKING")).toBe("Bookings");
  });

  it("leaves uncategorised types for the All tab", () => {
    expect(sectionForType("promotion")).toBe("Other");
    expect(sectionForType("system_alert")).toBe("Other");
    expect(sectionForType(null)).toBe("Other");
  });
});
