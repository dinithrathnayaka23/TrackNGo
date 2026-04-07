import type {
  ChatMessage,
  ConversationDto,
  MessageStatus,
  SessionUser,
} from "../types/chat";

export function getOtherParticipant(
  conversation: ConversationDto,
  currentUser: SessionUser,
) {
  const isP1 = conversation.participant1Id === currentUser.userId;
  return isP1
    ? {
        userId: conversation.participant2Id,
        userType: conversation.participant2Type,
      }
    : {
        userId: conversation.participant1Id,
        userType: conversation.participant1Type,
      };
}

export function getRoleLabel(userType: SessionUser["userType"]) {
  if (userType === "CORPORATE_USER") {
    return "Corporate User";
  }
  if (userType === "ADMIN") {
    return "Admin";
  }
  if (userType === "DRIVER") {
    return "Driver";
  }
  return "Passenger";
}

export function getParticipantTitle(
  userType: SessionUser["userType"],
  userId: number,
  fullName?: string | null,
) {
  const role = getRoleLabel(userType);
  const fallbackName =
    userType === "ADMIN" ? "Customer Support" : `User ${userId}`;
  const name = fullName?.trim() ? fullName : fallbackName;

  if (userType === "ADMIN") {
    return `${role} - ${name}`;
  }
  if (userType === "CORPORATE_USER") {
    return `${role} - ${name}`;
  }
  return `${role} - ${name}`;
}

export function formatConversationPreview(conversation: ConversationDto) {
  if (!conversation.lastMessage) {
    return "No messages yet";
  }
  if (conversation.lastMessageType === "IMAGE") {
    return "Photo";
  }
  if (conversation.lastMessageType === "VOICE") {
    return "Voice message";
  }
  return conversation.lastMessage;
}

export function formatTime(iso?: string | null) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDayLabel(iso?: string | null) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) {
    return "Today";
  }
  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }
  return date.toLocaleDateString();
}

export function mergeMessage(existing: ChatMessage[], incoming: ChatMessage) {
  const id = incoming.messageId;
  const clientId = incoming.clientMessageId;
  const matchIndex = existing.findIndex((item) => {
    if (id && item.messageId === id) {
      return true;
    }
    return !!clientId && item.clientMessageId === clientId;
  });

  if (matchIndex >= 0) {
    const clone = [...existing];
    clone[matchIndex] = { ...clone[matchIndex], ...incoming };
    return clone;
  }
  return [incoming, ...existing];
}

export function applyStatusUpdates(
  messages: ChatMessage[],
  updates: Array<{ messageId: number; status: MessageStatus }>,
) {
  if (!updates.length) {
    return messages;
  }

  const byId = new Map<number, MessageStatus>();
  updates.forEach((item) => byId.set(item.messageId, item.status));

  return messages.map((message) => {
    if (!message.messageId) {
      return message;
    }
    const status = byId.get(message.messageId);
    return status ? { ...message, status } : message;
  });
}

export function statusTick(status?: MessageStatus) {
  if (status === "READ") {
    return { text: "✓✓", color: "#1e88e5" };
  }
  if (status === "DELIVERED") {
    return { text: "✓✓", color: "#9aa6b2" };
  }
  return { text: "✓", color: "#9aa6b2" };
}
