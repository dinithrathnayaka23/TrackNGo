import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Audio } from "expo-av";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ImageViewerModal } from "../../components/ImageViewerModal";
import type { RootStackParamList } from "../../navigation/types";
import {
  deleteMessage,
  getConversationMessages,
  markConversationDelivered,
  markConversationRead,
  sendConversationMessage,
  uploadMedia,
} from "../../services/chatApi";
import { chatSocket } from "../../services/chatSocket";
import { getUserProfile } from "../../services/userProfileApi";
import { useSession } from "../../store/sessionStore";
import type { ChatMessage, UserProfile, UserType } from "../../types/chat";
import { resolveAssetUrl } from "../../utils/media";
import {
  applyStatusUpdates,
  formatDayLabel,
  formatTime,
  getParticipantAvatarFallback,
  getParticipantAvatarUri,
  getParticipantTitle,
  mergeMessage,
} from "../../utils/chat";

type Props = NativeStackScreenProps<RootStackParamList, "ChatRoom">;

type ChatRoomListItem =
  | {
      type: "message";
      key: string;
      message: ChatMessage;
    }
  | {
      type: "separator";
      key: string;
      label: string;
    };

function formatDuration(seconds?: number | null) {
  const totalSeconds = Math.max(0, Math.round(seconds ?? 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getImageTag(message: ChatMessage) {
  if (message.fileName?.trim()) {
    return message.fileName.trim();
  }
  if (message.content.trim()) {
    return message.content.trim();
  }
  return "Photo";
}

function buildOutgoingMessage(params: {
  conversationId: number;
  senderId: number;
  senderType: "PASSENGER" | "DRIVER" | "ADMIN" | "CORPORATE_USER";
  recipientId: number;
  content: string;
  messageType: "TEXT" | "IMAGE" | "VOICE" | "LOCATION";
  media?: {
    mediaUrl: string;
    fileName: string;
    mediaMimeType: string;
    mediaSizeBytes: number;
  };
  durationSeconds?: number;
  latitude?: number;
  longitude?: number;
}) {
  const now = new Date().toISOString();
  return {
    conversationId: params.conversationId,
    senderId: params.senderId,
    recipientId: params.recipientId,
    senderType: params.senderType,
    content: params.content,
    messageType: params.messageType,
    status: "SENT" as const,
    clientMessageId: `client-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mediaUrl: params.media?.mediaUrl ?? null,
    compressedMediaUrl: null,
    fileName: params.media?.fileName ?? null,
    mediaMimeType: params.media?.mediaMimeType ?? null,
    mediaSizeBytes: params.media?.mediaSizeBytes ?? null,
    compressedSizeBytes: null,
    durationSeconds: params.durationSeconds ?? null,
    latitude: params.latitude ?? null,
    longitude: params.longitude ?? null,
    createdAt: now,
  };
}

type MessageRowProps = {
  avatarFallback: string;
  avatarUri: string | null;
  canDelete: boolean;
  isAudioPlaying: boolean;
  isOutgoing: boolean;
  message: ChatMessage;
  onLongPressDelete: () => void;
  onOpenImage: (url: string) => void;
  onOpenLocation: (message: ChatMessage) => void;
  onPressAudio: (url: string) => void;
};

function MessageRow({
  avatarFallback,
  avatarUri,
  canDelete,
  isAudioPlaying,
  isOutgoing,
  message,
  onLongPressDelete,
  onOpenImage,
  onOpenLocation,
  onPressAudio,
}: MessageRowProps) {
  const isDeleted = message.deleted === true;
  const resolvedMediaUrl = resolveAssetUrl(message.mediaUrl);
  const isImage =
    !isDeleted && message.messageType === "IMAGE" && !!resolvedMediaUrl;
  const isVoice =
    !isDeleted && message.messageType === "VOICE" && !!resolvedMediaUrl;
  const isLocation =
    !isDeleted &&
    message.messageType === "LOCATION" &&
    message.latitude != null &&
    message.longitude != null;

  const deleteProps = canDelete
    ? { delayLongPress: 250 as const, onLongPress: onLongPressDelete }
    : undefined;

  const renderOutgoingMeta = () => (
    <View style={styles.timeRightRow}>
      <Text style={styles.timeRight}>{formatTime(message.createdAt)}</Text>
      <MaterialCommunityIcons
        name={
          message.status === "READ" || message.status === "DELIVERED"
            ? "check-all"
            : "check"
        }
        size={14}
        color={message.status === "READ" ? "#60A5FA" : "#9AA4B2"}
      />
    </View>
  );

  const renderIncomingMeta = () => (
    <Text style={styles.timeLeft}>{formatTime(message.createdAt)}</Text>
  );

  const renderTextBubble = () => {
    const bubbleStyle = isOutgoing ? styles.bubbleRight : styles.bubbleLeft;
    const textStyle = isOutgoing
      ? styles.bubbleRightText
      : styles.bubbleLeftText;

    return (
      <View>
        <Pressable style={bubbleStyle} {...deleteProps}>
          <Text style={[textStyle, isDeleted ? styles.deletedText : null]}>
            {isDeleted ? "Message deleted" : message.content || " "}
          </Text>
        </Pressable>
        {isOutgoing ? renderOutgoingMeta() : renderIncomingMeta()}
      </View>
    );
  };

  const renderVoiceBubble = () => {
    const bubbleStyle = isOutgoing
      ? [styles.voiceBubble, styles.voiceBubbleOutgoing]
      : [styles.voiceBubble, styles.voiceBubbleIncoming];
    const playStyle = isOutgoing
      ? [styles.voicePlay, styles.voicePlayOutgoing]
      : [styles.voicePlay, styles.voicePlayIncoming];
    const iconColor = isOutgoing ? "#FFFFFF" : "#1A73E8";

    return (
      <View>
        <Pressable
          style={bubbleStyle}
          onPress={() => resolvedMediaUrl && onPressAudio(resolvedMediaUrl)}
          {...deleteProps}
        >
          <Pressable style={playStyle} pointerEvents="none">
            <MaterialCommunityIcons
              name={isAudioPlaying ? "pause" : "play"}
              size={14}
              color={iconColor}
            />
          </Pressable>
          <View
            style={[
              styles.voiceWave,
              isOutgoing ? styles.voiceWaveOutgoing : null,
            ]}
          />
          <Text
            style={[
              styles.voiceTime,
              isOutgoing ? styles.voiceTimeOutgoing : null,
            ]}
          >
            {formatDuration(message.durationSeconds)}
          </Text>
        </Pressable>
        {isOutgoing ? renderOutgoingMeta() : renderIncomingMeta()}
      </View>
    );
  };

  const renderImageBubble = () => (
    <View>
      <Pressable style={styles.imageBubble} {...deleteProps}>
        <Pressable
          onPress={() => resolvedMediaUrl && onOpenImage(resolvedMediaUrl)}
          disabled={!resolvedMediaUrl}
        >
          <Image
            source={{ uri: resolvedMediaUrl! }}
            style={styles.messageImage}
          />
          <View style={styles.imageTag}>
            <Text style={styles.imageTagText}>{getImageTag(message)}</Text>
          </View>
        </Pressable>
      </Pressable>
      {isOutgoing ? renderOutgoingMeta() : renderIncomingMeta()}
    </View>
  );

  const renderLocationBubble = () => {
    const bubbleStyle = isOutgoing ? styles.bubbleRight : styles.bubbleLeft;
    const textStyle = isOutgoing
      ? styles.bubbleRightText
      : styles.bubbleLeftText;

    return (
      <View>
        <Pressable
          style={bubbleStyle}
          onPress={() => onOpenLocation(message)}
          {...deleteProps}
        >
          <Text style={textStyle}>Shared location</Text>
          <Text style={[textStyle, styles.locationSubtitle]}>
            {message.latitude?.toFixed(5)}, {message.longitude?.toFixed(5)}
          </Text>
        </Pressable>
        {isOutgoing ? renderOutgoingMeta() : renderIncomingMeta()}
      </View>
    );
  };

  if (isOutgoing) {
    return (
      <View style={styles.messageRowRight}>
        {isVoice
          ? renderVoiceBubble()
          : isImage
            ? renderImageBubble()
            : isLocation
              ? renderLocationBubble()
              : renderTextBubble()}
      </View>
    );
  }

  return (
    <View style={styles.messageRow}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarFallbackText}>{avatarFallback}</Text>
        </View>
      )}
      {isVoice
        ? renderVoiceBubble()
        : isImage
          ? renderImageBubble()
          : isLocation
            ? renderLocationBubble()
            : renderTextBubble()}
    </View>
  );
}

export function ChatRoomScreen({ route, navigation }: Props) {
  const { conversationId, otherUserId, otherUserType } = route.params;
  const { currentUser } = useSession();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [page, setPage] = useState(0);
  const [last, setLast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingActive, setRecordingActive] = useState(false);
  const [sending, setSending] = useState(false);
  const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTypingActiveRef = useRef(false);
  const unsubscribeRef = useRef<() => void>(() => undefined);
  const soundRef = useRef<Audio.Sound | null>(null);

  const headerTitle = getParticipantTitle(
    otherUserType,
    otherUserId,
    otherProfile,
  );
  const avatarUri = getParticipantAvatarUri(otherProfile);
  const avatarFallback = getParticipantAvatarFallback(
    otherUserType,
    otherProfile,
  );

  const listItems = useMemo<ChatRoomListItem[]>(() => {
    const items: ChatRoomListItem[] = [];

    messages.forEach((message, index) => {
      const messageKey = String(
        message.messageId ?? message.clientMessageId ?? `message-${index}`,
      );

      items.push({
        type: "message",
        key: `message-${messageKey}`,
        message,
      });

      const currentLabel = formatDayLabel(message.createdAt);
      const nextLabel = formatDayLabel(messages[index + 1]?.createdAt);

      if (currentLabel && currentLabel !== nextLabel) {
        items.push({
          type: "separator",
          key: `separator-${messageKey}-${currentLabel}`,
          label: currentLabel,
        });
      }
    });

    return items;
  }, [messages]);

  const openLocation = useCallback((message: ChatMessage) => {
    if (message.latitude == null || message.longitude == null) {
      return;
    }

    void Linking.openURL(
      `https://www.google.com/maps?q=${message.latitude},${message.longitude}`,
    );
  }, []);

  const loadPage = useCallback(
    async (targetPage: number, reset = false) => {
      if (targetPage === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const response = await getConversationMessages({
          conversationId,
          page: targetPage,
          size: 30,
        });
        setPage(response.page);
        setLast(response.last);
        setError(null);
        setMessages((prev) =>
          reset ? response.content : [...prev, ...response.content],
        );
      } catch (err) {
        if (reset) {
          setError(
            err instanceof Error ? err.message : "Failed to load messages",
          );
          setMessages([]);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [conversationId],
  );

  const markReadDelivered = useCallback(async () => {
    if (!currentUser) {
      return;
    }
    try {
      await markConversationDelivered({
        conversationId,
        userId: currentUser.userId,
      });
      await markConversationRead({
        conversationId,
        userId: currentUser.userId,
      });
    } catch {
      // Keep chat responsive if status updates fail transiently.
    }
  }, [conversationId, currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    chatSocket.connect();
    unsubscribeRef.current = chatSocket.subscribeConversation(conversationId, {
      onMessage: (message) => {
        setMessages((prev) => mergeMessage(prev, message));
        if (message.senderId !== currentUser.userId) {
          void markReadDelivered();
        }
      },
      onTyping: (typing) => {
        if (typing.userId !== currentUser.userId) {
          setOtherTyping(typing.typing);
        }
      },
      onStatus: (updates) => {
        setMessages((prev) => applyStatusUpdates(prev, updates));
      },
      onDeleted: (event) => {
        setMessages((prev) => {
          const index = prev.findIndex(
            (item) => item.messageId === event.messageId,
          );
          if (index < 0) {
            void loadPage(0, true);
            return prev;
          }

          const next = [...prev];
          next[index] = {
            ...next[index],
            deleted: true,
            content: "Message deleted",
            mediaUrl: null,
            compressedMediaUrl: null,
            fileName: null,
            mediaMimeType: null,
            mediaSizeBytes: null,
            compressedSizeBytes: null,
            durationSeconds: null,
          };
          return next;
        });
      },
    });

    loadPage(0, true).then(() => markReadDelivered());

    return () => {
      if (localTypingActiveRef.current) {
        chatSocket.publishTyping({
          conversationId,
          userId: currentUser.userId,
          typing: false,
        });
      }
      unsubscribeRef.current();
      chatSocket.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [conversationId, currentUser, loadPage, markReadDelivered]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const profile = await getUserProfile(otherUserId);
        if (mounted) {
          setOtherProfile(profile);
        }
      } catch {
        if (mounted) {
          setOtherProfile(null);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [otherUserId]);

  const pushTypingState = useCallback(
    (typing: boolean) => {
      if (!currentUser) {
        return;
      }
      chatSocket.publishTyping({
        conversationId,
        userId: currentUser.userId,
        typing,
      });
      localTypingActiveRef.current = typing;
    },
    [conversationId, currentUser],
  );

  const onInputChange = (value: string) => {
    setInput(value);
    const hasText = value.trim().length > 0;

    if (hasText && !localTypingActiveRef.current) {
      pushTypingState(true);
    }
    if (!hasText && localTypingActiveRef.current) {
      pushTypingState(false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (hasText) {
      typingTimeoutRef.current = setTimeout(() => {
        pushTypingState(false);
      }, 2000);
    }
  };

  const removeOptimisticMessage = useCallback((clientMessageId?: string) => {
    if (!clientMessageId) {
      return;
    }
    setMessages((prev) =>
      prev.filter((item) => item.clientMessageId !== clientMessageId),
    );
  }, []);

  const persistOutgoingMessage = useCallback(
    async (
      message: ChatMessage,
      failureTitle: string,
      failureMessage: string,
    ) => {
      setMessages((prev) => mergeMessage(prev, message));

      try {
        const saved = await sendConversationMessage({
          conversationId,
          message,
        });
        setMessages((prev) => mergeMessage(prev, saved));
        return saved;
      } catch {
        removeOptimisticMessage(message.clientMessageId);
        Alert.alert(failureTitle, failureMessage);
        throw new Error("Message persistence failed");
      }
    },
    [conversationId, removeOptimisticMessage],
  );

  const sendText = async () => {
    if (!currentUser) {
      return;
    }
    const content = input.trim();
    if (!content || sending) {
      return;
    }

    setSending(true);
    try {
      const message = buildOutgoingMessage({
        conversationId,
        senderId: currentUser.userId,
        senderType: currentUser.userType,
        recipientId: otherUserId,
        content,
        messageType: "TEXT",
      });
      setInput("");
      pushTypingState(false);
      try {
        await persistOutgoingMessage(
          message,
          "Send failed",
          "Could not save this message.",
        );
      } catch {
        setInput((prev) => (prev.length > 0 ? prev : content));
      }
    } finally {
      setSending(false);
    }
  };

  const pickAndSendImage = async () => {
    if (!currentUser || sending) {
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Photo library permission is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.85,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    setSending(true);
    try {
      let upload;
      try {
        upload = await uploadMedia({
          uri: asset.uri,
          fileName: asset.fileName ?? `image-${Date.now()}.jpg`,
          mimeType: asset.mimeType ?? "image/jpeg",
          compressed: false,
        });
      } catch {
        Alert.alert("Upload failed", "Could not upload selected image.");
        return;
      }

      const message = buildOutgoingMessage({
        conversationId,
        senderId: currentUser.userId,
        senderType: currentUser.userType,
        recipientId: otherUserId,
        content: "",
        messageType: "IMAGE",
        media: {
          mediaUrl: upload.mediaUrl,
          fileName: upload.fileName,
          mediaMimeType: upload.mimeType,
          mediaSizeBytes: upload.sizeBytes,
        },
      });
      await persistOutgoingMessage(
        message,
        "Send failed",
        "Could not save the selected image message.",
      );
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    if (recordingActive || sending) {
      return;
    }
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Microphone permission is required.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      await rec.startAsync();
      setRecording(rec);
      setRecordingActive(true);
    } catch {
      Alert.alert("Recording failed", "Could not start recording.");
    }
  };

  const stopRecordingAndSend = async () => {
    if (!recording || !currentUser) {
      return;
    }
    setSending(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const status = await recording.getStatusAsync();
      setRecording(null);
      setRecordingActive(false);

      if (!uri) {
        throw new Error("Missing recording URI.");
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const durationSeconds =
        status && "durationMillis" in status
          ? Math.round((status.durationMillis ?? 0) / 1000)
          : 0;

      let upload;
      try {
        upload = await uploadMedia({
          uri,
          fileName: `audio-${Date.now()}.m4a`,
          mimeType: "audio/m4a",
          compressed: false,
        });
      } catch {
        Alert.alert(
          "Audio send failed",
          "Could not upload and send voice message.",
        );
        return;
      }

      const message = buildOutgoingMessage({
        conversationId,
        senderId: currentUser.userId,
        senderType: currentUser.userType,
        recipientId: otherUserId,
        content: "",
        messageType: "VOICE",
        media: {
          mediaUrl: upload.mediaUrl,
          fileName: upload.fileName,
          mediaMimeType: upload.mimeType,
          mediaSizeBytes: upload.sizeBytes,
        },
        durationSeconds,
      });
      await persistOutgoingMessage(
        message,
        "Audio send failed",
        "Could not save the voice message.",
      );
    } finally {
      setSending(false);
      setRecordingActive(false);
      setRecording(null);
    }
  };

  const sendLocation = async () => {
    if (!currentUser || sending) {
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Location permission is required to share your location.",
        );
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          "Location services disabled",
          "Please enable location services in your device settings and try again.",
        );
        return;
      }

      setSending(true);

      let loc = await Location.getLastKnownPositionAsync();

      if (!loc) {
        loc = await new Promise<Location.LocationObject | null>((resolve) => {
          let resolved = false;
          let sub: Location.LocationSubscription | null = null;

          const timer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              sub?.remove();
              resolve(null);
            }
          }, 15000);

          Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, distanceInterval: 0 },
            (position) => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                sub?.remove();
                resolve(position);
              }
            },
          )
            .then((subscription) => {
              sub = subscription;
              if (resolved) {
                subscription.remove();
              }
            })
            .catch(() => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                resolve(null);
              }
            });
        });
      }

      if (!loc) {
        Alert.alert(
          "Location unavailable",
          "Could not determine your location. Make sure GPS is turned on and try again in an open area.",
        );
        return;
      }

      const message = buildOutgoingMessage({
        conversationId,
        senderId: currentUser.userId,
        senderType: currentUser.userType,
        recipientId: otherUserId,
        content: "",
        messageType: "LOCATION",
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      await persistOutgoingMessage(
        message,
        "Location send failed",
        "Could not send your location.",
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      Alert.alert(
        "Location failed",
        `Could not get your current location.\n\n${detail}`,
      );
    } finally {
      setSending(false);
    }
  };

  const openAttachmentMenu = () => {
    Alert.alert("Share", "Choose what to send", [
      { text: "Photo", onPress: () => void pickAndSendImage() },
      { text: "Location", onPress: () => void sendLocation() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const stopAudioPlayback = useCallback(async () => {
    const currentSound = soundRef.current;
    soundRef.current = null;
    setPlayingAudioUrl(null);

    if (!currentSound) {
      return;
    }

    try {
      await currentSound.stopAsync();
    } catch {
      // Ignore cleanup errors if playback has already stopped.
    }

    try {
      await currentSound.unloadAsync();
    } catch {
      // Ignore unload errors during cleanup.
    }
  }, []);

  const playAudio = async (url: string) => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (playingAudioUrl === url && soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
          setPlayingAudioUrl(null);
          return;
        }

        await soundRef.current.playAsync();
        setPlayingAudioUrl(url);
        return;
      }

      await stopAudioPlayback();

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
      );

      soundRef.current = sound;
      setPlayingAudioUrl(url);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          return;
        }

        if (status.didJustFinish) {
          setPlayingAudioUrl(null);
          if (soundRef.current === sound) {
            soundRef.current = null;
          }
          void sound.unloadAsync();
        }
      });
    } catch {
      await stopAudioPlayback();
      Alert.alert("Playback failed", "Could not play this audio.");
    }
  };

  const applyDeletedLocally = (messageId: number) => {
    setMessages((prev) =>
      prev.map((item) =>
        item.messageId === messageId
          ? {
              ...item,
              deleted: true,
              content: "Message deleted",
              mediaUrl: null,
              compressedMediaUrl: null,
              fileName: null,
              mediaMimeType: null,
              mediaSizeBytes: null,
              compressedSizeBytes: null,
              durationSeconds: null,
            }
          : item,
      ),
    );
  };

  const showCannotDelete = () => {
    if (Platform.OS === "android") {
      ToastAndroid.show("Cannot delete this message.", ToastAndroid.SHORT);
      return;
    }
    Alert.alert("Delete failed", "Cannot delete this message.");
  };

  const onDeleteMessage = (message: ChatMessage) => {
    if (
      !currentUser ||
      message.senderId !== currentUser.userId ||
      message.deleted === true ||
      !message.messageId
    ) {
      return;
    }

    Alert.alert("Delete message", "Do you want to delete this message?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const originalMessage = message;
          applyDeletedLocally(message.messageId!);

          try {
            await deleteMessage({
              messageId: message.messageId!,
              userId: currentUser.userId,
            });
          } catch {
            setMessages((prev) =>
              prev.map((item) =>
                item.messageId === originalMessage.messageId
                  ? originalMessage
                  : item,
              ),
            );
            showCannotDelete();
          }
        },
      },
    ]);
  };

  if (!currentUser) {
    return null;
  }

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={[styles.safeArea, { paddingTop: insets.top }]}
    >
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : insets.top}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={navigation.goBack}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color="#1F2937"
            />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={styles.headerAvatarWrap}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.headerAvatar}
                />
              ) : (
                <View style={styles.headerAvatarFallback}>
                  <Text style={styles.headerAvatarFallbackText}>
                    {avatarFallback}
                  </Text>
                </View>
              )}
              <View style={styles.headerStatus} />
            </View>
            <View>
              <Text style={styles.headerTitle}>{headerTitle}</Text>
              <Text style={styles.headerStatusText}>
                {otherTyping ? "typing..." : "Online"}
              </Text>
            </View>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color="#1A73E8" />
          </View>
        ) : (
          <FlatList
            data={listItems}
            inverted
            keyExtractor={(item) => item.key}
            style={styles.messageList}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 12 + insets.bottom },
            ]}
            onEndReached={() => {
              if (!loadingMore && !last) {
                loadPage(page + 1);
              }
            }}
            onEndReachedThreshold={0.2}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) =>
              item.type === "separator" ? (
                <View style={styles.dayPillWrap}>
                  <View style={styles.dayPill}>
                    <Text style={styles.dayText}>{item.label}</Text>
                  </View>
                </View>
              ) : (
                <MessageRow
                  avatarFallback={avatarFallback}
                  avatarUri={avatarUri}
                  message={item.message}
                  isOutgoing={item.message.senderId === currentUser.userId}
                  canDelete={
                    item.message.senderId === currentUser.userId &&
                    item.message.deleted !== true &&
                    !!item.message.messageId
                  }
                  isAudioPlaying={
                    item.message.messageType === "VOICE" &&
                    !!item.message.mediaUrl &&
                    playingAudioUrl === item.message.mediaUrl
                  }
                  onPressAudio={playAudio}
                  onOpenImage={setViewerImageUrl}
                  onOpenLocation={openLocation}
                  onLongPressDelete={() => onDeleteMessage(item.message)}
                />
              )
            }
            ListEmptyComponent={
              error ? (
                <View style={styles.centered}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable
                    style={styles.retryButton}
                    onPress={() => loadPage(0, true)}
                  >
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>No messages yet.</Text>
                </View>
              )
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator size="small" color="#1A73E8" />
                </View>
              ) : null
            }
          />
        )}

        <View style={[styles.inputBar, { paddingBottom: 10 + insets.bottom }]}>
          <Pressable style={styles.inputIcon} onPress={openAttachmentMenu}>
            <MaterialCommunityIcons name="plus" size={20} color="#64748B" />
          </Pressable>
          <View style={styles.inputField}>
            <TextInput
              style={styles.inputText}
              value={input}
              placeholder="Type a message..."
              placeholderTextColor="#A6B0C3"
              onChangeText={onInputChange}
            />
          </View>
          <Pressable
            style={styles.sendButton}
            onPress={
              input.trim().length > 0
                ? sendText
                : recordingActive
                  ? stopRecordingAndSend
                  : startRecording
            }
            disabled={sending}
          >
            <MaterialCommunityIcons
              name={
                input.trim().length > 0
                  ? "send"
                  : recordingActive
                    ? "stop"
                    : "microphone"
              }
              size={18}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ImageViewerModal
        visible={!!viewerImageUrl}
        imageUrl={viewerImageUrl ?? ""}
        onClose={() => setViewerImageUrl(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  headerRow: {
    minHeight: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E6ECF3",
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerAvatarWrap: {
    position: "relative",
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DDE5F0",
  },
  headerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DDE5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarFallbackText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
  },
  headerStatus: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    bottom: 0,
    right: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1F2937",
  },
  headerStatusText: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    color: "#22C55E",
  },
  headerSpacer: {
    width: 34,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 12,
  },
  messageList: {
    flex: 1,
  },
  dayPillWrap: {
    alignItems: "center",
  },
  dayPill: {
    alignSelf: "center",
    backgroundColor: "#E9EEF7",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dayText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8A94A6",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  messageRowRight: {
    alignItems: "flex-end",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  avatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#DDE5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
  },
  bubbleLeft: {
    maxWidth: 230,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E6ECF3",
  },
  bubbleLeftText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  timeLeft: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "600",
    color: "#9AA4B2",
  },
  bubbleRight: {
    maxWidth: 240,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#1A73E8",
    borderRadius: 14,
    borderTopRightRadius: 4,
  },
  bubbleRightText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  deletedText: {
    fontStyle: "italic",
  },
  timeRightRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
  },
  timeRight: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9AA4B2",
  },
  voiceBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  voiceBubbleIncoming: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6ECF3",
  },
  voiceBubbleOutgoing: {
    backgroundColor: "#1A73E8",
  },
  voicePlay: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  voicePlayIncoming: {
    backgroundColor: "#EAF1FF",
  },
  voicePlayOutgoing: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  voiceWave: {
    width: 90,
    height: 18,
    backgroundColor: "#E5ECF7",
    borderRadius: 10,
  },
  voiceWaveOutgoing: {
    backgroundColor: "rgba(255,255,255,0.34)",
  },
  voiceTime: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
  },
  voiceTimeOutgoing: {
    color: "#FFFFFF",
  },
  imageBubble: {
    width: 220,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#1A73E8",
    overflow: "hidden",
  },
  messageImage: {
    width: "100%",
    height: 130,
  },
  imageTag: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 160,
  },
  imageTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  locationSubtitle: {
    marginTop: 4,
    opacity: 0.92,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footerLoading: {
    paddingVertical: 8,
  },
  errorText: {
    textAlign: "center",
    color: "#D9534F",
    marginBottom: 12,
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: "#1A73E8",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    color: "#6C8195",
    fontSize: 14,
  },
  inputBar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: "#F7F9FC",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#E6ECF3",
  },
  inputIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6ECF3",
    alignItems: "center",
    justifyContent: "center",
  },
  inputField: {
    flex: 1,
    height: 38,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6ECF3",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#1F2937",
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A73E8",
    alignItems: "center",
    justifyContent: "center",
  },
});
