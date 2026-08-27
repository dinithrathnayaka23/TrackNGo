import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  deleteMessage,
  getConversationMessages,
  getPresenceSnapshot,
  markConversationDelivered,
  markConversationRead,
  sendConversationMessage,
  uploadMedia,
  type ChatMessageDto,
  type ChatMessageType,
  type MessageStatusUpdate,
  type PresenceUpdate,
} from '@/services/chatApi';
import { chatSocket } from '@/services/chatSocket';
import { resolveAssetUrl } from '@/utils/media';

type ChatRoomListItem =
  | {
      type: 'message';
      key: string;
      message: ChatMessageDto;
    }
  | {
      type: 'separator';
      key: string;
      label: string;
    };

const WAVEFORM_BARS = [10, 22, 12, 38, 18, 54, 26, 44, 14, 62, 34, 48, 20, 56, 28, 40, 16, 30];

export default function ChatScreen() {
  const { id, name, otherUserId, otherUserType } = useLocalSearchParams<{
    id?: string;
    name?: string;
    otherUserId?: string;
    otherUserType?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { t } = useLanguage();
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingStartedAtRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTypingActiveRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [page, setPage] = useState(0);
  const [last, setLast] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  const conversationId = Number(id);
  const recipientId = Number(otherUserId);
  const hasConversation = Number.isFinite(conversationId) && conversationId > 0;
  const hasRecipient = Number.isFinite(recipientId) && recipientId > 0;
  const isRecording = !!recording;
  const headerTitle = name || `Chat ${id}`;
  const avatarFallback = getParticipantAvatarFallback(otherUserType);
  const bottomInset = keyboardVisible ? 0 : insets.bottom;
  const keyboardLift =
    Platform.OS === 'android' && keyboardVisible
      ? Math.max(0, keyboardHeight - insets.bottom)
      : 0;

  const listItems = useMemo<ChatRoomListItem[]>(() => {
    const items: ChatRoomListItem[] = [];
    const sorted = [...messages].sort(compareMessagesDesc);

    sorted.forEach((message, index) => {
      const messageKey = getMessageKey(message);
      items.push({
        type: 'message',
        key: `message-${messageKey}`,
        message,
      });

      const currentLabel = formatDayLabel(message.createdAt);
      const nextLabel = formatDayLabel(sorted[index + 1]?.createdAt);
      if (currentLabel && currentLabel !== nextLabel) {
        items.push({
          type: 'separator',
          key: `separator-${messageKey}-${currentLabel}`,
          label: currentLabel,
        });
      }
    });

    return items;
  }, [messages]);

  const markThreadSeen = useCallback(async () => {
    if (!hasConversation || !user?.token || !user.userId) {
      return;
    }

    try {
      await markConversationDelivered({
        token: user.token,
        conversationId,
        userId: user.userId,
      });
      await markConversationRead({
        token: user.token,
        conversationId,
        userId: user.userId,
      });
    } catch {
      // Chat remains usable if receipt updates fail transiently.
    }
  }, [conversationId, hasConversation, user?.token, user?.userId]);

  const loadMessages = useCallback(
    async (targetPage = 0, reset = true, showLoading = true) => {
      if (!hasConversation || !user?.token || !user.userId) {
        setIsLoading(false);
        return;
      }

      try {
        if (targetPage === 0 && showLoading) {
          setIsLoading(true);
        } else if (targetPage > 0) {
          setIsLoadingMore(true);
        }

        const result = await getConversationMessages({
          token: user.token,
          conversationId,
          page: targetPage,
          size: 30,
        });

        const incoming = Array.isArray(result.content) ? result.content : [];
        setPage(result.page ?? targetPage);
        setLast(result.last ?? true);
        setMessages((current) =>
          reset ? mergeMessages([], incoming) : mergeMessages(current, incoming),
        );
        setError(null);

        if (incoming.some((message) => message.senderId !== user.userId)) {
          void markThreadSeen();
        }
      } catch (fetchError) {
        console.error('Error fetching chat messages:', fetchError);
        if (reset) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load messages');
          setMessages([]);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [conversationId, hasConversation, markThreadSeen, user?.token, user?.userId],
  );

  useEffect(() => {
    void loadMessages(0, true, true);

    /*
      The socket now carries messages, receipts and deletions as they happen. This
      sweep stays only as a safety net for whatever the broker missed while the app
      was backgrounded, so it runs at a fraction of the old three-second rate.
    */
    const refreshTimer = setInterval(() => {
      void loadMessages(0, true, false);
    }, 15000);

    return () => clearInterval(refreshTimer);
  }, [loadMessages]);

  // Presence arrives either as a full snapshot of everyone online or as one delta.
  const applyPresenceUpdate = useCallback(
    (presence: PresenceUpdate) => {
      if (!hasRecipient) {
        return;
      }
      if (Array.isArray(presence.onlineUserIds)) {
        setOtherOnline(presence.onlineUserIds.some((id) => Number(id) === recipientId));
        return;
      }
      if (Number(presence.userId) === recipientId) {
        setOtherOnline(presence.online);
      }
    },
    [hasRecipient, recipientId],
  );

  const applyStatusUpdates = useCallback((updates: MessageStatusUpdate[]) => {
    if (updates.length === 0) {
      return;
    }
    setMessages((current) =>
      current.map((message) => {
        const update = updates.find((item) => item.messageId === message.messageId);
        return update ? { ...message, status: update.status } : message;
      }),
    );
  }, []);

  useEffect(() => {
    if (!hasConversation || !user?.userId || !user?.token) {
      return undefined;
    }

    const token = user.token;
    const currentUserId = user.userId;

    chatSocket.connect(currentUserId);
    const unsubscribePresence = chatSocket.subscribePresence(applyPresenceUpdate);
    void getPresenceSnapshot({ token }).then(applyPresenceUpdate).catch(() => undefined);

    const unsubscribeConversation = chatSocket.subscribeConversation(conversationId, {
      onMessage: (message) => {
        setMessages((current) => mergeMessages(current, [message]));
        if (message.senderId !== currentUserId) {
          // Something just arrived while this thread is open, so it has been seen.
          void markThreadSeen();
        }
      },
      onTyping: (typing) => {
        if (typing.userId !== currentUserId) {
          setOtherTyping(typing.typing);
        }
      },
      onStatus: applyStatusUpdates,
      onDeleted: (event) => {
        setMessages((current) =>
          current.map((message) =>
            message.messageId === event.messageId
              ? {
                  ...message,
                  deleted: true,
                  content: t('chat.messageDeleted'),
                  mediaUrl: null,
                  compressedMediaUrl: null,
                  fileName: null,
                  mediaMimeType: null,
                  mediaSizeBytes: null,
                  compressedSizeBytes: null,
                  durationSeconds: null,
                }
              : message,
          ),
        );
      },
    });

    return () => {
      // Leaving mid-sentence would otherwise strand a "typing..." on the other screen.
      if (localTypingActiveRef.current) {
        chatSocket.publishTyping({
          conversationId,
          userId: currentUserId,
          typing: false,
        });
        localTypingActiveRef.current = false;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      unsubscribeConversation();
      unsubscribePresence();
      chatSocket.disconnect();
    };
  }, [
    applyPresenceUpdate,
    applyStatusUpdates,
    conversationId,
    hasConversation,
    markThreadSeen,
    t,
    user?.token,
    user?.userId,
  ]);

  /*
    Typing is announced once when the driver starts and withdrawn after a pause,
    rather than on every keystroke, so the broker sees two events per burst of
    writing instead of one per character.
  */
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);

      if (!hasConversation || !user?.userId) {
        return;
      }

      const typing = value.trim().length > 0;
      if (typing !== localTypingActiveRef.current) {
        chatSocket.publishTyping({ conversationId, userId: user.userId, typing });
        localTypingActiveRef.current = typing;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (typing) {
        typingTimeoutRef.current = setTimeout(() => {
          if (localTypingActiveRef.current && user.userId) {
            chatSocket.publishTyping({
              conversationId,
              userId: user.userId,
              typing: false,
            });
            localTypingActiveRef.current = false;
          }
          typingTimeoutRef.current = null;
        }, 2500);
      }
    },
    [conversationId, hasConversation, user?.userId],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isRecording) {
      return undefined;
    }

    const timer = setInterval(() => {
      setRecordingElapsed(Math.floor((Date.now() - recordingStartedAtRef.current) / 1000));
    }, 250);

    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(
    () => () => {
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
      }
      if (recording) {
        void recording.stopAndUnloadAsync();
      }
    },
    [recording],
  );

  const persistOutgoingMessage = useCallback(
    async (message: ChatMessageDto, failureMessage: string) => {
      if (!user?.token || !user.userId) {
        return;
      }

      setMessages((current) => mergeMessages(current, [message]));

      try {
        const saved = await sendConversationMessage({
          token: user.token,
          conversationId,
          message,
        });
        setMessages((current) => mergeMessages(current, [saved]));
        void loadMessages(0, true, false);
      } catch (sendError) {
        console.error('Error sending chat message:', sendError);
        setMessages((current) =>
          current.filter((item) => item.clientMessageId !== message.clientMessageId),
        );
        Alert.alert('Send failed', failureMessage);
      }
    },
    [conversationId, loadMessages, user?.token, user?.userId],
  );

  /**
   * Hides the message locally before the request completes, so a long press feels
   * immediate; the original is put back if the server refuses.
   */
  const confirmDeleteMessage = useCallback(
    (message: ChatMessageDto) => {
      const messageId = message.messageId;
      if (!messageId || !user?.token || !user.userId) {
        return;
      }

      const token = user.token;
      const userId = user.userId;

      Alert.alert(t('chat.deleteTitle'), t('chat.deleteConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chat.delete'),
          style: 'destructive',
          onPress: async () => {
            setMessages((current) =>
              current.map((item) =>
                item.messageId === messageId
                  ? {
                      ...item,
                      deleted: true,
                      content: t('chat.messageDeleted'),
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

            try {
              await deleteMessage({ token, messageId, userId });
            } catch {
              setMessages((current) =>
                current.map((item) => (item.messageId === messageId ? message : item)),
              );
              Alert.alert(t('chat.deleteFailedTitle'), t('chat.deleteFailedMessage'));
            }
          },
        },
      ]);
    },
    [t, user?.token, user?.userId],
  );

  /** Withdraws the typing signal for the cases that clear the box without a keystroke. */
  const stopTypingSignal = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (localTypingActiveRef.current && hasConversation && user?.userId) {
      chatSocket.publishTyping({ conversationId, userId: user.userId, typing: false });
    }
    localTypingActiveRef.current = false;
  }, [conversationId, hasConversation, user?.userId]);

  const sendText = async () => {
    const content = input.trim();
    if (!content || !hasConversation || !user?.token || !user.userId || isSending) {
      return;
    }

    setIsSending(true);
    setInput('');
    stopTypingSignal();
    try {
      await persistOutgoingMessage(
        buildOutgoingMessage({
          conversationId,
          senderId: user.userId,
          recipientId: hasRecipient ? recipientId : null,
          content,
          messageType: 'TEXT',
        }),
        'Could not send this message.',
      );
    } finally {
      setIsSending(false);
    }
  };

  const uploadAndSendImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user?.token || !user.userId || isSending) {
      return;
    }

    setIsSending(true);
    try {
      const uploaded = await uploadMedia({
        token: user.token,
        uri: asset.uri,
        fileName: asset.fileName ?? `image-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });

      await persistOutgoingMessage(
        buildOutgoingMessage({
          conversationId,
          senderId: user.userId,
          recipientId: hasRecipient ? recipientId : null,
          content: '',
          messageType: 'IMAGE',
          mediaUrl: uploaded.mediaUrl,
          fileName: uploaded.fileName,
          mediaMimeType: uploaded.mimeType,
          mediaSizeBytes: uploaded.sizeBytes,
        }),
        'Could not send this image.',
      );
    } catch (uploadError) {
      console.error('Image upload failed:', uploadError);
      Alert.alert('Upload failed', 'Could not upload the selected image.');
    } finally {
      setIsSending(false);
    }
  };

  const pickImage = async () => {
    setAttachmentMenuVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Photo library permission is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.85,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAndSendImage(result.assets[0]);
    }
  };

  const captureImage = async () => {
    setAttachmentMenuVisible(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAndSendImage(result.assets[0]);
    }
  };

  const shareLocation = async () => {
    setAttachmentMenuVisible(false);
    if (!user?.token || !user.userId || isSending) {
      return;
    }

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required.');
        return;
      }

      setIsSending(true);
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await persistOutgoingMessage(
        buildOutgoingMessage({
          conversationId,
          senderId: user.userId,
          recipientId: hasRecipient ? recipientId : null,
          content: '',
          messageType: 'LOCATION',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
        'Could not send your location.',
      );
    } catch (locationError) {
      console.error('Location share failed:', locationError);
      Alert.alert('Location failed', 'Could not get your current location.');
    } finally {
      setIsSending(false);
    }
  };

  const startRecording = async () => {
    if (recording || isSending) {
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Microphone permission is required.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await nextRecording.startAsync();
      recordingStartedAtRef.current = Date.now();
      setRecordingElapsed(0);
      setRecording(nextRecording);
    } catch (recordingError) {
      console.error('Recording failed:', recordingError);
      Alert.alert('Recording failed', 'Could not start voice recording.');
    }
  };

  const cancelRecording = async () => {
    if (!recording) {
      return;
    }

    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // The recording can already be stopped on some devices.
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
    setRecording(null);
    setRecordingElapsed(0);
  };

  const stopRecordingAndSend = async () => {
    if (!recording || !user?.token || !user.userId) {
      return;
    }

    setIsSending(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const status = await recording.getStatusAsync();
      setRecording(null);
      setRecordingElapsed(0);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (!uri) {
        throw new Error('Missing recording URI.');
      }

      const durationSeconds =
        status && 'durationMillis' in status
          ? Math.max(1, Math.round((status.durationMillis ?? 0) / 1000))
          : Math.max(1, recordingElapsed);

      const uploaded = await uploadMedia({
        token: user.token,
        uri,
        fileName: `voice-${Date.now()}.m4a`,
        mimeType: 'audio/m4a',
      });

      await persistOutgoingMessage(
        buildOutgoingMessage({
          conversationId,
          senderId: user.userId,
          recipientId: hasRecipient ? recipientId : null,
          content: '',
          messageType: 'VOICE',
          mediaUrl: uploaded.mediaUrl,
          fileName: uploaded.fileName,
          mediaMimeType: uploaded.mimeType,
          mediaSizeBytes: uploaded.sizeBytes,
          durationSeconds,
        }),
        'Could not send this voice message.',
      );
    } catch (voiceError) {
      console.error('Voice send failed:', voiceError);
      Alert.alert('Voice send failed', 'Could not save the voice message.');
    } finally {
      setIsSending(false);
      setRecording(null);
      setRecordingElapsed(0);
    }
  };

  const playAudio = async (url: string) => {
    if (playingAudioUrl === url) {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
      soundRef.current = null;
      setPlayingAudioUrl(null);
      return;
    }

    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    try {
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingAudioUrl(url);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingAudioUrl(null);
          void sound.unloadAsync();
          if (soundRef.current === sound) {
            soundRef.current = null;
          }
        }
      });
    } catch (playError) {
      console.error('Audio playback failed:', playError);
      Alert.alert('Playback failed', 'Could not play this voice message.');
    }
  };

  const openLocation = (message: ChatMessageDto) => {
    if (message.latitude == null || message.longitude == null) {
      return;
    }

    void Linking.openURL(`https://www.google.com/maps?q=${message.latitude},${message.longitude}`);
  };

  const inputAction = input.trim().length > 0 ? sendText : isRecording ? stopRecordingAndSend : startRecording;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#1F2937" />
          </Pressable>

          <View style={styles.headerCenter}>
            <View style={styles.headerAvatarWrap}>
              <View style={styles.headerAvatarFallback}>
                <Text style={styles.headerAvatarFallbackText}>{avatarFallback}</Text>
              </View>
              {otherOnline ? <View style={styles.headerOnlineDot} /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {headerTitle}
              </Text>
              {/* Presence replaces the participant label, matching the passenger app:
                  who someone is matters less mid-conversation than whether they are there. */}
              <Text
                style={[
                  styles.headerStatusText,
                  otherOnline ? styles.headerStatusOnlineText : styles.headerStatusOfflineText,
                ]}
                numberOfLines={1}
              >
                {otherTyping
                  ? t('chat.typing')
                  : otherOnline
                    ? t('chat.online')
                    : t('chat.offline')}
              </Text>
            </View>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading ? (
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
              { paddingBottom: 12 + bottomInset },
            ]}
            onEndReached={() => {
              if (!isLoadingMore && !last) {
                void loadMessages(page + 1, false, false);
              }
            }}
            onEndReachedThreshold={0.2}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) =>
              item.type === 'separator' ? (
                <View style={styles.dayPillWrap}>
                  <View style={styles.dayPill}>
                    <Text style={styles.dayText}>{item.label}</Text>
                  </View>
                </View>
              ) : (
                <MessageRow
                  avatarFallback={avatarFallback}
                  message={item.message}
                  isOutgoing={item.message.senderId === user?.userId}
                  canDelete={
                    item.message.senderId === user?.userId &&
                    item.message.deleted !== true &&
                    !!item.message.messageId
                  }
                  deletedLabel={t('chat.messageDeleted')}
                  isAudioPlaying={
                    item.message.messageType === 'VOICE' &&
                    !!item.message.mediaUrl &&
                    playingAudioUrl === resolveAssetUrl(item.message.mediaUrl)
                  }
                  onPressAudio={playAudio}
                  onOpenImage={setViewerImageUrl}
                  onOpenLocation={openLocation}
                  onLongPressDelete={() => confirmDeleteMessage(item.message)}
                />
              )
            }
            ListEmptyComponent={
              error ? (
                <View style={styles.centered}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable
                    style={styles.retryButton}
                    onPress={() => loadMessages(0, true, true)}
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
              isLoadingMore ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator size="small" color="#1A73E8" />
                </View>
              ) : null
            }
          />
        )}

        <View
          style={[
            styles.composerArea,
            { paddingBottom: 10 + bottomInset + keyboardLift },
          ]}
        >
          {isRecording ? (
            <View style={styles.recordingBanner}>
              <View style={styles.recordingInfo}>
                <View style={styles.recordingMic}>
                  <MaterialCommunityIcons name="microphone" size={13} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.recordingTitle}>Recording voice</Text>
                  <View style={styles.recordingMeta}>
                    <Text style={styles.recordingTime}>{formatDuration(recordingElapsed)}</Text>
                    <View style={styles.recordingWave}>
                      {WAVEFORM_BARS.slice(0, 12).map((height, index) => (
                        <View
                          key={`recording-wave-${index}`}
                          style={[
                            styles.recordingWaveBar,
                            { height: Math.max(4, Math.round((height / 100) * 16)) },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              </View>
              <Pressable style={styles.recordingCancel} onPress={() => void cancelRecording()} disabled={isSending}>
                <MaterialCommunityIcons name="close" size={18} color="#B42318" />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.inputBar}>
            <Pressable
              style={[styles.inputIcon, isRecording ? styles.disabledControl : null]}
              onPress={() => setAttachmentMenuVisible(true)}
              disabled={isRecording || isSending}
            >
              <MaterialCommunityIcons name="plus" size={20} color="#64748B" />
            </Pressable>
            <View style={styles.inputField}>
              <TextInput
                style={styles.inputText}
                value={input}
                placeholder={isRecording ? 'Recording voice...' : 'Type a message...'}
                placeholderTextColor="#A6B0C3"
                onChangeText={handleInputChange}
                editable={!isRecording && !isSending}
              />
            </View>
            <Pressable
              style={[styles.sendButton, isRecording ? styles.recordingStopButton : null]}
              onPress={() => void inputAction()}
              disabled={isSending}
            >
              <MaterialCommunityIcons
                name={input.trim().length > 0 ? 'send' : isRecording ? 'stop' : 'microphone'}
                size={18}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ImageViewerModal
        visible={!!viewerImageUrl}
        imageUrl={viewerImageUrl ?? ''}
        onClose={() => setViewerImageUrl(null)}
      />
      <Modal
        visible={attachmentMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachmentMenuVisible(false)}
      >
        <Pressable style={styles.attachmentBackdrop} onPress={() => setAttachmentMenuVisible(false)}>
          <Pressable style={styles.attachmentSheet}>
            <Text style={styles.attachmentTitle}>Share</Text>
            <Text style={styles.attachmentSubtitle}>Choose what to send</Text>
            <Pressable style={styles.attachmentOption} onPress={() => void captureImage()}>
              <MaterialCommunityIcons name="camera" size={20} color="#1A73E8" />
              <Text style={styles.attachmentOptionText}>Camera</Text>
            </Pressable>
            <Pressable style={styles.attachmentOption} onPress={() => void pickImage()}>
              <MaterialCommunityIcons name="image" size={20} color="#1A73E8" />
              <Text style={styles.attachmentOptionText}>Photo</Text>
            </Pressable>
            <Pressable style={styles.attachmentOption} onPress={() => void shareLocation()}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#1A73E8" />
              <Text style={styles.attachmentOptionText}>Location</Text>
            </Pressable>
            <Pressable
              style={styles.attachmentCancel}
              onPress={() => setAttachmentMenuVisible(false)}
            >
              <Text style={styles.attachmentCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function MessageRow({
  avatarFallback,
  canDelete,
  deletedLabel,
  isAudioPlaying,
  isOutgoing,
  message,
  onOpenImage,
  onOpenLocation,
  onLongPressDelete,
  onPressAudio,
}: {
  avatarFallback: string;
  canDelete: boolean;
  deletedLabel: string;
  isAudioPlaying: boolean;
  isOutgoing: boolean;
  message: ChatMessageDto;
  onOpenImage: (url: string) => void;
  onOpenLocation: (message: ChatMessageDto) => void;
  onLongPressDelete: () => void;
  onPressAudio: (url: string) => void;
}) {
  const isDeleted = message.deleted === true;
  // Spread onto each bubble so only the driver's own, still-present messages
  // respond to a long press.
  const deleteProps = canDelete
    ? { delayLongPress: 250 as const, onLongPress: onLongPressDelete }
    : undefined;
  const resolvedMediaUrl = resolveAssetUrl(message.mediaUrl ?? message.compressedMediaUrl);
  const isImage = !isDeleted && message.messageType === 'IMAGE' && !!resolvedMediaUrl;
  const isVoice = !isDeleted && message.messageType === 'VOICE' && !!resolvedMediaUrl;
  const isLocation =
    !isDeleted &&
    message.messageType === 'LOCATION' &&
    message.latitude != null &&
    message.longitude != null;

  const renderOutgoingMeta = () => (
    <View style={styles.timeRightRow}>
      <Text style={styles.timeRight}>{formatTime(message.createdAt)}</Text>
      <MaterialCommunityIcons
        name={message.status === 'READ' || message.status === 'DELIVERED' ? 'check-all' : 'check'}
        size={14}
        color={message.status === 'READ' ? '#60A5FA' : '#9AA4B2'}
      />
    </View>
  );

  const renderIncomingMeta = () => (
    <Text style={styles.timeLeft}>{formatTime(message.createdAt)}</Text>
  );

  const renderTextBubble = () => (
    <View>
      <Pressable style={isOutgoing ? styles.bubbleRight : styles.bubbleLeft} {...deleteProps}>
        <Text
          style={[
            isOutgoing ? styles.bubbleRightText : styles.bubbleLeftText,
            isDeleted ? styles.deletedText : null,
          ]}
        >
          {isDeleted ? deletedLabel : message.content || ' '}
        </Text>
      </Pressable>
      {isOutgoing ? renderOutgoingMeta() : renderIncomingMeta()}
    </View>
  );

  const renderVoiceBubble = () => (
    <View>
      <Pressable
        style={[
          styles.voiceBubble,
          isOutgoing ? styles.voiceBubbleOutgoing : styles.voiceBubbleIncoming,
        ]}
        onPress={() => resolvedMediaUrl && onPressAudio(resolvedMediaUrl)}
        {...deleteProps}
      >
        <Pressable
          style={[
            styles.voicePlay,
            isOutgoing ? styles.voicePlayOutgoing : styles.voicePlayIncoming,
          ]}
          pointerEvents="none"
        >
          <MaterialCommunityIcons
            name={isAudioPlaying ? 'pause' : 'play'}
            size={14}
            color={isOutgoing ? '#FFFFFF' : '#1A73E8'}
          />
        </Pressable>
        <View style={styles.voiceWaveWrap}>
          <View style={styles.voiceWave}>
            {WAVEFORM_BARS.map((height, index) => (
              <View
                key={`${getMessageKey(message)}-${index}`}
                style={[
                  styles.voiceWaveBar,
                  isOutgoing ? styles.voiceWaveBarOutgoing : null,
                  isAudioPlaying && index % 3 === 0 ? styles.voiceWaveBarActive : null,
                  { height: Math.max(4, Math.round((height / 100) * 32)) },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.voiceTime, isOutgoing ? styles.voiceTimeOutgoing : null]}>
            {formatDuration(message.durationSeconds)}
          </Text>
        </View>
      </Pressable>
      {isOutgoing ? renderOutgoingMeta() : renderIncomingMeta()}
    </View>
  );

  const renderImageBubble = () => (
    <View>
      <Pressable
        style={styles.imageBubble}
        onPress={() => resolvedMediaUrl && onOpenImage(resolvedMediaUrl)}
        disabled={!resolvedMediaUrl}
        {...deleteProps}
      >
        <Image source={{ uri: resolvedMediaUrl! }} style={styles.messageImage} />
      </Pressable>
      {isOutgoing ? renderOutgoingMeta() : renderIncomingMeta()}
    </View>
  );

  const renderLocationBubble = () => (
    <View>
      <Pressable style={styles.locationCard} onPress={() => onOpenLocation(message)} {...deleteProps}>
        <View style={styles.locationMap}>
          <View style={[styles.mapRoad, styles.mapRoadOne]} />
          <View style={[styles.mapRoad, styles.mapRoadTwo]} />
          <View style={[styles.mapRoadVertical, styles.mapRoadThree]} />
          <View style={[styles.mapRoadVertical, styles.mapRoadFour]} />
          <View style={[styles.mapBlock, styles.mapBlockOne]} />
          <View style={[styles.mapBlock, styles.mapBlockTwo]} />
          <MaterialCommunityIcons
            name="map-marker"
            size={52}
            color="#EF4444"
            style={styles.locationMarker}
          />
        </View>
        <View style={styles.locationFooter}>
          <Text style={styles.locationFooterTitle}>Shared location</Text>
          <Text style={styles.locationFooterCoords}>
            {message.latitude?.toFixed(5)}, {message.longitude?.toFixed(5)}
          </Text>
        </View>
      </Pressable>
      {isOutgoing ? renderOutgoingMeta() : renderIncomingMeta()}
    </View>
  );

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
      <View style={styles.avatarFallback}>
        <Text style={styles.avatarFallbackText}>{avatarFallback}</Text>
      </View>
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

function ImageViewerModal({
  visible,
  imageUrl,
  onClose,
}: {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="#000" barStyle="light-content" />
      <View style={styles.viewerBackdrop}>
        <View style={styles.viewerTopBar}>
          <Pressable onPress={onClose} style={styles.viewerCloseButton}>
            <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
        <Image source={{ uri: imageUrl }} style={styles.viewerImage} resizeMode="contain" />
      </View>
    </Modal>
  );
}

function buildOutgoingMessage(params: {
  conversationId: number;
  senderId: number;
  recipientId: number | null;
  content: string;
  messageType: ChatMessageType;
  mediaUrl?: string | null;
  fileName?: string | null;
  mediaMimeType?: string | null;
  mediaSizeBytes?: number | null;
  durationSeconds?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}): ChatMessageDto {
  return {
    conversationId: params.conversationId,
    senderId: params.senderId,
    recipientId: params.recipientId,
    senderType: 'DRIVER',
    content: params.content,
    messageType: params.messageType,
    status: 'SENT',
    clientMessageId: `driver-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mediaUrl: params.mediaUrl ?? null,
    compressedMediaUrl: null,
    fileName: params.fileName ?? null,
    mediaMimeType: params.mediaMimeType ?? null,
    mediaSizeBytes: params.mediaSizeBytes ?? null,
    compressedSizeBytes: null,
    durationSeconds: params.durationSeconds ?? null,
    latitude: params.latitude ?? null,
    longitude: params.longitude ?? null,
    createdAt: new Date().toISOString(),
  };
}

function mergeMessages(current: ChatMessageDto[], incoming: ChatMessageDto[]) {
  const byKey = new Map<string, ChatMessageDto>();

  [...current, ...incoming].forEach((message) => {
    const existingClientKey =
      message.clientMessageId && findByClientId(byKey, message.clientMessageId);
    const key = existingClientKey ?? getMessageKey(message);
    byKey.set(key, { ...(byKey.get(key) ?? {}), ...message });
  });

  return Array.from(byKey.values()).sort(compareMessagesAsc);
}

function findByClientId(messages: Map<string, ChatMessageDto>, clientMessageId: string) {
  for (const [key, message] of messages.entries()) {
    if (message.clientMessageId === clientMessageId) {
      return key;
    }
  }
  return null;
}

function getMessageKey(message: ChatMessageDto) {
  return String(
    message.messageId ??
      message.clientMessageId ??
      `${message.senderId}-${message.createdAt ?? ''}-${message.messageType}-${message.content}`,
  );
}

function compareMessagesAsc(a: ChatMessageDto, b: ChatMessageDto) {
  return messageTime(a) - messageTime(b);
}

function compareMessagesDesc(a: ChatMessageDto, b: ChatMessageDto) {
  return messageTime(b) - messageTime(a);
}

function messageTime(message: ChatMessageDto) {
  const time = new Date(message.createdAt ?? '').getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatTime(timestamp?: string | null) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDayLabel(iso?: string | null) {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) {
    return 'Today';
  }
  if (isSameDay(date, yesterday)) {
    return 'Yesterday';
  }
  return date.toLocaleDateString();
}

function formatDuration(seconds?: number | null) {
  const totalSeconds = Math.max(0, Math.round(seconds ?? 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getParticipantAvatarFallback(type?: string | string[]) {
  const normalizedType = Array.isArray(type) ? type[0] : type;
  if (normalizedType === 'ADMIN') {
    return 'A';
  }
  if (normalizedType === 'DRIVER') {
    return 'D';
  }
  if (normalizedType === 'CORPORATE_USER') {
    return 'C';
  }
  return 'P';
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  headerRow: {
    minHeight: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E6ECF3',
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatarWrap: {
    position: 'relative',
  },
  headerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DDE5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarFallbackText: {
    fontSize: 14,
    fontWeight: "800",
    color: '#475569',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: '#1F2937',
  },
  headerOnlineDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    bottom: 0,
    right: 0,
  },
  headerStatusText: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    color: '#94A3B8',
  },
  headerStatusOnlineText: {
    color: '#22C55E',
  },
  headerStatusOfflineText: {
    color: '#94A3B8',
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
    alignItems: 'center',
  },
  dayPill: {
    alignSelf: 'center',
    backgroundColor: '#E9EEF7',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dayText: {
    fontSize: 11,
    fontWeight: "700",
    color: '#8A94A6',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowRight: {
    alignItems: 'flex-end',
  },
  avatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DDE5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 12,
    fontWeight: "800",
    color: '#475569',
  },
  bubbleLeft: {
    maxWidth: 230,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E6ECF3',
  },
  bubbleLeftText: {
    fontSize: 12,
    fontWeight: "600",
    color: '#4B5563',
  },
  timeLeft: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "600",
    color: '#9AA4B2',
  },
  bubbleRight: {
    maxWidth: 240,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1A73E8',
    borderRadius: 14,
    borderTopRightRadius: 4,
  },
  bubbleRightText: {
    fontSize: 12,
    fontWeight: "600",
    color: '#FFFFFF',
  },
  deletedText: {
    fontStyle: 'italic',
  },
  timeRightRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
  },
  timeRight: {
    fontSize: 10,
    fontWeight: "600",
    color: '#9AA4B2',
  },
  voiceBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  voiceBubbleIncoming: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6ECF3',
  },
  voiceBubbleOutgoing: {
    backgroundColor: '#1A73E8',
  },
  voicePlay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePlayIncoming: {
    backgroundColor: '#EAF1FF',
  },
  voicePlayOutgoing: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  voiceWaveWrap: {
    minWidth: 132,
  },
  voiceWave: {
    width: 126,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voiceWaveBar: {
    width: 3,
    borderRadius: 3,
    backgroundColor: '#8AA7BD',
    opacity: 0.72,
  },
  voiceWaveBarOutgoing: {
    backgroundColor: 'rgba(255,255,255,0.48)',
  },
  voiceWaveBarActive: {
    opacity: 1,
  },
  voiceTime: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: '#788598',
  },
  voiceTimeOutgoing: {
    color: 'rgba(255,255,255,0.76)',
  },
  imageBubble: {
    width: 220,
    borderRadius: 14,
    overflow: 'hidden',
  },
  messageImage: {
    width: '100%',
    height: 130,
  },
  locationCard: {
    width: 220,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#DDE5F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  locationMap: {
    height: 130,
    overflow: 'hidden',
    backgroundColor: '#172331',
  },
  mapRoad: {
    position: 'absolute',
    height: 12,
    borderRadius: 12,
    backgroundColor: '#334456',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.24)',
  },
  mapRoadVertical: {
    position: 'absolute',
    width: 12,
    borderRadius: 12,
    backgroundColor: '#3B4B5D',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.22)',
  },
  mapRoadOne: {
    left: -26,
    top: 28,
    width: 280,
    transform: [{ rotate: '-13deg' }],
  },
  mapRoadTwo: {
    left: -14,
    top: 84,
    width: 260,
    transform: [{ rotate: '8deg' }],
  },
  mapRoadThree: {
    left: 70,
    top: -28,
    height: 190,
    transform: [{ rotate: '23deg' }],
  },
  mapRoadFour: {
    left: 154,
    top: -24,
    height: 180,
    transform: [{ rotate: '-9deg' }],
  },
  mapBlock: {
    position: 'absolute',
    borderRadius: 12,
    backgroundColor: 'rgba(34,49,65,0.75)',
    borderWidth: 1,
    borderColor: '#34475A',
  },
  mapBlockOne: {
    left: 28,
    top: 20,
    width: 64,
    height: 48,
  },
  mapBlockTwo: {
    right: 20,
    bottom: 28,
    width: 80,
    height: 48,
  },
  locationMarker: {
    position: 'absolute',
    left: 84,
    top: 36,
    shadowColor: '#EF4444',
    shadowOpacity: 0.42,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  locationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: '#DDE5F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  locationFooterTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: '#465468',
  },
  locationFooterCoords: {
    fontSize: 10,
    fontWeight: "700",
    color: '#465468',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoading: {
    paddingVertical: 8,
  },
  errorText: {
    textAlign: 'center',
    color: '#D9534F',
    marginBottom: 12,
    fontSize: 12, fontWeight: "600",
  },
  retryButton: {
    backgroundColor: '#1A73E8',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: "600",
  },
  emptyText: {
    textAlign: 'center',
    color: '#6C8195',
    fontSize: 14, fontWeight: "600",
  },
  composerArea: {
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: '#F7F9FC',
    borderTopWidth: 1,
    borderTopColor: '#E6ECF3',
  },
  recordingBanner: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FECDD3',
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordingInfo: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordingMic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: '#B42318',
  },
  recordingMeta: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingTime: {
    fontSize: 11,
    fontWeight: "800",
    color: '#64748B',
  },
  recordingWave: {
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  recordingWaveBar: {
    width: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(239,68,68,0.72)',
  },
  recordingCancel: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6ECF3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputField: {
    flex: 1,
    height: 38,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6ECF3',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: '#1F2937',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A73E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingStopButton: {
    backgroundColor: '#EF4444',
  },
  disabledControl: {
    opacity: 0.42,
  },
  attachmentBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.32)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  attachmentSheet: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  attachmentTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: '#1F2937',
  },
  attachmentSubtitle: {
    marginTop: 3,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "600",
    color: '#8A94A6',
  },
  attachmentOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  attachmentOptionText: {
    fontSize: 14,
    fontWeight: "700",
    color: '#1F2937',
  },
  attachmentCancel: {
    marginTop: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  attachmentCancelText: {
    fontSize: 14,
    fontWeight: "800",
    color: '#B42318',
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerTopBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  viewerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '75%',
  },
});
