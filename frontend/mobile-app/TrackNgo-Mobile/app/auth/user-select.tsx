import React from "react";
import { UserSelectScreen } from "../../screens/auth/UserSelectScreen";
import { useNavigationAdapter } from "../../navigation/navigationAdapter";

export default function UserSelectRoute() {
  const navigation = useNavigationAdapter();
  return (
    <UserSelectScreen
      navigation={navigation as any}
      route={{ name: "UserSelect", params: undefined } as any}
    />
  );
}
