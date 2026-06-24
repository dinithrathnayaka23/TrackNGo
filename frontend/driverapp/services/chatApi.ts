import { apiUrl } from '@/config/env';

export type ChatParticipantType = 'ADMIN' | 'DRIVER' | 'PASSENGER' | 'CORPORATE_USER' | string;
export type ChatMessageType = 'TEXT' | 'IMAGE' | 'VOICE' | 'LOCATION' | 'SYSTEM' | string;
export type ChatMessageStatus = 'SENT' | 'DELIVERED' | 'READ' | string;

export interface ConversationDto {
  conversationId: number;
  participant1Id?: number | null;
  participant2Id?: number | null;
  participant1Type?: ChatParticipantType | null;
  participant2Type?: ChatParticipantType | null;
  otherParticipantId?: number | null;
  otherParticipantName?: string | null;
  otherParticipantType?: ChatParticipantType | null;
  unreadCount?: number;
  participant1Unread?: number;
  participant2Unread?: number;
  lastMessage?: string | null;
  lastMessageType?: string | null;
  lastMessageTimestamp?: string | null;
}

export interface ChatMessageDto {
  messageId?: number;
  conversationId?: number;
  senderId: number;
  recipientId?: number | null;
  senderType: ChatParticipantType;
  content: string;
  messageType: ChatMessageType;
  status?: ChatMessageStatus | null;
  clientMessageId?: string | null;
  mediaUrl?: string | null;
  compressedMediaUrl?: string | null;
  fileName?: string | null;
  mediaMimeType?: string | null;
  mediaSizeBytes?: number | null;
  compressedSizeBytes?: number | null;
  durationSeconds?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  readByParticipant1?: boolean | null;
  readByParticipant2?: boolean | null;
  deleted?: boolean | null;
  createdAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
}

export interface MediaUploadResponse {
  fileName: string;
  mediaUrl: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PagedResponse<T> {
  content?: T[];
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
  last?: boolean;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

async function requestJson<T>(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  return response.json();
}

async function requestForm<T>(
  token: string,
  path: string,
  formData: FormData,
  query?: Record<string, string | number | boolean | undefined | null>
): Promise<T> {
  const queryString = query ? buildQuery(query) : '';
  const response = await fetch(apiUrl(queryString ? `${path}?${queryString}` : path), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Media upload failed: ${response.status}`);
  }

  return response.json();
}

export function getUserConversations(params: {
  token: string;
  userId: number;
  page?: number;
  size?: number;
  q?: string;
}) {
  const { token, userId, page = 0, size = 20, q } = params;
  const query = buildQuery({ page, size, q });
  return requestJson<PagedResponse<ConversationDto>>(
    token,
    `/api/users/${userId}/conversations?${query}`
  );
}

export function createConversation(params: {
  token: string;
  user1Id: number;
  user1Type?: ChatParticipantType;
  user2Id: number;
  user2Type?: ChatParticipantType;
}) {
  const { token, user1Id, user1Type, user2Id, user2Type } = params;
  const query = buildQuery({ user1Id, user1Type, user2Id, user2Type });
  return requestJson<ConversationDto>(token, `/api/conversations?${query}`, {
    method: 'POST',
  });
}

export function getConversationMessages(params: {
  token: string;
  conversationId: number;
  page?: number;
  size?: number;
}) {
  const { token, conversationId, page = 0, size = 50 } = params;
  const query = buildQuery({ page, size });
  return requestJson<PagedResponse<ChatMessageDto>>(
    token,
    `/api/conversations/${conversationId}/messages?${query}`
  );
}

export function sendConversationMessage(params: {
  token: string;
  conversationId: number;
  message: ChatMessageDto;
}) {
  const { token, conversationId, message } = params;
  return requestJson<ChatMessageDto>(
    token,
    `/api/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify(message),
    }
  );
}

export async function markConversationRead(params: {
  token: string;
  conversationId: number;
  userId: number;
}) {
  const { token, conversationId, userId } = params;
  const query = buildQuery({ userId });
  await requestJson<unknown>(token, `/api/conversations/${conversationId}/read?${query}`, {
    method: 'POST',
  });
}

export async function markConversationDelivered(params: {
  token: string;
  conversationId: number;
  userId: number;
}) {
  const { token, conversationId, userId } = params;
  const query = buildQuery({ userId });
  await requestJson<unknown>(token, `/api/conversations/${conversationId}/delivered?${query}`, {
    method: 'POST',
  });
}

export function uploadMedia(params: {
  token: string;
  uri: string;
  fileName: string;
  mimeType: string;
  compressed?: boolean;
}) {
  const { token, uri, fileName, mimeType, compressed = false } = params;
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  return requestForm<MediaUploadResponse>(token, '/api/media/upload', formData, {
    compressed,
  });
}
