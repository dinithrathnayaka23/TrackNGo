import { Redirect, useLocalSearchParams } from "expo-router";

export default function ChatThreadRoute() {
  const params = useLocalSearchParams();
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, String(item)));
    } else if (value !== undefined) {
      query.set(key, String(value));
    }
  });
  const suffix = query.toString();
  return <Redirect href={`/chat/chat-room${suffix ? `?${suffix}` : ""}`} />;
}
