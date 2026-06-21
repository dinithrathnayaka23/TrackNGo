import { useRouter } from "expo-router";

type NavigateFn = (name: string, params?: Record<string, string>) => void;

type NavigationAdapter = {
  navigate: NavigateFn;
  goBack: () => void;
  replace: NavigateFn;
};

export function useNavigationAdapter(): NavigationAdapter {
  const router = useRouter();

  const navigate: NavigateFn = (name, params) => {
    switch (name) {
      case "Notification":
        router.push("/notifications/notifications");
        return;
      case "Sos":
        router.push("/sos/sos");
        return;
      case "EmergencyContacts":
        router.push("/sos/emergency-contacts");
        return;
      case "ChatList":
        router.push("/chat/chat-list");
        return;
      case "ChatRoom":
        router.push({
          pathname: "/chat/chat-room",
          params: params ?? {},
        });
        return;
      default:
        router.push("/");
    }
  };

  return {
    navigate,
    goBack: () => router.back(),
    replace: (name, params) => {
      switch (name) {
        case "Notification":
          router.replace("/notifications/notifications");
          return;
        case "Sos":
          router.replace("/sos/sos");
          return;
        case "EmergencyContacts":
          router.replace("/sos/emergency-contacts");
          return;
        case "ChatList":
          router.replace("/chat/chat-list");
          return;
        case "ChatRoom":
          router.replace({
            pathname: "/chat/chat-room",
            params: params ?? {},
          });
          return;
        case "Dashboard":
          router.replace("/tabs");
          return;
        default:
          router.replace("/");
      }
    },
  };
}
