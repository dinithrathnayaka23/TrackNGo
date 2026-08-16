import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import type { ChatMessage } from "../types/chat";
import { resolveAssetUrl } from "../utils/media";
import { LocalizedText as Text } from "../utils/i18n";
import { formatTime, statusTick } from "../utils/chat";

/* ── waveform data ─────────────────────────────────────────────── */
const WAVE_HEIGHTS = [
  4, 8, 5, 12, 7, 16, 10, 20, 14, 8, 18, 11, 6, 15, 9, 20, 13, 7, 17, 10, 5, 14,
  19, 8, 12, 6, 16, 11, 9, 15,
];
const BAR_COUNT = WAVE_HEIGHTS.length;

function formatDuration(seconds?: number | null) {
  const totalSeconds = Math.max(0, Math.round(seconds ?? 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

/* ── animated waveform bar ─────────────────────────────────────── */
function AnimatedBar({
  baseHeight,
  isPlaying,
  delay,
  isOutgoing,
}: {
  baseHeight: number;
  isPlaying: boolean;
  delay: number;
  isOutgoing: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isPlaying) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 300 + delay * 0.4,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
            delay,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 300 + delay * 0.4,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isPlaying, anim, delay]);

  const minH = Math.max(3, baseHeight * 0.3);
  const maxH = Math.min(24, baseHeight * 1.6);
  const height = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [baseHeight, maxH],
  });
  const idleHeight = isPlaying ? height : minH < baseHeight ? baseHeight : minH;

  return (
    <Animated.View
      style={[
        styles.bar,
        { height: idleHeight },
        isOutgoing ? styles.barOut : styles.barIn,
      ]}
    />
  );
}

/* ── props ─────────────────────────────────────────────────────── */
interface Props {
  message: ChatMessage;
  isOutgoing: boolean;
  canDelete: boolean;
  isAudioPlaying?: boolean;
  onPressAudio: (url: string) => void;
  onPressImage?: (url: string) => void;
  onLongPressDelete: () => void;
}

