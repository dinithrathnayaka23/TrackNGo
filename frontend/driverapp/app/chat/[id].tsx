import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import {
  getConversationMessages,
  markConversationDelivered,
  markConversationRead,
  sendConversationMessage,
  uploadMedia,
  type ChatMessageDto,
  type ChatMessageType,
} from '@/services/chatApi';
import { resolveAssetUrl } from '@/utils/media';

const WAVEFORM_BARS = [12, 24, 16, 34, 20, 42, 18, 30, 14, 38, 22, 32, 16, 28];

export default function ChatScreen() {
  const { id, name, otherUserId, otherUserType } = useLocalSearchParams<{
    id?: string;
    name?: string;
    otherUserId?: string;
    otherUserType?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();
  const { user } = useUser();
  const flatListRef = useRef<FlatList<ChatMessageDto>>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingStartedAtRef = useRef(0);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [playingMessageKey, setPlayingMessageKey] = useState<string | null>(null);

  const conversationId = Number(id);
  const recipientId = Number(otherUserId);
  const hasConversation = Number.isFinite(conversationId) && conversationId > 0;
  const hasRecipient = Number.isFinite(recipientId) && recipientId > 0;
  const isRecording = !!recording;
  const participantLabel = formatParticipantLabel(otherUserType);

  const theme = useMemo(
    () => ({
      background: darkMode ? '#111' : '#F5F7FB',
      panel: darkMode ? '#1A1A1A' : '#F7F7F7',
      card: darkMode ? '#1F1F1F' : '#FFF',
      text: darkMode ? '#FFF' : '#1F2937',
      secondaryText: darkMode ? '#AAA' : '#667085',
      border: darkMode ? '#333' : '#E0E0E0',
      mine: darkMode ? '#102646' : '#EAF2FF',
      mineText: darkMode ? '#FFF' : '#0F172A',
      theirs: darkMode ? '#242424' : '#FFF',
      accent: '#0066FF',
      blue: '#0066FF',
    }),
    [darkMode]
  );

  const sortedMessages = useMemo(() => [...messages].sort(compareMessages), [messages]);

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
      // Chat stays usable if receipt updates fail briefly.
    }
  }, [conversationId, hasConversation, user?.token, user?.userId]);

  const loadMessages = useCallback(
    async (showLoading = true) => {
      if (!hasConversation || !user?.token || !user.userId) {
        setIsLoading(false);
        return;
      }

      try {
        if (showLoading) {
          setIsLoading(true);
        }

        const result = await getConversationMessages({
          token: user.token,
          conversationId,
          page: 0,
          size: 80,
        });

        const incoming = Array.isArray(result.content) ? result.content : [];
        setMessages((current) => mergeMessages(current, incoming));
        setError(null);

        if (incoming.some((message) => message.senderId !== user.userId)) {
          void markThreadSeen();
        }
      } catch (fetchError) {
        console.error('Error fetching chat messages:', fetchError);
        if (showLoading) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load messages');
        }
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [conversationId, hasConversation, markThreadSeen, user?.token, user?.userId]
  );

  useEffect(() => {
    void loadMessages(true);

    const refreshTimer = setInterval(() => {
      void loadMessages(false);
    }, 3000);

    return () => clearInterval(refreshTimer);
  }, [loadMessages]);

  useEffect(() => {
    if (sortedMessages.length > 0) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, [sortedMessages.length]);

  useEffect(() => {
    if (!isRecording) {
      return undefined;
    }

    const timer = setInterval(() => {
      setRecordingElapsed(
        Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)
      );
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
    [recording]
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
        void loadMessages(false);
      } catch (sendError) {
        console.error('Error sending chat message:', sendError);
        setMessages((current) =>
          current.filter((item) => item.clientMessageId !== message.clientMessageId)
        );
        Alert.alert('Send failed', failureMessage);
      }
    },
    [conversationId, loadMessages, user?.token, user?.userId]
  );

  const sendText = async () => {
    const content = draft.trim();
    if (!content || !hasConversation || !user?.token || !user.userId || isSending) {
      return;
    }

    setIsSending(true);
    setDraft('');
    try {
      await persistOutgoingMessage(
        buildOutgoingMessage({
          conversationId,
          senderId: user.userId,
          recipientId: hasRecipient ? recipientId : null,
          content,
          messageType: 'TEXT',
        }),
        'Could not send this message.'
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
        'Could not send this image.'
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
        'Could not send your location.'
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
        'Could not send this voice message.'
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

  const toggleVoicePlayback = async (message: ChatMessageDto) => {
    const messageKey = getMessageKey(message);
    const mediaUrl = resolveAssetUrl(message.mediaUrl);
    if (!mediaUrl) {
      return;
    }

    if (playingMessageKey === messageKey) {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
      soundRef.current = null;
      setPlayingMessageKey(null);
      return;
    }

    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: mediaUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlayingMessageKey(messageKey);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingMessageKey(null);
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

    void Linking.openURL(
      `https://www.google.com/maps?q=${message.latitude},${message.longitude}`
    );
  };

  const renderMessage = ({ item }: { item: ChatMessageDto }) => {
    const mine = item.senderId === user?.userId;
    return (
      <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}>
        <View
          style={[
            styles.messageBubble,
            mine
              ? [styles.messageBubbleMine, { backgroundColor: theme.mine }]
              : [
                  styles.messageBubbleTheirs,
                  { backgroundColor: theme.theirs, borderColor: theme.border },
                ],
          ]}
        >
          {renderMessageBody(item, mine, theme, {
            onOpenImage: openImage,
            onOpenLocation: openLocation,
            onPlayVoice: toggleVoicePlayback,
            playingMessageKey,
          })}

          <View style={styles.messageMeta}>
            <Text
              style={[
                styles.messageTime,
                { color: mine ? 'rgba(17,24,39,0.62)' : theme.secondaryText },
              ]}
            >
              {formatMessageTime(item.createdAt)}
            </Text>
            {mine ? <ReadTick status={item.status} /> : null}
          </View>
        </View>
      </View>
    );
  };

  const inputPlaceholder =
    otherUserType === 'ADMIN' ? 'Message admin support...' : 'Message...';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{getInitial(name)}</Text>
        </View>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {name || `Chat ${id}`}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]} numberOfLines={1}>
            {participantLabel}
          </Text>
        </View>

        <View style={styles.headerButton} />
      </View>

      {isLoading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.subText, { color: theme.secondaryText }]}>
            Loading conversation...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <MaterialCommunityIcons name="alert-circle" size={36} color="#FF6B6B" />
          <Text style={[styles.subText, { color: theme.secondaryText }]}>{error}</Text>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={sortedMessages}
            keyExtractor={getMessageKey}
            renderItem={renderMessage}
            contentContainerStyle={[
              styles.messagesList,
              { paddingBottom: Math.max(14, insets.bottom + 8) },
            ]}
            ListEmptyComponent={
              <View style={styles.stateContainer}>
                <MaterialCommunityIcons name="message-outline" size={36} color="#999" />
                <Text style={[styles.subText, { color: theme.secondaryText }]}>No messages yet</Text>
              </View>
            }
          />

          {isRecording ? (
            <View style={[styles.recordingBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
              <View style={styles.recordingInfo}>
                <View style={styles.recordingDot} />
                <Text style={[styles.recordingText, { color: theme.text }]}>
                  Recording {formatDuration(recordingElapsed)}
                </Text>
              </View>
              <TouchableOpacity style={styles.recordingIconButton} onPress={cancelRecording}>
                <MaterialCommunityIcons name="close" size={22} color="#EF4444" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.recordingSendButton} onPress={stopRecordingAndSend}>
                <MaterialCommunityIcons name="check" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.inputBar, { backgroundColor: theme.panel, borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={styles.inputIconButton}
                onPress={() => setAttachmentMenuVisible(true)}
              >
                <MaterialCommunityIcons name="paperclip" size={24} color={theme.secondaryText} />
              </TouchableOpacity>

              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.card,
                  },
                ]}
                placeholder={inputPlaceholder}
                placeholderTextColor="#999"
                value={draft}
                onChangeText={setDraft}
                multiline
              />

              {draft.trim() ? (
                <TouchableOpacity
                  style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
                  onPress={sendText}
                  disabled={isSending}
                >
                  <MaterialCommunityIcons name="send" size={20} color="#FFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
                  onPress={startRecording}
                  disabled={isSending}
                >
                  <MaterialCommunityIcons name="microphone" size={22} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}

      <AttachmentMenu
        visible={attachmentMenuVisible}
        onClose={() => setAttachmentMenuVisible(false)}
        onCamera={captureImage}
        onGallery={pickImage}
        onLocation={shareLocation}
        theme={theme}
      />
    </SafeAreaView>
  );
}

function renderMessageBody(
  message: ChatMessageDto,
  mine: boolean,
  theme: ReturnType<typeof getThemeShape>,
  handlers: {
    onOpenImage: (url: string) => void;
    onOpenLocation: (message: ChatMessageDto) => void;
    onPlayVoice: (message: ChatMessageDto) => void;
    playingMessageKey: string | null;
  }
) {
  if (message.deleted) {
    return (
      <Text style={[styles.deletedText, { color: mine ? theme.mineText : theme.secondaryText }]}>
        Message deleted
      </Text>
    );
  }

  if (message.messageType === 'IMAGE') {
    const imageUrl = resolveAssetUrl(message.mediaUrl ?? message.compressedMediaUrl);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => (imageUrl ? handlers.onOpenImage(imageUrl) : undefined)}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.messageImage} />
        ) : (
          <View style={styles.mediaPlaceholder}>
            <MaterialCommunityIcons name="image-off" size={24} color="#94A3B8" />
          </View>
        )}
        {!!message.content && (
          <Text style={[styles.messageText, { color: mine ? theme.mineText : theme.text }]}>
            {message.content}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  if (message.messageType === 'VOICE') {
    const playing = handlers.playingMessageKey === getMessageKey(message);
    return (
      <TouchableOpacity
        style={styles.voiceBody}
        activeOpacity={0.85}
        onPress={() => handlers.onPlayVoice(message)}
      >
      <View style={[styles.voicePlayButton, mine ? styles.voicePlayMine : styles.voicePlayTheirs]}>
          <MaterialCommunityIcons
            name={playing ? 'pause' : 'play'}
            size={18}
            color={mine ? '#0066FF' : '#FFF'}
          />
        </View>
        <View style={styles.waveform}>
          {WAVEFORM_BARS.map((height, index) => (
            <View
              key={`${getMessageKey(message)}-${index}`}
              style={[
                styles.waveBar,
                {
                  height,
                  backgroundColor: mine ? 'rgba(0,102,255,0.42)' : '#94A3B8',
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.voiceDuration, { color: mine ? theme.mineText : theme.secondaryText }]}>
          {formatDuration(message.durationSeconds)}
        </Text>
      </TouchableOpacity>
    );
  }

  if (message.messageType === 'LOCATION') {
    return (
      <TouchableOpacity
        style={styles.locationCard}
        activeOpacity={0.85}
        onPress={() => handlers.onOpenLocation(message)}
      >
        <View style={styles.locationMap}>
          <MaterialCommunityIcons name="map-marker" size={32} color="#EF4444" />
        </View>
        <View style={styles.locationInfo}>
          <Text style={[styles.locationTitle, { color: mine ? theme.mineText : theme.text }]}>
            Shared location
          </Text>
          <Text style={[styles.locationCoords, { color: mine ? theme.mineText : theme.secondaryText }]}>
            {formatCoordinate(message.latitude)}, {formatCoordinate(message.longitude)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <Text style={[styles.messageText, { color: mine ? theme.mineText : theme.text }]}>
      {message.content}
    </Text>
  );
}

function AttachmentMenu({
  visible,
  onClose,
  onCamera,
  onGallery,
  onLocation,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onLocation: () => void;
  theme: ReturnType<typeof getThemeShape>;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.attachmentSheet, { backgroundColor: theme.card }]}>
          <AttachmentAction icon="camera" label="Camera" color="#2563EB" onPress={onCamera} />
          <AttachmentAction icon="image" label="Gallery" color="#7C3AED" onPress={onGallery} />
          <AttachmentAction icon="map-marker" label="Location" color="#16A34A" onPress={onLocation} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AttachmentAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.attachmentAction} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.attachmentIcon, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={icon} size={22} color="#FFF" />
      </View>
      <Text style={styles.attachmentLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ReadTick({ status }: { status?: string | null }) {
  const isRead = status === 'READ';
  const isDelivered = status === 'DELIVERED' || isRead;
  return (
    <MaterialCommunityIcons
      name={isDelivered ? 'check-all' : 'check'}
      size={15}
      color={isRead ? '#0066FF' : '#7A8793'}
    />
  );
}

function getThemeShape() {
  return {
    background: '',
    panel: '',
    card: '',
    text: '',
    secondaryText: '',
    border: '',
    mine: '',
    mineText: '',
    theirs: '',
    accent: '',
    blue: '',
  };
}

function openImage(url: string) {
  void Linking.openURL(url);
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

  return Array.from(byKey.values()).sort(compareMessages);
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
      `${message.senderId}-${message.createdAt ?? ''}-${message.messageType}-${message.content}`
  );
}

function compareMessages(a: ChatMessageDto, b: ChatMessageDto) {
  const aTime = new Date(a.createdAt ?? '').getTime();
  const bTime = new Date(b.createdAt ?? '').getTime();
  return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
}

function formatMessageTime(timestamp?: string | null) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(seconds?: number | null) {
  const totalSeconds = Math.max(0, Math.round(seconds ?? 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatCoordinate(value?: number | null) {
  return typeof value === 'number' ? value.toFixed(5) : '--';
}

function getInitial(name?: string) {
  return name?.trim()?.charAt(0)?.toUpperCase() || 'C';
}

function formatParticipantLabel(type?: string) {
  if (type === 'ADMIN') {
    return 'Admin Support';
  }
  if (type === 'PASSENGER') {
    return 'Passenger';
  }
  if (type === 'DRIVER') {
    return 'Driver';
  }
  if (type === 'CORPORATE_USER') {
    return 'Corporate User';
  }
  return 'Chat';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerAvatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  messagesList: {
    paddingHorizontal: 10,
    paddingTop: 14,
    flexGrow: 1,
  },
  subText: {
    marginTop: 10,
    fontSize: 12,
    textAlign: 'center',
  },
  messageRow: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    minWidth: 72,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  messageBubbleMine: {
    borderBottomRightRadius: 3,
  },
  messageBubbleTheirs: {
    borderBottomLeftRadius: 3,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  deletedText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    fontWeight: '600',
  },
  messageImage: {
    width: 210,
    height: 150,
    borderRadius: 10,
    marginBottom: 5,
    backgroundColor: '#E5E7EB',
  },
  mediaPlaceholder: {
    width: 210,
    height: 120,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
    marginBottom: 5,
  },
  voiceBody: {
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  voicePlayButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePlayMine: {
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  voicePlayTheirs: {
    backgroundColor: '#0066FF',
  },
  waveform: {
    flex: 1,
    minWidth: 92,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  voiceDuration: {
    fontSize: 11,
    fontWeight: '700',
  },
  locationCard: {
    width: 220,
    overflow: 'hidden',
    borderRadius: 10,
  },
  locationMap: {
    height: 88,
    backgroundColor: '#DDE9E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    paddingTop: 8,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  locationCoords: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
  },
  inputIconButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 118,
    borderWidth: 1,
    borderRadius: 21,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '800',
  },
  recordingIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
  },
  recordingSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0066FF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.24)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 78,
  },
  attachmentSheet: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  attachmentAction: {
    alignItems: 'center',
    gap: 8,
    minWidth: 72,
  },
  attachmentIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#344054',
  },
});
