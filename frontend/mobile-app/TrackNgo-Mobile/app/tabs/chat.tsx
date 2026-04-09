import React from "react";
import { ChatListScreen } from "../../screens/chat/ChatListScreen";
import { UserSelectScreen } from "../../screens/auth/UserSelectScreen";
import { useNavigationAdapter } from "../../navigation/navigationAdapter";
import { useSession } from "../../store/sessionStore";

export default function ChatTab() {
  const navigation = useNavigationAdapter();
  const { currentUser, loading } = useSession();

  if (loading) {
    return null;
  }

  if (!currentUser) {
    return (
      <UserSelectScreen
        navigation={navigation as any}
        route={{ name: "UserSelect", params: undefined } as any}
      />
    );
  }

  return (
    <ChatListScreen
      navigation={navigation as any}
      route={{ name: "ChatList", params: undefined } as any}
    />
  );
}
