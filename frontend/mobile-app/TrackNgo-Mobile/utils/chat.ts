import type {
  ChatMessage,
  ConversationDto,
  MessageStatus,
  SessionUser,
  UserProfile,
} from "../types/chat";

type ParticipantProfileFields = {
  fullName?: string | null;
  profilePhoto?: string | null;
  companyName?: string | null;
  contactPersonName?: string | null;
  userType?: SessionUser["userType"] | null;
};

type ParticipantProfileLike =
  | ParticipantProfileFields
  | string
  | null
  | undefined;

// Trims optional profile values and treats blank strings as missing data.
function cleanValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// Normalizes flexible profile inputs into one shared participant shape.
function toProfileLike(profile?: ParticipantProfileLike) {
  if (typeof profile === "string") {
    return {
      fullName: profile,
      profilePhoto: null,
      companyName: null,
      contactPersonName: null,
      userType: null,
    };
  }
  return profile ?? null;
}

// Returns the participant on the other side of a two-user conversation.
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

// Maps internal user-type values into readable labels for the UI.
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

// Prefers the user type found in the participant profile when it is available.
export function resolveParticipantUserType(
  userType: SessionUser["userType"],
  profile?: ParticipantProfileLike,
): SessionUser["userType"] {
  const profileLike = toProfileLike(profile);
  const profileUserType = profileLike?.userType;

  if (profileUserType === "ADMIN") {
    return "ADMIN";
  }
  if (profileUserType === "DRIVER") {
    return "DRIVER";
  }
  if (profileUserType === "CORPORATE_USER") {
    return "CORPORATE_USER";
  }
  if (profileUserType === "PASSENGER") {
    return "PASSENGER";
  }

  return userType;
}

// Builds the title shown for a participant in chat headers and list rows.
export function getParticipantTitle(
  userType: SessionUser["userType"],
  userId: number,
  profile?: ParticipantProfileLike,
) {
  const profileLike = toProfileLike(profile);
  const resolvedUserType = resolveParticipantUserType(userType, profileLike);
  const fullName = cleanValue(profileLike?.fullName);
  const companyName = cleanValue(profileLike?.companyName);
  const contactPersonName = cleanValue(profileLike?.contactPersonName);
  const personName = fullName ?? `User ${userId}`;
  const corporateContactName =
    contactPersonName ?? fullName ?? `User ${userId}`;
  const corporateCompanyName = companyName ?? "Company";

  if (resolvedUserType === "ADMIN") {
    return "Customer Support - Admin";
  }

  if (resolvedUserType === "PASSENGER") {
    return `${personName} - Passenger`;
  }

  if (resolvedUserType === "DRIVER") {
    return `${personName} - Driver`;
  }

  if (resolvedUserType === "CORPORATE_USER") {
    return `${corporateContactName} - ${corporateCompanyName}`;
  }

  return `${personName} - ${getRoleLabel(resolvedUserType)}`;
}

// Chooses the fallback avatar letter when no participant image exists.
export function getParticipantAvatarFallback(
  userType: SessionUser["userType"],
  profile?: ParticipantProfileLike,
) {
  const resolvedUserType = resolveParticipantUserType(userType, profile);

  if (resolvedUserType === "ADMIN") {
    return "A";
  }
  if (resolvedUserType === "DRIVER") {
    return "D";
  }
  if (resolvedUserType === "CORPORATE_USER") {
    return "C";
  }

  return "P";
}

// Returns a cleaned avatar URL for the participant profile when present.
export function getParticipantAvatarUri(
  profile?: Pick<UserProfile, "profilePhoto"> | null,
) {
  return cleanValue(profile?.profilePhoto) ?? null;
}

// Converts the latest-message metadata into a short conversation preview.
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
  if (conversation.lastMessageType === "LOCATION") {
    return "Shared location";
  }
  return conversation.lastMessage;
}

// Formats an ISO timestamp into a short local time label for chat UI.
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

// Maps a timestamp into Today, Yesterday, or a local calendar date label.
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

// Inserts or replaces a message in local state using server or client ids.
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

// Applies delivery and read-status updates to the matching local messages.
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

// Maps a message status into the tick text and color shown in the UI.
export function statusTick(status?: MessageStatus) {
  if (status === "READ") {
    return { text: "✓✓", color: "#1e88e5" };
  }
  if (status === "DELIVERED") {
    return { text: "✓✓", color: "#9aa6b2" };
  }
  return { text: "✓", color: "#9aa6b2" };
}
