import type { UserType } from "../types/chat";

export type RootStackParamList = {
  UserSelect: undefined;
  ChatList: undefined;
  ChatRoom: {
    conversationId: number;
    otherUserId: number;
    otherUserType: UserType;
  };
};
