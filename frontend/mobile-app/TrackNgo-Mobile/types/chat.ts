export type UserType = "PASSENGER" | "DRIVER" | "ADMIN" | "CORPORATE_USER";

export type MessageType = "TEXT" | "IMAGE" | "VOICE" | "LOCATION" | "SYSTEM";

export type MessageStatus = "SENT" | "DELIVERED" | "READ";

export interface ConversationDto {
  conversationId: number;
  participant1Id: number;
  participant2Id: number;
  participant1Type: UserType;
  participant2Type: UserType;
  participant1Unread: number;
  participant2Unread: number;
  lastMessage: string | null;
  lastMessageType: MessageType | null;
  lastMessageTimestamp: string | null;
}

export interface ChatMessage {
  messageId?: number;
  conversationId?: number;
  senderId: number;
  recipientId?: number;
  senderType?: UserType;
  content: string;
  messageType?: MessageType;
  status?: MessageStatus;
  clientMessageId?: string;
  mediaUrl: string | null;
  compressedMediaUrl: string | null;
  fileName: string | null;
  mediaMimeType: string | null;
  mediaSizeBytes: number | null;
  compressedSizeBytes: number | null;
  durationSeconds: number | null;
  latitude: number | null;
  longitude: number | null;
  readByParticipant1?: boolean;
  readByParticipant2?: boolean;
  createdAt?: string;
  deliveredAt?: string;
  readAt?: string;
  deleted?: boolean;
}

export interface MessageDeleteEvent {
  conversationId: number;
  messageId: number;
  deletedByUserId: number;
  deletedAt: string;
}

export interface MessageStatusUpdate {
  conversationId: number;
  messageId: number;
  status: MessageStatus;
}

export interface TypingIndicator {
  conversationId: number;
  userId: number;
  typing: boolean;
}

export interface PresenceUpdate {
  userId: number;
  online: boolean;
  onlineUserIds?: number[];
}

export interface MediaUploadResponse {
  fileName: string;
  mediaUrl: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface SessionUser {
  userId: number;
  userType: UserType;
}

export interface UserProfile {
  userId: number;
  fullName: string;
  phoneNumber: string | null;
  email: string | null;
  profilePhoto: string | null;
  companyName?: string | null;
  contactPersonName?: string | null;
  userType: UserType;
}
