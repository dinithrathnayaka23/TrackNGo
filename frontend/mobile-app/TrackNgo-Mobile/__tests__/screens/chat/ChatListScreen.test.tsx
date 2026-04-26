import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useFocusEffect } from "expo-router";
import { ChatListScreen } from "../../../screens/chat/ChatListScreen";
import {
  createConversation,
  getPresenceSnapshot,
  getUserConversations,
} from "../../../services/chatApi";
import { chatSocket } from "../../../services/chatSocket";
import { getUserProfile } from "../../../services/userProfileApi";
import { useSession } from "../../../store/sessionStore";
import type {
  ConversationDto,
  PagedResponse,
  PresenceUpdate,
  UserProfile,
} from "../../../types/chat";

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn((callback: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(() => callback(), [callback]);
  }),
}));

jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return ({ name }: { name: string }) => React.createElement(Text, null, name);
});

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, null, children);
  },
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../../../services/chatApi", () => ({
  createConversation: jest.fn(),
  getPresenceSnapshot: jest.fn(),
  getUserConversations: jest.fn(),
}));

jest.mock("../../../services/chatSocket", () => ({
  chatSocket: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    subscribePresence: jest.fn(),
    subscribeConversation: jest.fn(),
  },
}));

jest.mock("../../../services/userProfileApi", () => ({
  getUserProfile: jest.fn(),
}));

jest.mock("../../../store/sessionStore", () => ({
  useSession: jest.fn(),
}));

const mockedUseFocusEffect = useFocusEffect as jest.MockedFunction<
  typeof useFocusEffect
>;
const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedGetUserConversations = getUserConversations as jest.MockedFunction<
  typeof getUserConversations
>;
const mockedCreateConversation = createConversation as jest.MockedFunction<
  typeof createConversation
>;
const mockedGetPresenceSnapshot = getPresenceSnapshot as jest.MockedFunction<
  typeof getPresenceSnapshot
>;
const mockedGetUserProfile = getUserProfile as jest.MockedFunction<
  typeof getUserProfile
>;
const mockedChatSocket = chatSocket as jest.Mocked<typeof chatSocket>;

