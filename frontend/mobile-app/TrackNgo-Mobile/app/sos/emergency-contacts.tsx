import React from "react";
import { EmergencyContactsScreen } from "../../screens/sos/EmergencyContactsScreen";
import { useNavigationAdapter } from "../../navigation/navigationAdapter";

export default function EmergencyContactsRoute() {
  const navigation = useNavigationAdapter();
  return (
    <EmergencyContactsScreen
      navigation={navigation as any}
      route={{ name: "EmergencyContacts", params: undefined } as any}
    />
  );
}
