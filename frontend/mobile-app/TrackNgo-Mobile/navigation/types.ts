import type { UserType } from "../types/chat";

export type RootStackParamList = {
  Dashboard: undefined;
  UserSelect: undefined;
  Notification: undefined;
  Sos: undefined;
  EmergencyContacts: undefined;
  ChatList: undefined;
  ChatRoom: {
    conversationId: number;
    otherUserId: number;
    otherUserType: UserType;
  };
};
