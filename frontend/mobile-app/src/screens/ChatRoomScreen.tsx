import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ToastAndroid,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Audio } from "expo-av";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { MessageBubble } from "../components/MessageBubble";
import { ImageViewerModal } from "../components/ImageViewerModal";
import type { RootStackParamList } from "../navigation/types";
import {
  deleteMessage,
  getConversationMessages,
  markConversationDelivered,
  markConversationRead,
  sendConversationMessage,
  uploadMedia,
} from "../services/chatApi";
import { chatSocket } from "../services/chatSocket";
import { getUserProfile } from "../services/userProfileApi";
import { useSession } from "../store/sessionStore";
import type { ChatMessage, UserProfile } from "../types/chat";
import {
  applyStatusUpdates,
  formatDayLabel,
  getParticipantTitle,
  mergeMessage,
} from "../utils/chat";

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

export function ChatRoomScreen({ route, navigation }: Props) {
  const { conversationId, otherUserId, otherUserType } = route.params;
  const { currentUser } = useSession();

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
  const insets = useSafeAreaInsets();

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTypingActiveRef = useRef(false);
  const unsubscribeRef = useRef<() => void>(() => undefined);
  const soundRef = useRef<Audio.Sound | null>(null);

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
      // No-op to keep chat responsive when status endpoint has transient failures.
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

      // Try cached position first
      let loc = await Location.getLastKnownPositionAsync();

      // If no cached position, get a fresh one using watchPositionAsync
      // (more reliable than getCurrentPositionAsync on many Android devices)
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

  const headerTitle = getParticipantTitle(
    otherUserType,
    otherUserId,
    otherProfile?.fullName,
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : insets.top}
      >
        <View style={[styles.header, { paddingTop: -10 + insets.top }]}>
          <Pressable style={styles.backBtn} onPress={navigation.goBack}>
            <Text style={styles.backText}>{"<"}</Text>
          </Pressable>
          <View style={styles.headerAvatarWrap}>
            {otherProfile?.profilePhoto ? (
              <Image
                source={{ uri: otherProfile.profilePhoto }}
                style={styles.headerAvatarImage}
              />
            ) : (
              <View style={styles.headerAvatar}>
                <Text style={styles.headerAvatarText}>
                  {String(
                    (otherProfile?.fullName ?? headerTitle)[0],
                  ).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.onlineDot} />
          </View>
          <View>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.headerSub}>
              {otherTyping ? "typing..." : "Online"}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color="#1f8fff" />
          </View>
        ) : (
          <FlatList
            data={listItems}
            inverted
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.list}
            onEndReached={() => {
              if (!loadingMore && !last) {
                loadPage(page + 1);
              }
            }}
            onEndReachedThreshold={0.2}
            renderItem={({ item }) =>
              item.type === "separator" ? (
                <View style={styles.dayPillWrap}>
                  <Text style={styles.dayPill}>{item.label}</Text>
                </View>
              ) : (
                <MessageBubble
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
                  onPressImage={setViewerImageUrl}
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
                  <ActivityIndicator size="small" color="#1f8fff" />
                </View>
              ) : null
            }
          />
        )}

        <View
          style={[
            styles.inputBar,
            { paddingBottom: Math.max(insets.bottom, 8) },
          ]}
        >
          <Pressable style={styles.iconBtn} onPress={pickAndSendImage}>
            <Text style={styles.iconText}>+</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={sendLocation}>
            <Text style={styles.iconText}>📍</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            value={input}
            placeholder="Type a message..."
            onChangeText={onInputChange}
          />
          {input.trim().length > 0 ? (
            <Pressable
              style={styles.sendBtn}
              onPress={sendText}
              disabled={sending}
            >
              <Text style={styles.sendTxt}>Send</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.sendBtn, recordingActive && styles.recordingBtn]}
              onPress={recordingActive ? stopRecordingAndSend : startRecording}
              disabled={sending}
            >
              <Text style={styles.sendTxt}>
                {recordingActive ? "Stop" : "Mic"}
              </Text>
            </Pressable>
          )}
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
  container: {
    flex: 1,
    backgroundColor: "#F5F7F8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#d3dae1",
    backgroundColor: "#F5F7F8",
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  backText: {
    fontSize: 26,
    color: "#111827",
  },
  headerAvatarWrap: {
    marginRight: 10,
    position: "relative",
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6fa8b6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: {
    color: "#fff",
    fontWeight: "700",
  },
  headerAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  onlineDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#F5F7F8",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#172330",
  },
  headerSub: {
    marginTop: 1,
    color: "#1f8fff",
    fontSize: 14,
  },
  dayPillWrap: {
    alignItems: "center",
    paddingTop: 10,
  },
  dayPill: {
    backgroundColor: "#E2E8F0",
    color: "#64748B",
    fontWeight: "600",
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    paddingVertical: 10,
    backgroundColor: "#F5F7F8",
  },
  footerLoading: {
    paddingVertical: 8,
  },
  errorText: {
    textAlign: "center",
    color: "#d9534f",
    marginBottom: 12,
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: "#1f8fff",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    color: "#6c8195",
    fontSize: 14,
  },
  inputBar: {
    backgroundColor: "#f4f7fb",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ced7e0",
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: {
    fontSize: 24,
    color: "#587087",
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: "#203243",
  },
  sendBtn: {
    height: 34,
    minWidth: 50,
    borderRadius: 17,
    backgroundColor: "#1f8fff",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  recordingBtn: {
    backgroundColor: "#e55050",
  },
  sendTxt: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
});
