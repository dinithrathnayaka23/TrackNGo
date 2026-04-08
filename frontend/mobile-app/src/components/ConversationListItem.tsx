import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ConversationDto, SessionUser, UserProfile } from "../types/chat";
import {
  formatConversationPreview,
  formatDayLabel,
  getParticipantAvatarFallback,
  getParticipantAvatarUri,
  getOtherParticipant,
  getParticipantTitle,
} from "../utils/chat";

interface Props {
  item: ConversationDto;
  currentUser: SessionUser;
  otherProfile?: UserProfile;
  onPress: (conversation: ConversationDto) => void;
}

export function ConversationListItem({
  item,
  currentUser,
  otherProfile,
  onPress,
}: Props) {
  const other = getOtherParticipant(item, currentUser);
  const unread =
    item.participant1Id === currentUser.userId
      ? item.participant1Unread
      : item.participant2Unread;
  const avatarUri = getParticipantAvatarUri(otherProfile);
  const avatarFallback = getParticipantAvatarFallback(
    other.userType,
    otherProfile,
  );

  return (
    <Pressable style={styles.row} onPress={() => onPress(item)}>
      <View style={styles.avatar}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{avatarFallback}</Text>
        )}
      </View>
      <View style={styles.main}>
        <Text style={styles.title}>
          {getParticipantTitle(other.userType, other.userId, otherProfile)}
        </Text>
        <Text numberOfLines={1} style={styles.preview}>
          {formatConversationPreview(item)}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.day}>
          {formatDayLabel(item.lastMessageTimestamp)}
        </Text>
        {unread > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unread}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#d7dde4",
    backgroundColor: "#fff",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2d89ef",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  avatarText: {
    color: "#fff",
    fontWeight: "700",
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  main: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    color: "#1f2a35",
    fontWeight: "700",
  },
  preview: {
    marginTop: 2,
    fontSize: 13,
    color: "#5c6f82",
  },
  meta: {
    alignItems: "flex-end",
    minWidth: 64,
  },
  day: {
    fontSize: 11,
    color: "#7d8fa3",
  },
  unreadBadge: {
    marginTop: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: "#00a874",
    justifyContent: "center",
    alignItems: "center",
  },
  unreadText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
  },
});
