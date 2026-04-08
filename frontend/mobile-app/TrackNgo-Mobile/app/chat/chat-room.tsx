import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ChatRoomScreen } from "../../screens/chat/ChatRoomScreen";
import { useNavigationAdapter } from "../../navigation/navigationAdapter";

export default function ChatRoomRoute() {
  const navigation = useNavigationAdapter();
  const params = useLocalSearchParams<{
    conversationId?: string;
    otherUserId?: string;
    otherUserType?: string;
  }>();

  const route = {
    params: {
      conversationId: params.conversationId ?? "",
      otherUserId: params.otherUserId ?? "",
      otherUserType: params.otherUserType ?? "",
    },
  };

  return <ChatRoomScreen navigation={navigation as any} route={route as any} />;
}
