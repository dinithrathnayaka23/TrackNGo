import React from "react";

jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return ({ name }: { name: string }) => React.createElement(Text, null, name);
});

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
  CameraType: { back: "back" },
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: "high" },
}));

jest.mock("expo-av", () => ({
  Audio: {
    Recording: jest.fn(),
    Sound: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(),
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, null, children);
  },
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../../../components/ImageViewerModal", () => ({
  ImageViewerModal: () => null,
}));

jest.mock("../../../services/chatApi", () => ({
  deleteMessage: jest.fn(),
  getPresenceSnapshot: jest.fn(),
  getConversationMessages: jest.fn(),
  markConversationDelivered: jest.fn(),
  markConversationRead: jest.fn(),
  sendConversationMessage: jest.fn(),
  uploadMedia: jest.fn(),
}));

jest.mock("../../../services/chatSocket", () => ({
  chatSocket: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    publishMessage: jest.fn(),
    publishTyping: jest.fn(),
    subscribePresence: jest.fn(() => jest.fn()),
    subscribeConversation: jest.fn(() => jest.fn()),
  },
}));

jest.mock("../../../services/userProfileApi", () => ({
  getUserProfile: jest.fn(),
}));

jest.mock("../../../store/sessionStore", () => ({
  useSession: jest.fn(() => ({
    currentUser: null,
    loading: false,
    setCurrentUser: jest.fn(),
    clearCurrentUser: jest.fn(),
  })),
}));

import {
  buildOutgoingMessage,
  formatDuration,
  mostAdvancedStatus,
  presenceListHasUser,
  sameUserId,
} from "../../../screens/chat/ChatRoomScreen";

describe("ChatRoomScreen helpers", () => {
  /** Freezes the system clock so helper-generated timestamps are deterministic. */
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-04-26T10:00:00Z"));
  });

  /** Restores real timers after each helper test completes. */
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /** Verifies that user-id comparison handles number and string payload values consistently. */
  it("sameUserId compares numeric and string websocket ids safely", () => {
    expect(sameUserId(15, "15")).toBe(true);
    expect(sameUserId("22", 15)).toBe(false);
    expect(sameUserId(undefined, 15)).toBe(false);
  });

  /** Verifies that presence snapshots detect whether the other participant is online. */
  it("presenceListHasUser checks the online-user snapshot", () => {
    expect(presenceListHasUser([1, 15, 22], 22)).toBe(true);
    expect(presenceListHasUser([1, 15], 22)).toBe(false);
    expect(presenceListHasUser(undefined, 22)).toBe(false);
  });

  /** Verifies that voice-message durations are formatted into minute-second labels. */
  it("formatDuration returns the voice-message timer label", () => {
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(125)).toBe("2:05");
    expect(formatDuration(null)).toBe("0:00");
  });

  /** Verifies that status comparison keeps the furthest delivery state for a message. */
  it("mostAdvancedStatus keeps the highest delivery rank", () => {
    expect(mostAdvancedStatus("SENT", "DELIVERED")).toBe("DELIVERED");
    expect(mostAdvancedStatus("READ", "DELIVERED")).toBe("READ");
    expect(mostAdvancedStatus(undefined, "SENT")).toBe("SENT");
  });

  /** Verifies that optimistic outgoing messages include the expected defaults and metadata. */
  it("buildOutgoingMessage creates the local pending message payload", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.5);

    const message = buildOutgoingMessage({
      conversationId: 88,
      senderId: 15,
      senderType: "PASSENGER",
      recipientId: 22,
      content: "I am at the stop.",
      messageType: "TEXT",
    });

    expect(message).toMatchObject({
      conversationId: 88,
      senderId: 15,
      recipientId: 22,
      senderType: "PASSENGER",
      content: "I am at the stop.",
      messageType: "TEXT",
      status: "SENT",
      mediaUrl: null,
      durationSeconds: null,
      latitude: null,
      longitude: null,
      createdAt: "2026-04-26T10:00:00.000Z",
    });
    expect(message.clientMessageId).toMatch(/^client-\d+-[0-9a-f]+$/);
  });
});
