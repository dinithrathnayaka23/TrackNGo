import type {
  ChatMessage,
  ConversationDto,
  MediaUploadResponse,
  MessageDeleteEvent,
  MessageStatusUpdate,
  PagedResponse,
  PresenceUpdate,
} from "../types/chat";
import { httpDelete, httpGet, httpPost, httpPostForm } from "./http";

// Loads one paged slice of the current user's conversations for the chat list.
export async function getUserConversations(params: {
  userId: number;
  page?: number;
  size?: number;
  q?: string;
}) {
  const { userId, page = 0, size = 20, q } = params;
  return httpGet<PagedResponse<ConversationDto>>(
    `/api/users/${userId}/conversations`,
    {
      page,
      size,
      q,
    },
  );
}

// Creates or returns the shared conversation between two users.
export async function createConversation(params: {
  user1Id: number;
  user2Id: number;
}) {
  const { user1Id, user2Id } = params;
  return httpPost<ConversationDto>("/api/conversations", {
    user1Id,
    user2Id,
  });
}

// Searches the current user's conversations using the provided keyword.
export async function searchUserConversations(params: {
  userId: number;
  q: string;
  page?: number;
  size?: number;
}) {
  const { userId, q, page = 0, size = 20 } = params;
  return httpGet<PagedResponse<ConversationDto>>(
    `/api/users/${userId}/conversations/search`,
    {
      q,
      page,
      size,
    },
  );
}

// Loads one page of messages for a specific conversation thread.
export async function getConversationMessages(params: {
  conversationId: number;
  page?: number;
  size?: number;
  before?: string;
}) {
  const { conversationId, page = 0, size = 30, before } = params;
  return httpGet<PagedResponse<ChatMessage>>(
    `/api/conversations/${conversationId}/messages`,
    {
      page,
      size,
      before,
    },
  );
}

// Sends a new chat message payload to the backend conversation endpoint.
export async function sendConversationMessage(params: {
  conversationId: number;
  message: ChatMessage;
}) {
  const { conversationId, message } = params;
  return httpPost<ChatMessage>(
    `/api/conversations/${conversationId}/messages`,
    undefined,
    message,
  );
}

// Marks unseen messages as delivered for the current conversation participant.
export async function markConversationDelivered(params: {
  conversationId: number;
  userId: number;
}) {
  const { conversationId, userId } = params;
  return httpPost<MessageStatusUpdate[]>(
    `/api/conversations/${conversationId}/delivered`,
    { userId },
  );
}

// Marks unseen messages as read for the current conversation participant.
export async function markConversationRead(params: {
  conversationId: number;
  userId: number;
}) {
  const { conversationId, userId } = params;
  return httpPost<MessageStatusUpdate[]>(
    `/api/conversations/${conversationId}/read`,
    { userId },
  );
}

// Retrieves the latest online-user snapshot used by the chat presence UI.
export async function getPresenceSnapshot() {
  return httpGet<PresenceUpdate>("/api/chat/presence");
}

// Uploads a media file before it is attached to an outgoing chat message.
export async function uploadMedia(params: {
  uri: string;
  fileName: string;
  mimeType: string;
  compressed?: boolean;
}): Promise<MediaUploadResponse> {
  const { uri, fileName, mimeType, compressed = false } = params;
  const formData = new FormData();
  formData.append("file", {
    uri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  return httpPostForm<MediaUploadResponse>("/api/media/upload", formData, {
    compressed,
  });
}

// Deletes a sent chat message on behalf of the requesting user.
export async function deleteMessage(params: {
  messageId: number;
  userId: number;
}): Promise<MessageDeleteEvent> {
  const { messageId, userId } = params;
  return httpDelete<MessageDeleteEvent>(`/api/messages/${messageId}`, {
    userId,
  });
}
