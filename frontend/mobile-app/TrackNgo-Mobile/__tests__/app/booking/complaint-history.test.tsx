jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock("../../../services/complaintsApi", () => ({
  getMyComplaints: jest.fn(),
}));

jest.mock("../../../store/sessionStore", () => ({
  useSession: () => ({ currentUser: null }),
}));

import { formatComplaintDate } from "../../../app/booking/complaint-history";

describe("formatComplaintDate", () => {
  it("keeps timezone-less backend complaint timestamps at the same wall-clock time", () => {
    const formatted = formatComplaintDate("2026-04-25T10:00:00");

    expect(formatted).toContain("Apr");
    expect(formatted).toContain("25");
    expect(formatted).toContain("10:00");
  });

  it("returns a fallback marker when no complaint timestamp exists", () => {
    expect(formatComplaintDate(null)).toBe("--");
  });
});
