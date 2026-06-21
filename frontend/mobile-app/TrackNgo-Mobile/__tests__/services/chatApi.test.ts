import {
  createConversation,
  deleteMessage,
  getConversationMessages,
  getPresenceSnapshot,
  getUserConversations,
  markConversationRead,
  sendConversationMessage,
  uploadMedia,
} from "../../services/chatApi";
import {
  httpDelete,
  httpGet,
  httpPost,
  httpPostForm,
} from "../../services/http";
import type { ChatMessage } from "../../types/chat";

jest.mock("../../services/http", () => ({
  httpDelete: jest.fn(),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  httpPostForm: jest.fn(),
}));

const mockedHttpDelete = httpDelete as jest.MockedFunction<typeof httpDelete>;
const mockedHttpGet = httpGet as jest.MockedFunction<typeof httpGet>;
const mockedHttpPost = httpPost as jest.MockedFunction<typeof httpPost>;
const mockedHttpPostForm = httpPostForm as jest.MockedFunction<
  typeof httpPostForm
>;

describe("chatApi", () => {
  /** Resets chat API mocks before each service-level test. */
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** Verifies that paged conversation loading hits the expected user endpoint and query values. */
  it("getUserConversations forwards the user paging request", async () => {
    mockedHttpGet.mockResolvedValueOnce({ content: [] } as never);

    await getUserConversations({ userId: 15, page: 2, size: 10, q: "driver" });

    expect(mockedHttpGet).toHaveBeenCalledWith("/api/users/15/conversations", {
      page: 2,
      size: 10,
      q: "driver",
    });
  });

  /** Verifies that conversation creation posts the two participant ids to the backend. */
  it("createConversation posts the participant pair", async () => {
    mockedHttpPost.mockResolvedValueOnce({ conversationId: 50 } as never);

    await createConversation({ user1Id: 15, user2Id: 22 });

    expect(mockedHttpPost).toHaveBeenCalledWith("/api/conversations", {
      user1Id: 15,
      user2Id: 22,
    });
  });

  /** Verifies that message loading targets the selected conversation and before cursor. */
  it("getConversationMessages forwards the paging payload", async () => {
    mockedHttpGet.mockResolvedValueOnce({ content: [] } as never);

    await getConversationMessages({
      conversationId: 77,
      page: 1,
      size: 30,
      before: "2026-04-26T08:00:00Z",
    });

    expect(mockedHttpGet).toHaveBeenCalledWith(
      "/api/conversations/77/messages",
      {
        page: 1,
        size: 30,
        before: "2026-04-26T08:00:00Z",
      },
    );
  });

  /** Verifies that sending a message posts the JSON body to the conversation endpoint. */
  it("sendConversationMessage posts the chat message body", async () => {
    const message = buildMessage();
    mockedHttpPost.mockResolvedValueOnce(message as never);

    await sendConversationMessage({ conversationId: 77, message });

    expect(mockedHttpPost).toHaveBeenCalledWith(
      "/api/conversations/77/messages",
      undefined,
      message,
    );
  });

  /** Verifies that message-read requests post the reader id as a query payload. */
  it("markConversationRead posts the user id to the read endpoint", async () => {
    mockedHttpPost.mockResolvedValueOnce([] as never);

    await markConversationRead({ conversationId: 77, userId: 15 });

    expect(mockedHttpPost).toHaveBeenCalledWith("/api/conversations/77/read", {
      userId: 15,
    });
  });

  /** Verifies that media uploads use multipart form submission with the compressed flag. */
  it("uploadMedia sends multipart data to the media endpoint", async () => {
    mockedHttpPostForm.mockResolvedValueOnce({
      mediaUrl: "https://cdn.example.com/chat.jpg",
    } as never);

    await uploadMedia({
      uri: "file:///chat.jpg",
      fileName: "chat.jpg",
      mimeType: "image/jpeg",
      compressed: true,
    });

    expect(mockedHttpPostForm).toHaveBeenCalledWith(
      "/api/media/upload",
      expect.any(FormData),
      { compressed: true },
    );
  });

  /** Verifies that the presence snapshot and delete-message endpoints are routed correctly. */
  it("loads presence and deletes messages using the expected endpoints", async () => {
    mockedHttpGet.mockResolvedValueOnce({
      online: true,
      onlineUserIds: [1, 15],
    } as never);
    mockedHttpDelete.mockResolvedValueOnce({ messageId: 9 } as never);

    await getPresenceSnapshot();
    await deleteMessage({ messageId: 9, userId: 15 });

    expect(mockedHttpGet).toHaveBeenCalledWith("/api/chat/presence");
    expect(mockedHttpDelete).toHaveBeenCalledWith("/api/messages/9", {
      userId: 15,
    });
  });

  /** Builds a representative outgoing chat message payload for service-level assertions. */
  function buildMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
      messageId: 9,
      conversationId: 77,
      senderId: 15,
      recipientId: 22,
      senderType: "PASSENGER",
      content: "Bus is on the way?",
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
