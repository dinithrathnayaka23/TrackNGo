import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ChatMessage } from "../types/chat";
import { resolveAssetUrl } from "../utils/media";
import { formatTime, statusTick } from "../utils/chat";

interface Props {
  message: ChatMessage;
  isOutgoing: boolean;
  canDelete: boolean;
  onPressAudio: (url: string) => void;
  onLongPressDelete: () => void;
}

export function MessageBubble({
  message,
  isOutgoing,
  canDelete,
  onPressAudio,
  onLongPressDelete,
}: Props) {
  const isDeleted = message.deleted === true;
  const isImage =
    !isDeleted && message.messageType === "IMAGE" && !!message.mediaUrl;
  const isAudio =
    !isDeleted && message.messageType === "VOICE" && !!message.mediaUrl;
  const resolvedMediaUrl = resolveAssetUrl(message.mediaUrl);
  const ticks = statusTick(message.status);

  return (
    <View
      style={[styles.row, isOutgoing ? styles.rowOutgoing : styles.rowIncoming]}
    >
      <View style={styles.group}>
        <Pressable
          style={[
            styles.bubble,
            isOutgoing ? styles.outgoing : styles.incoming,
          ]}
          disabled={!canDelete}
          onLongPress={onLongPressDelete}
          delayLongPress={250}
        >
          {isImage ? (
            <Image
              source={{ uri: resolvedMediaUrl! }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : null}
          {isAudio ? (
            <Pressable
              style={[
                styles.audioRow,
                isOutgoing ? styles.audioOut : styles.audioIn,
              ]}
              onPress={() => onPressAudio(resolvedMediaUrl!)}
            >
              <Text
                style={[
                  styles.playLabel,
                  isOutgoing ? styles.playOut : styles.playIn,
                ]}
              >
                Play voice message
              </Text>
              <Text
                style={[
                  styles.duration,
                  isOutgoing ? styles.playOut : styles.playIn,
                ]}
              >
                {message.durationSeconds
                  ? `${Math.round(message.durationSeconds)}s`
                  : ""}
              </Text>
            </Pressable>
          ) : null}
          {isDeleted ? (
            <Text
              style={[
                styles.deletedText,
                isOutgoing ? styles.contentOut : styles.contentIn,
              ]}
            >
              Message deleted
            </Text>
          ) : null}
          {!isDeleted && message.content ? (
            <Text
              style={[
                styles.content,
                isOutgoing ? styles.contentOut : styles.contentIn,
              ]}
            >
              {message.content}
            </Text>
          ) : null}
        </Pressable>
        <View
          style={[
            styles.footer,
            isOutgoing ? styles.footerOutgoing : styles.footerIncoming,
          ]}
        >
          <Text style={styles.time}>{formatTime(message.createdAt)}</Text>
          {isOutgoing ? (
            <Text style={[styles.tick, { color: ticks.color }]}>
              {ticks.text}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: 5,
    paddingHorizontal: 10,
  },
  rowOutgoing: {
    alignItems: "flex-end",
  },
  rowIncoming: {
    alignItems: "flex-start",
  },
  group: {
    maxWidth: "82%",
  },
  bubble: {
    borderRadius: 22,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  outgoing: {
    backgroundColor: "#1d82e8",
  },
  incoming: {
    backgroundColor: "#f0f3f7",
  },
  content: {
    fontSize: 14,
    lineHeight: 22,
  },
  deletedText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  contentOut: {
    color: "#fff",
  },
  contentIn: {
    color: "#263545",
  },
  image: {
    width: 230,
    height: 180,
    borderRadius: 10,
    marginBottom: 7,
  },
  audioRow: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  audioOut: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  audioIn: {
    backgroundColor: "#dce5ef",
  },
  playLabel: {
    fontWeight: "700",
  },
  playOut: {
    color: "#f1f6ff",
  },
  playIn: {
    color: "#223447",
  },
  duration: {
    marginTop: 2,
    fontSize: 12,
  },
  footer: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerOutgoing: {
    justifyContent: "flex-end",
    alignSelf: "flex-end",
  },
  footerIncoming: {
    justifyContent: "flex-start",
    alignSelf: "flex-start",
  },
  time: {
    fontSize: 13,
    color: "#94A3B8",
  },
  tick: {
    fontSize: 12,
    fontWeight: "700",
  },
});
