import React from "react";
import { ChatListScreen } from "../../screens/chat/ChatListScreen";
import { useNavigationAdapter } from "../../navigation/navigationAdapter";

export default function ChatTab() {
  const navigation = useNavigationAdapter();
  return (
    <ChatListScreen
      navigation={navigation as any}
      route={{ name: "ChatList", params: undefined } as any}
    />
  );
}
