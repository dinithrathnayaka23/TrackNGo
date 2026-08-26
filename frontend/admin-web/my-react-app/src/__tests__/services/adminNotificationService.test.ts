import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  sectionForType,
} from "../../services/adminNotificationService";

describe("adminNotificationService notification categories", () => {
  it("routes each notification type to its tab", () => {
    expect(sectionForType("booking")).toBe("Approvals");
    expect(sectionForType("system_alert")).toBe("Approvals");
    expect(sectionForType("complaint")).toBe("Support");
    expect(sectionForType("sos")).toBe("Emergency");
  });

  it("matches types case-insensitively", () => {
    expect(sectionForType("SOS")).toBe("Emergency");
  });

  it("leaves uncategorised types for the All tab", () => {
    expect(sectionForType("payment")).toBe("Other");
    expect(sectionForType(null)).toBe("Other");
    expect(sectionForType(undefined)).toBe("Other");
  });
});

describe("adminNotificationService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("fetches admin notifications from the admin endpoint", async () => {
    localStorage.setItem(
      "adminProfile",
      JSON.stringify({ userId: 7, userType: "admin" }),
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        buildResponse(true, true, [{ id: 1, title: "Reminder", read: false }]),
      );

    const result = await fetchAdminNotifications();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications/admin/7",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(result).toEqual([{ id: 1, title: "Reminder", read: false }]);
  });

  it("marks a single admin notification as read", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(buildResponse(true, true, null));

    await markAdminNotificationRead(5);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications/5/read",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("marks all admin notifications as read", async () => {
    localStorage.setItem(
      "adminProfile",
      JSON.stringify({ userId: 7, userType: "admin" }),
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(buildResponse(true, true, null));

    await markAllAdminNotificationsRead();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications/admin/7/read",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  function buildResponse(
    ok: boolean,
    success: boolean,
    data: unknown,
    message = "OK",
  ): Response {
    return {
      ok,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          success,
          message,
          data,
        }),
      ),
    } as unknown as Response;
  }
});
