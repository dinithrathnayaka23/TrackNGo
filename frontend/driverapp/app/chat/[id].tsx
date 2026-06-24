import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import {
  getConversationMessages,
  markConversationRead,
  sendConversationMessage,
  type ChatMessageDto,
} from '@/services/chatApi';

interface Message {
  id: string;
  senderId: number;
  content: string;
  createdAt: string;
  isMine: boolean;
}

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
  const flatListRef = useRef<FlatList<Message>>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationId = Number(id);
  const recipientId = Number(otherUserId);
  const hasConversation = Number.isFinite(conversationId) && conversationId > 0;
  const hasRecipient = Number.isFinite(recipientId) && recipientId > 0;

  const theme = useMemo(
    () => ({
      background: darkMode ? '#111' : '#F5F5F5',
      card: darkMode ? '#1E1E1E' : '#FFF',
      text: darkMode ? '#FFF' : '#000',
      secondaryText: darkMode ? '#AAA' : '#666',
      border: darkMode ? '#333' : '#E0E0E0',
      mine: '#0066FF',
      mineText: '#FFF',
      theirs: darkMode ? '#222' : '#FFF',
    }),
    [darkMode]
  );

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
          size: 50,
        });

        const items = Array.isArray(result.content) ? result.content : [];
        const mapped = items
          .map((item) => mapMessage(item, user.userId))
          .sort(compareMessages);

        setMessages((current) => mergeMessages(current, mapped));
        setError(null);

        await markConversationRead({
          token: user.token,
          conversationId,
          userId: user.userId,
        });
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
    [conversationId, hasConversation, user?.token, user?.userId]
  );

  useEffect(() => {
    void loadMessages(true);

    const refreshTimer = setInterval(() => {
      void loadMessages(false);
    }, 4000);

    return () => clearInterval(refreshTimer);
  }, [loadMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim() || !hasConversation || !user?.token || !user.userId) {
      return;
    }

    try {
      setIsSending(true);

      const saved = await sendConversationMessage({
        token: user.token,
        conversationId,
        message: {
          senderId: user.userId,
          recipientId: hasRecipient ? recipientId : null,
          senderType: 'DRIVER',
          content: draft.trim(),
          messageType: 'TEXT',
        },
      });

      setMessages((current) =>
        mergeMessages(current, [mapMessage(saved, user.userId)])
      );
      setDraft('');
      setError(null);
      void loadMessages(false);
    } catch (sendError) {
      console.error('Error sending chat message:', sendError);
      setError(sendError instanceof Error ? sendError.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageRow,
        item.isMine ? styles.messageRowMine : styles.messageRowTheirs,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          item.isMine
            ? [styles.messageBubbleMine, { backgroundColor: theme.mine }]
            : [
                styles.messageBubbleTheirs,
                { backgroundColor: theme.theirs, borderColor: theme.border },
              ],
        ]}
      >
        <Text style={[styles.messageText, { color: item.isMine ? theme.mineText : theme.text }]}>
          {item.content}
        </Text>
        <Text
          style={[
            styles.messageTime,
            { color: item.isMine ? 'rgba(255,255,255,0.8)' : theme.secondaryText },
          ]}
        >
          {formatMessageTime(item.createdAt)}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0066FF" />
        </TouchableOpacity>

        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {name || `Chat ${id}`}
        </Text>

        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#0066FF" />
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
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={[
              styles.messagesList,
              { paddingBottom: Math.max(16, insets.bottom + 8) },
            ]}
            ListEmptyComponent={
              <View style={styles.stateContainer}>
                <MaterialCommunityIcons name="message-outline" size={36} color="#999" />
                <Text style={[styles.subText, { color: theme.secondaryText }]}>No messages yet</Text>
              </View>
            }
          />

          <View style={[styles.inputBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
              placeholder={
                otherUserType === 'ADMIN' ? 'Message admin support...' : 'Type a message...'
              }
              placeholderTextColor="#999"
              value={draft}
              onChangeText={setDraft}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!draft.trim() || isSending}
            >
              <MaterialCommunityIcons name="send" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function mapMessage(item: ChatMessageDto, currentUserId: number): Message {
  const createdAt = item.createdAt ?? new Date().toISOString();
  return {
    id: String(item.messageId ?? `${item.senderId}-${createdAt}-${item.content}`),
    senderId: item.senderId,
    content: item.deleted ? 'Message deleted' : item.content ?? '',
    createdAt,
    isMine: item.senderId === currentUserId,
  };
}

function mergeMessages(current: Message[], incoming: Message[]) {
  const byId = new Map<string, Message>();

  [...current, ...incoming].forEach((message) => {
    byId.set(message.id, message);
  });

  return Array.from(byId.values()).sort(compareMessages);
}

function compareMessages(a: Message, b: Message) {
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  return aTime - bTime;
}

function formatMessageTime(timestamp?: string) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    flex: 1,
    marginHorizontal: 12,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  subText: {
    marginTop: 10,
    fontSize: 12,
    textAlign: 'center',
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageBubbleMine: {
    borderBottomRightRadius: 4,
  },
  messageBubbleTheirs: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
});
