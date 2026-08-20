const SUPPORT_ADMIN_ID = Number(import.meta.env.VITE_ADMIN_SUPPORT_USER_ID ?? '1')

export type UserType = 'PASSENGER' | 'DRIVER' | 'ADMIN' | 'CORPORATE_USER' | 'CORPORATE'
export type MessageType = 'TEXT' | 'IMAGE' | 'VOICE' | 'LOCATION' | 'SYSTEM'
export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ'

export type PagedResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export type ConversationDto = {
  conversationId: number
  participant1Id: number
  participant2Id: number
  participant1Type: UserType
  participant2Type: UserType
  participant1Unread: number
  participant2Unread: number
  lastMessage: string | null
  lastMessageType: MessageType | null
  lastMessageTimestamp: string | null
}

export type ChatMessage = {
  messageId?: number
  conversationId?: number
  senderId: number
  recipientId?: number
  senderType?: UserType
  content: string
  messageType?: MessageType
  status?: MessageStatus
  clientMessageId?: string
  mediaUrl: string | null
  compressedMediaUrl: string | null
  fileName: string | null
  mediaMimeType: string | null
  mediaSizeBytes: number | null
  compressedSizeBytes: number | null
  durationSeconds: number | null
  latitude: number | null
  longitude: number | null
  readByParticipant1?: boolean
  readByParticipant2?: boolean
  createdAt?: string
  deleted?: boolean
}

export type MessageDeleteEvent = {
  conversationId: number
  messageId: number
  deletedByUserId: number
  deletedAt: string
}

export type MessageStatusUpdate = {
  conversationId: number
  messageId: number
  status: MessageStatus
}

export type PresenceUpdate = {
  userId: number
  online: boolean
  onlineUserIds?: number[]
}

export type TypingIndicator = {
  conversationId: number
  userId: number
  typing: boolean
}

export type UserProfile = {
  userId: number
  fullName: string | null
  phoneNumber: string | null
  email: string | null
  profilePhoto: string | null
  companyName?: string | null
  contactPersonName?: string | null
  userType: UserType
}

export type UploadedChatMedia = {
  fileName: string
  mediaUrl: string
  mimeType: string
  sizeBytes: number
}

// Appends query-string values while skipping missing search or paging inputs.
export function appendChatQuery(
  path: string,
  query?: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams()
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  })
  const suffix = params.toString()
  return suffix ? `${path}?${suffix}` : path
}

// Unwraps JSON responses and throws readable errors for failed admin chat requests.
async function fetchChatJson<T>(
  path: string,
  options?: RequestInit,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const response = await fetch(appendChatQuery(path, query), {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Request failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}

// Reads the unread counter belonging to the support-admin side of a conversation.
export function getSupportUnread(conversation: ConversationDto) {
  if (conversation.participant1Id === SUPPORT_ADMIN_ID) {
    return conversation.participant1Unread ?? 0
  }
  if (conversation.participant2Id === SUPPORT_ADMIN_ID) {
    return conversation.participant2Unread ?? 0
  }
  return 0
}

// Totals unread support messages across the inbox, for the sidebar chat badge.
export async function fetchSupportUnreadTotal() {
  const response = await fetchSupportConversations({ page: 0, size: 50 })
  const conversations = Array.isArray(response?.content) ? response.content : []
  return conversations.reduce(
    (sum, conversation) => sum + getSupportUnread(conversation),
    0,
  )
}

// Loads the admin support inbox conversations shown in the left-hand chat list.
export async function fetchSupportConversations(params: {
  page?: number
  size?: number
  q?: string
}) {
  return fetchChatJson<PagedResponse<ConversationDto>>(
    '/api/admin/support/conversations',
    undefined,
    {
      supportAdminId: SUPPORT_ADMIN_ID,
      page: params.page ?? 0,
      size: params.size ?? 40,
      q: params.q,
    },
  )
}

// Loads the latest message page for the selected support conversation.
export async function fetchConversationMessages(conversationId: number) {
  return fetchChatJson<PagedResponse<ChatMessage>>(
    `/api/conversations/${conversationId}/messages`,
    undefined,
    { page: 0, size: 80 },
  )
}

// Sends a support-admin message payload to the selected conversation thread.
export async function sendConversationMessage(
  conversationId: number,
  message: ChatMessage,
) {
  return fetchChatJson<ChatMessage>(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(message),
  })
}

// Marks the selected support conversation as read for the support admin user.
export async function markConversationRead(conversationId: number) {
  return fetchChatJson<MessageStatusUpdate[]>(
    `/api/conversations/${conversationId}/read`,
    { method: 'POST' },
    { userId: SUPPORT_ADMIN_ID },
  )
}

// Deletes a support-admin message using the backend delete endpoint.
export async function deleteConversationMessage(messageId: number) {
  return fetchChatJson<MessageDeleteEvent>(
    `/api/messages/${messageId}`,
    { method: 'DELETE' },
    { userId: SUPPORT_ADMIN_ID },
  )
}

// Retrieves the current online-user snapshot for the admin chat presence badges.
export async function fetchPresenceSnapshot() {
  return fetchChatJson<PresenceUpdate>('/api/chat/presence')
}

// Loads the profile data needed to label chat participants in the admin inbox.
export async function fetchChatUserProfile(userId: number) {
  return fetchChatJson<UserProfile>(`/api/users/${userId}/profile`)
}

// Uploads image or audio attachments before they are sent through chat.
export async function uploadChatMedia(file: File) {
  const form = new FormData()
  form.append('file', file)

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return response.json() as Promise<UploadedChatMedia>
}