/* ── component ─────────────────────────────────────────────────── */
export function MessageBubble({
  message,
  isOutgoing,
  canDelete,
  isAudioPlaying = false,
  onPressAudio,
  onPressImage,
  onLongPressDelete,
}: Props) {
  const isDeleted = message.deleted === true;
  const isImage =
    !isDeleted && message.messageType === "IMAGE" && !!message.mediaUrl;
  const isAudio =
    !isDeleted && message.messageType === "VOICE" && !!message.mediaUrl;
  const isLocation =
    !isDeleted &&
    message.messageType === "LOCATION" &&
    message.latitude != null &&
    message.longitude != null;
  const hasCaption = isImage && !!message.content;
  const resolvedMediaUrl = resolveAssetUrl(message.mediaUrl);
  const ticks = statusTick(message.status);
  const durationLabel = formatDuration(message.durationSeconds);

  /* ── location renderer ───────────────────────────────────────── */
  const renderLocation = () => {
    const lat = message.latitude!;
    const lng = message.longitude!;
    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=400x200&markers=color:red%7C${lat},${lng}&key=`;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    return (
      <Pressable
        style={[
          styles.locationBubble,
          isOutgoing ? styles.outgoing : styles.incoming,
        ]}
        onPress={() => Linking.openURL(mapsUrl)}
        onLongPress={canDelete ? onLongPressDelete : undefined}
        delayLongPress={250}
      >
        {/* map preview */}
        <View style={styles.locationMapWrap}>
          <Image
            source={{ uri: staticMapUrl }}
            style={styles.locationMap}
            resizeMode="cover"
          />
          {/* fallback pin overlay in case the static map image has no API key */}
          <View style={styles.locationPinOverlay}>
            <Text style={styles.locationPinEmoji}>📍</Text>
          </View>
        </View>

        {/* label + coordinates */}
        <View style={styles.locationInfo}>
          <Text
            style={[
              styles.locationTitle,
              isOutgoing ? styles.contentOut : styles.contentIn,
            ]}
          >
            Shared Location
          </Text>
          <Text
            style={[
              styles.locationCoords,
              isOutgoing ? styles.locationCoordsOut : styles.locationCoordsIn,
            ]}
          >
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </Text>
        </View>

        {/* bottom meta row */}
        <View style={styles.locationMeta}>
          <Text
            style={[
              styles.locationOpenLabel,
              isOutgoing
                ? styles.locationOpenLabelOut
                : styles.locationOpenLabelIn,
            ]}
          >
            Tap to open in Maps
          </Text>
          <View style={styles.voiceMetaRight}>
            <Text
              style={[
                styles.voiceTime,
                isOutgoing ? styles.metaTextOut : styles.metaTextIn,
              ]}
            >
              {formatTime(message.createdAt)}
            </Text>
            {isOutgoing ? (
              <Text style={[styles.voiceTick, { color: ticks.color }]}>
                {ticks.text}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  /* ── voice note renderer ─────────────────────────────────────── */
  const renderVoiceNote = () => (
    <Pressable
      style={[
        styles.voiceBubble,
        isOutgoing ? styles.voiceOut : styles.voiceIn,
      ]}
      onPress={() => onPressAudio(resolvedMediaUrl!)}
      onLongPress={canDelete ? onLongPressDelete : undefined}
      delayLongPress={250}
    >
      {/* row: play button + waveform */}
      <View style={styles.voiceRow}>
        {/* play / pause circle */}
        <View
          style={[
            styles.playCircle,
            isOutgoing ? styles.playCircleOut : styles.playCircleIn,
          ]}
        >
          <Text
            style={[
              styles.playIcon,
              isOutgoing ? styles.playIconOut : styles.playIconIn,
            ]}
          >
            {isAudioPlaying ? "❚❚" : "▶"}
          </Text>
        </View>

        {/* waveform + seekbar */}
        <View style={styles.waveWrap}>
          {/* animated bars */}
          <View style={styles.barsRow}>
            {WAVE_HEIGHTS.map((h, i) => (
              <AnimatedBar
                key={`${message.messageId ?? message.clientMessageId ?? "w"}-${i}`}
                baseHeight={h}
                isPlaying={isAudioPlaying}
                delay={(i % 6) * 50}
                isOutgoing={isOutgoing}
              />
            ))}
          </View>

          {/* seekbar line + thumb */}
          <View style={styles.seekRow}>
            <View
              style={[
                styles.seekLine,
                isOutgoing ? styles.seekLineOut : styles.seekLineIn,
              ]}
            />
            <View
              style={[
                styles.seekThumb,
                isOutgoing ? styles.seekThumbOut : styles.seekThumbIn,
                isAudioPlaying ? styles.seekThumbActive : null,
              ]}
            />
          </View>
        </View>
      </View>

      {/* bottom meta: duration … time + ticks */}
      <View style={styles.voiceMeta}>
        <Text
          style={[
            styles.voiceDuration,
            isOutgoing ? styles.metaTextOut : styles.metaTextIn,
          ]}
        >
          {durationLabel}
        </Text>
        <View style={styles.voiceMetaRight}>
          <Text
            style={[
              styles.voiceTime,
              isOutgoing ? styles.metaTextOut : styles.metaTextIn,
            ]}
          >
            {formatTime(message.createdAt)}
          </Text>
          {isOutgoing ? (
            <Text style={[styles.voiceTick, { color: ticks.color }]}>
              {ticks.text}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );

  /* ── main render ─────────────────────────────────────────────── */
  return (
    <View
      style={[styles.row, isOutgoing ? styles.rowOutgoing : styles.rowIncoming]}
    >
      <View style={styles.group}>
        {isAudio ? (
          renderVoiceNote()
        ) : isLocation ? (
          renderLocation()
        ) : (
          <>
            <Pressable
              style={[
                styles.bubble,
                isOutgoing ? styles.outgoing : styles.incoming,
                isImage ? styles.imageBubble : null,
              ]}
              disabled={!canDelete}
              onLongPress={onLongPressDelete}
              delayLongPress={250}
            >
              {isImage ? (
                <Pressable onPress={() => onPressImage?.(resolvedMediaUrl!)}>
                  <Image
                    source={{ uri: resolvedMediaUrl! }}
                    style={styles.image}
                    resizeMode="cover"
                  />
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
                    hasCaption ? styles.imageCaption : null,
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
          </>
        )}
      </View>
    </View>
  );
}

/* ── styles ────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* layout */
  row: {
    marginVertical: 4,
    paddingHorizontal: 8,
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

  /* ── text / image bubble ──────────────────────────────────────── */
  bubble: {
    borderRadius: 22,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  imageBubble: {
    borderRadius: 18,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  outgoing: {
    backgroundColor: "#1d82e8",
  },
  incoming: {
    backgroundColor: "#dfe1e2",
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
    borderRadius: 14,
    marginBottom: 0,
  },
  imageCaption: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 4,
  },

  /* ── voice note bubble ────────────────────────────────────────── */
  voiceBubble: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    minWidth: 260,
  },
  voiceOut: {
    backgroundColor: "#1d82e8",
  },
  voiceIn: {
    backgroundColor: "#dfe1e2",
  },

  /* top row: play + waveform */
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  /* play / pause circle */
  playCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  playCircleOut: {
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  playCircleIn: {
    backgroundColor: "#fff",
  },
  playIcon: {
    fontSize: 14,
    marginLeft: 2,
    fontWeight: "800",
  },
  playIconOut: {
    color: "#1d82e8",
  },
  playIconIn: {
    color: "#54656f",
  },

  /* waveform wrapper */
  waveWrap: {
    flex: 1,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 24,
    gap: 1.5,
  },
  bar: {
    flex: 1,
    borderRadius: 999,
    minWidth: 2.5,
  },
  barOut: {
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  barIn: {
    backgroundColor: "#8696a0",
  },

  /* seekbar */
  seekRow: {
    marginTop: 4,
    height: 14,
    justifyContent: "center",
  },
  seekLine: {
    height: 2,
    borderRadius: 999,
  },
  seekLineOut: {
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  seekLineIn: {
    backgroundColor: "rgba(84,101,111,0.25)",
  },
  seekThumb: {
    position: "absolute",
    top: 2,
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  seekThumbOut: {
    backgroundColor: "#fff",
  },
  seekThumbIn: {
    backgroundColor: "#54656f",
  },
  seekThumbActive: {
    left: 16,
  },

  /* bottom meta row */
  voiceMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
    paddingLeft: 50,
  },
  voiceMetaRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  voiceDuration: {
    fontSize: 11,
    fontWeight: "500",
  },
  voiceTime: {
    fontSize: 10.5,
  },
  voiceTick: {
    fontSize: 11,
    fontWeight: "700",
  },
  metaTextOut: {
    color: "rgba(255,255,255,0.8)",
  },
  metaTextIn: {
    color: "#667781",
  },

  /* ── shared footer (text / image only) ────────────────────────── */
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

  /* ── location bubble ──────────────────────────────────────────── */
  locationBubble: {
    borderRadius: 18,
    overflow: "hidden",
    minWidth: 240,
  },
  locationMapWrap: {
    width: "100%",
    height: 140,
    backgroundColor: "#c8d6e5",
    position: "relative",
  },
  locationMap: {
    width: "100%",
    height: "100%",
  },
  locationPinOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  locationPinEmoji: {
    fontSize: 32,
  },
  locationInfo: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  locationCoords: {
    fontSize: 11,
    marginTop: 2,
  },
  locationCoordsOut: {
    color: "rgba(255,255,255,0.7)",
  },
  locationCoordsIn: {
    color: "#667781",
  },
  locationMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 4,
  },
  locationOpenLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  locationOpenLabelOut: {
    color: "rgba(255,255,255,0.65)",
  },
  locationOpenLabelIn: {
    color: "#1f8fff",
  },
});
