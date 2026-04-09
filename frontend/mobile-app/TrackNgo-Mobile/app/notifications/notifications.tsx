import React from "react";
import { NotificationScreen } from "../../screens/notifications/NotificationScreen";
import { useNavigationAdapter } from "../../navigation/navigationAdapter";

export default function NotificationsRoute() {
  const navigation = useNavigationAdapter();
  return (
    <NotificationScreen
      navigation={navigation as any}
      route={{ name: "Notification", params: undefined } as any}
    />
  );
}
