import { sectionForDate, timeAgo } from "./driverNotifications";

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
});