describe("ChatListScreen", () => {
  const navigation = {
    navigate: jest.fn(),
    replace: jest.fn(),
  };

  const unsubscribePresence = jest.fn();
  const unsubscribeConversation = jest.fn();
  const conversations = [
    buildConversation({
      conversationId: 100,
      participant2Id: 1,
      participant2Type: "ADMIN",
      lastMessage: "How can I help today?",
      lastMessageTimestamp: "2026-04-26T10:00:00Z",
    }),
    buildConversation({
      conversationId: 200,
      participant2Id: 22,
      participant2Type: "DRIVER",
      participant1Unread: 2,
      lastMessage: "I am reaching the stop now.",
      lastMessageTimestamp: "2026-04-26T11:00:00Z",
    }),
    buildConversation({
      conversationId: 300,
      participant2Id: 33,
      participant2Type: "CORPORATE_USER",
      lastMessage: "Pickup confirmed for the office trip.",
      lastMessageTimestamp: "2026-04-25T09:00:00Z",
    }),
  ];

  const profilesById: Record<number, UserProfile> = {
    1: buildProfile({
      userId: 1,
      fullName: "Support Admin",
      userType: "ADMIN",
    }),
    22: buildProfile({
      userId: 22,
      fullName: "Kasun Driver",
      userType: "DRIVER",
    }),
    33: buildProfile({
      userId: 33,
      fullName: "Nadeesha Perera",
      companyName: "Northline Logistics",
      contactPersonName: "Nadeesha Perera",
      userType: "CORPORATE_USER",
    }),
  };

  /** Resets chat-list mocks and applies a stable passenger session before each test. */
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseFocusEffect.mockImplementation(
      (callback: () => void | (() => void)) => {
        const React = require("react");
        React.useEffect(() => callback(), [callback]);
      },
    );
    mockedUseSession.mockReturnValue({
      currentUser: { userId: 15, userType: "PASSENGER" },
      loading: false,
      setCurrentUser: jest.fn(),
      clearCurrentUser: jest.fn(),
    } as never);
    mockedGetUserConversations.mockResolvedValue(buildPage(conversations));
    mockedCreateConversation.mockResolvedValue(conversations[0]);
    mockedGetPresenceSnapshot.mockResolvedValue({
      userId: 1,
      online: true,
      onlineUserIds: [1, 22],
    } as PresenceUpdate);
    mockedGetUserProfile.mockImplementation(async (userId: number) => {
      return profilesById[userId];
    });
    mockedChatSocket.subscribePresence.mockReturnValue(unsubscribePresence);
    mockedChatSocket.subscribeConversation.mockReturnValue(
      unsubscribeConversation,
    );
    jest.spyOn(console, "log").mockImplementation(jest.fn());
    jest.spyOn(console, "error").mockImplementation(jest.fn());
  });

  /** Restores runtime spies after each chat-list test completes. */
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Verifies that the chat list loads conversations, profile labels, and websocket subscriptions. */
  it("loads and renders conversations with profile-based labels", async () => {
    const { getByText } = render(
      <ChatListScreen
        navigation={navigation as never}
        route={{ key: "1", name: "ChatList" } as never}
      />,
    );

    await waitFor(() =>
      expect(mockedGetUserConversations).toHaveBeenCalledWith({
        userId: 15,
        page: 0,
        size: 20,
      }),
    );

    await waitFor(() =>
    expect(getByText("Customer Support - Admin")).toBeTruthy(),
    );

    expect(getByText("Kasun Driver - Driver")).toBeTruthy();
    expect(getByText("Nadeesha Perera - Northline Logistics")).toBeTruthy();
    expect(getByText("I am reaching the stop now.")).toBeTruthy();
    expect(mockedChatSocket.connect).toHaveBeenCalledWith(15);
    expect(mockedChatSocket.subscribePresence).toHaveBeenCalled();
    expect(
      mockedChatSocket.subscribeConversation.mock.calls.map((call) => call[0]),
    ).toEqual(expect.arrayContaining([100, 200, 300]));
  });

  /** Verifies that chat-list search reloads conversations and keeps only matching rows plus support. */
  it("filters the visible conversations using the search query", async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <ChatListScreen
        navigation={navigation as never}
        route={{ key: "1", name: "ChatList" } as never}
      />,
    );

    await waitFor(() => expect(mockedGetUserConversations).toHaveBeenCalled());

    fireEvent.changeText(
      getByPlaceholderText("Search by name or message..."),
      "driver",
    );

    await waitFor(() =>
      expect(mockedGetUserConversations).toHaveBeenCalledWith({
        userId: 15,
        page: 0,
        size: 100,
      }),
    );

    expect(getByText("Customer Support - Admin")).toBeTruthy();
    expect(getByText("Kasun Driver - Driver")).toBeTruthy();
    await waitFor(() =>
      expect(
        queryByText("Nadeesha Perera - Northline Logistics"),
      ).toBeNull(),
    );
  });

  /** Verifies that tapping a conversation opens the chat room with the correct participant details. */
  it("navigates to the chat room when a conversation row is pressed", async () => {
    const { getByTestId } = render(
      <ChatListScreen
        navigation={navigation as never}
        route={{ key: "1", name: "ChatList" } as never}
      />,
    );

    await waitFor(() => expect(getByTestId("conversation-200")).toBeTruthy());

    fireEvent.press(getByTestId("conversation-200"));

    expect(navigation.navigate).toHaveBeenCalledWith("ChatRoom", {
      conversationId: 200,
      otherUserId: 22,
      otherUserType: "DRIVER",
    });
  });

  /** Builds a representative paged conversation response for the chat-list API mock. */
  function buildPage(
    content: ConversationDto[],
  ): PagedResponse<ConversationDto> {
    return {
      content,
      page: 0,
      size: 20,
      totalElements: content.length,
      totalPages: 1,
      last: true,
    };
  }

  /** Builds a realistic conversation DTO with passenger-owned defaults. */
  function buildConversation(
    overrides: Partial<ConversationDto>,
  ): ConversationDto {
    return {
      conversationId: 1,
      participant1Id: 15,
      participant2Id: 22,
      participant1Type: "PASSENGER",
      participant2Type: "DRIVER",
      participant1Unread: 0,
      participant2Unread: 0,
      lastMessage: "Hello",
      lastMessageType: "TEXT",
      lastMessageTimestamp: "2026-04-26T09:00:00Z",
      ...overrides,
    };
  }

  /** Builds a representative participant profile used by chat-list title mapping. */
  function buildProfile(overrides: Partial<UserProfile>): UserProfile {
    return {
      userId: 22,
      fullName: "TrackNGo User",
      phoneNumber: null,
      email: "user@example.com",
      profilePhoto: null,
      companyName: null,
      contactPersonName: null,
      userType: "PASSENGER",
      ...overrides,
    };
  }
});
