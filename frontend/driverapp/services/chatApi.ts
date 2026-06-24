import { apiUrl } from '@/config/env';

export type ChatParticipantType = 'ADMIN' | 'DRIVER' | 'PASSENGER' | 'CORPORATE_USER' | string;

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
  messageType: string;
  deleted?: boolean | null;
  createdAt?: string | null;
}

export interface PagedResponse<T> {
  content?: T[];
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
  last?: boolean;
}

function buildQuery(params: Record<string, string | number | undefined | null>) {
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
