import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendChatMessage } from "../../services/aiAssistantService";

describe("aiAssistantService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("sends admin identity with chat messages and returns AI response", async () => {
    const mockReply =
      "I can help summarize admin operations. Would you like the dashboard summary?";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildResponse({
        reply: mockReply,
      }),
    );
    localStorage.setItem("jwtToken", "admin-token");
    localStorage.setItem(
      "adminProfile",
      JSON.stringify({ userId: 7, userType: "admin", email: "admin@trackngo.com" }),
    );

    const result = await sendChatMessage(
      "admin dashboard summary",
      "chat-123",
    );

    expect(result).toBe(mockReply);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/ai/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer admin-token" }),
        body: JSON.stringify({
          message: "admin dashboard summary",
          chatId: "chat-123",
          userId: 7,
        }),
      }),
    );
  });

  it("throws error when response fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(buildResponse(null, false));

    await expect(sendChatMessage("test", "chat-123")).rejects.toThrow();
  });

  function buildResponse(data: unknown, ok = true): Response {
    return {
      ok,
      json: vi.fn().mockResolvedValue(data),
    } as unknown as Response;
  }
});