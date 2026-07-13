import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendChatMessage } from "../../services/aiAssistantService";

describe("aiAssistantService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a chat message and returns AI response", async () => {
    const mockReply =
      "I can help you find routes to Bangalore. Would you like me to search?";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      buildResponse({
        reply: mockReply,
      }),
    );

    const result = await sendChatMessage(
      "Find routes to Bangalore",
      "chat-123",
    );

    expect(result).toBe(mockReply);
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
