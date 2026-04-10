import React from "react";
import { SosScreen } from "../../screens/sos/SosScreen";
import { useNavigationAdapter } from "../../navigation/navigationAdapter";

export default function SosRoute() {
  const navigation = useNavigationAdapter();
  return (
    <SosScreen
      navigation={navigation as any}
      route={{ name: "Sos", params: undefined } as any}
    />
  );
}
