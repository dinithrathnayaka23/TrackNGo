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

export async function getPresenceSnapshot() {
  return httpGet<PresenceUpdate>("/api/chat/presence");
}

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

export async function deleteMessage(params: {
  messageId: number;
  userId: number;
}): Promise<MessageDeleteEvent> {
  const { messageId, userId } = params;
  return httpDelete<MessageDeleteEvent>(`/api/messages/${messageId}`, {
    userId,
  });
}
