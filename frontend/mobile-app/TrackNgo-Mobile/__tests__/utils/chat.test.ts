import {
  applyStatusUpdates,
  formatConversationPreview,
  getOtherParticipant,
  getParticipantTitle,
  mergeMessage,
  resolveParticipantUserType,
  statusTick,
} from "../../utils/chat";
import type { ChatMessage, ConversationDto } from "../../types/chat";

describe("chat utils", () => {
  /** Verifies that the helper returns the participant opposite the signed-in user. */
  it("getOtherParticipant resolves the other conversation user", () => {
    const result = getOtherParticipant(buildConversation(), {
      userId: 15,
      userType: "PASSENGER",
    });

    expect(result).toEqual({ userId: 22, userType: "DRIVER" });
  });

  /** Verifies that participant titles prefer profile data and admin-special handling. */
  it("getParticipantTitle maps admin and corporate labels", () => {
    expect(
      getParticipantTitle("ADMIN", 1, {
        fullName: "Support",
        userType: "ADMIN",
      }),
    ).toBe("Customer Support - Admin");

    expect(
      getParticipantTitle("CORPORATE_USER", 33, {
        fullName: "Nadeesha",
        contactPersonName: "Nadeesha",
        companyName: "Northline Logistics",
        userType: "CORPORATE_USER",
      }),
    ).toBe("Nadeesha - Northline Logistics");
  });

  /** Verifies that preview and type-resolution helpers map special chat message types correctly. */
  it("formats previews and resolves participant types from profile data", () => {
    expect(
      formatConversationPreview(
        buildConversation({
          lastMessage: "voice.mp3",
          lastMessageType: "VOICE",
        }),
      ),
    ).toBe("Voice message");

    expect(
      resolveParticipantUserType("PASSENGER", {
        fullName: "Kasun Driver",
        userType: "DRIVER",
      }),
    ).toBe("DRIVER");
  });

  /** Verifies that client-side message merging replaces optimistic messages by client id. */
  it("mergeMessage replaces an optimistic message when the server copy arrives", () => {
    const existing = [
      buildMessage({
        clientMessageId: "client-123",
        content: "Sending...",
        status: "SENT",
      }),
    ];

    const result = mergeMessage(
      existing,
      buildMessage({
        messageId: 99,
        clientMessageId: "client-123",
        content: "Delivered copy",
        status: "DELIVERED",
      }),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      messageId: 99,
      content: "Delivered copy",
      status: "DELIVERED",
    });
  });

  /** Verifies that status updates and tick formatting reflect the latest delivery state. */
  it("applies status updates and maps the final tick style", () => {
    const updated = applyStatusUpdates(
      [
        buildMessage({ messageId: 10, status: "SENT" }),
        buildMessage({ messageId: 11, status: "DELIVERED" }),
      ],
      [{ messageId: 10, status: "READ" }],
    );

    expect(updated[0].status).toBe("READ");
    expect(updated[1].status).toBe("DELIVERED");
    expect(statusTick("READ")).toEqual({
      text: "✓✓",
      color: "#1e88e5",
    });
  });

  /** Builds a representative conversation DTO for chat utility assertions. */
  function buildConversation(
    overrides: Partial<ConversationDto> = {},
  ): ConversationDto {
    return {
      conversationId: 77,
      participant1Id: 15,
      participant2Id: 22,
      participant1Type: "PASSENGER",
      participant2Type: "DRIVER",
      participant1Unread: 0,
      participant2Unread: 0,
      lastMessage: "Hello",
      lastMessageType: "TEXT",
      lastMessageTimestamp: "2026-04-26T10:00:00Z",
      ...overrides,
    };
  }

  /** Builds a representative chat message for merge and status-update helpers. */
  function buildMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
      messageId: 1,
      conversationId: 77,
      senderId: 15,
      recipientId: 22,
      senderType: "PASSENGER",
      content: "Hello",
      messageType: "TEXT",
      status: "SENT",
      clientMessageId: "client-1",
      mediaUrl: null,
      compressedMediaUrl: null,
      fileName: null,
      mediaMimeType: null,
      mediaSizeBytes: null,
      compressedSizeBytes: null,
      durationSeconds: null,
      latitude: null,
      longitude: null,
      createdAt: "2026-04-26T10:00:00Z",
      ...overrides,
    };
  }
});
