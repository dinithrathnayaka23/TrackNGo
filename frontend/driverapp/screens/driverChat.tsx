import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList, // FlatList for efficient rendering of conversation list
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ADMIN_SUPPORT_USER_ID } from '@/config/env';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import {
  createConversation,
  getConversationMessages,
  type ChatMessageDto,
  getUserConversations,
  type ChatParticipantType,
  type ConversationDto,
} from '@/services/chatApi';

interface Conversation { // Conversation type definition for the conversation list items
  id: string;
  name: string;
  message: string;
  timestamp: string;
  participantType: string;
  unreadCount: number;
  otherUserId?: number | null;
  otherUserType?: ChatParticipantType | null;
  isSupport: boolean;
  lastMessageSenderId?: number | null;
  lastMessageStatus?: string | null;
  lastMessageType?: string | null;
}

const DriverChatScreen = () => {
  const router = useRouter();
  const { user } = useUser(); // Access the user state from the UserContext
  const insets = useSafeAreaInsets(); // Get safe area insets for the status bar and navigation bar
  const { width } = useWindowDimensions(); // Get the width of the screen by using the useWindowDimensions hook
  const [searchQuery, setSearchQuery] = useState(''); // State for search query
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSmallPhone = width < 360;
  const horizontalPadding = isSmallPhone ? 14 : 16;

  const refreshConversations = useCallback(
    async (showLoading = false) => {
      if (!user?.userId || !user?.token) {
        setIsLoading(false);
        return;
      }

      try {
        if (showLoading) {
          setIsLoading(true);
        }
        setError(null);

        const result = await getUserConversations({
          token: user.token,
          userId: user.userId,
          page: 0,
          size: 20,
          q: searchQuery.trim() || undefined,
        });
        let items = Array.isArray(result.content) ? result.content : [];

        const supportConversation = items.find((item) =>
          isSupportConversation(item, user.userId)
        );

        if (!supportConversation && !searchQuery.trim()) {
          const createdSupportConversation = await createConversation({
            token: user.token,
            user1Id: user.userId,
            user1Type: 'DRIVER',
            user2Id: ADMIN_SUPPORT_USER_ID,
            user2Type: 'ADMIN',
          });
          items = [createdSupportConversation, ...items];
        }

        const mapped = dedupeConversations(items).map((item) =>
          mapConversation(item, user.userId)
        );
        const enriched = await Promise.all(
          mapped.map((item) => enrichConversationWithLatestMessage(item, user.token))
        );

        setConversations(enriched);
      } catch (fetchError) {
        console.error('Error fetching driver conversations:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load conversations');
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [searchQuery, user?.token, user?.userId]
  );

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      void refreshConversations(true);
    }, 250); // Delay the fetch by 250ms to avoid overloading the server with requests.
    return () => clearTimeout(debounceTimer); // Clear the debounce timer if the component unmounts or if the search query changes before the timer completes, preventing unnecessary API calls and ensuring that we only fetch conversations when the user has paused typing.
  }, [refreshConversations]); // Re-run the effect whenever the search query changes or when the user's authentication information changes, ensuring that we always have the most up-to-date conversations based on the current search criteria and user context.

  useFocusEffect(
    useCallback(() => {
      void refreshConversations(conversations.length === 0);

      const refreshTimer = setInterval(() => {
        void refreshConversations(false);
      }, 4000);

      return () => clearInterval(refreshTimer);
    }, [conversations.length, refreshConversations])
  );

  const filteredConversations = useMemo(() => {   // useMemo to memoize the filtered conversations based on the search query and the full conversations list. This optimization prevents unnecessary re-computation of the filtered list on every render, improving performance, especially when the conversations list is large.
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations; // If there is no search query, return the full list of conversations

    return conversations.filter((item) => (   // Filter the conversations based on the search query, checking if the query is included in the participant's name, last message, timestamp, or participant type. This allows users to quickly find relevant conversations by typing keywords related to any of these fields.
      item.name.toLowerCase().includes(query) ||
      item.message.toLowerCase().includes(query) || // message is the last message
      item.timestamp.toLowerCase().includes(query) ||
      item.participantType.toLowerCase().includes(query)
    ));
  }, [conversations, searchQuery]);

  const { darkMode } = useTheme();

  const theme = useMemo(() => ({
    background: darkMode ? '#111' : '#F5F5F5',
    card: darkMode ? '#1E1E1E' : '#FFF',
    text: darkMode ? '#FFF' : '#000',
    secondaryText: darkMode ? '#AAA' : '#666',
    border: darkMode ? '#333' : '#E0E0E0',
    accent: '#0066FF',
    accentSoft: darkMode ? '#102646' : '#EAF2FF',
  }), [darkMode]);

  const styles = useMemo(
    () =>
      createStyles({
        horizontalPadding,
        bottomInset: insets.bottom,
        isSmallPhone,
        theme,
      }),
    [horizontalPadding, insets.bottom, isSmallPhone, theme]
  );

  const renderConversation = ({ item }: { item: Conversation }) => {
    const hasUnread = item.unreadCount > 0;
    const isOutgoingLast = item.lastMessageSenderId === user?.userId;

    return (
      <TouchableOpacity
        style={[styles.conversationItem, hasUnread && styles.conversationItemUnread]}
        onPress={() =>
          router.push({
            pathname: '/chat/[id]',
            params: {
              id: item.id,
              name: item.name,
              otherUserId: item.otherUserId ? String(item.otherUserId) : '',
              otherUserType: item.otherUserType ?? '',
            },
          })
        }
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, item.isSupport && styles.avatarSupport]}>
            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
          </View>
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text
              style={[styles.conversationName, hasUnread && styles.conversationNameUnread]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
          </View>

          <View style={styles.messagePreviewRow}>
            {isOutgoingLast ? <ListReadTick status={item.lastMessageStatus} /> : null}
            <Text
              style={[styles.conversationMessage, hasUnread && styles.conversationMessageUnread]}
              numberOfLines={1}
            >
              {item.message}
            </Text>
          </View>

          {!!item.participantType && (
            <Text style={styles.participantTypeText} numberOfLines={1}>
              {item.isSupport ? 'Admin Support' : item.participantType}
            </Text>
          )}
        </View>

        <View style={styles.conversationMeta}>
          <Text
            style={[styles.conversationTime, hasUnread && styles.conversationTimeUnread]}
            numberOfLines={1}
          >
            {item.timestamp}
          </Text>
          {hasUnread ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerSide} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            Messages
          </Text>

          <View style={styles.headerSide} />
        </View>

        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#0066FF" />
            <Text style={styles.stateText}>Loading conversations...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <MaterialCommunityIcons name="alert-circle" size={40} color="#FF6B6B" />
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredConversations}
            renderItem={renderConversation}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <MaterialCommunityIcons name="chat-outline" size={40} color="#999" />
                <Text style={styles.stateText}>No conversations found</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

function getInitials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'U'
  );
}

function formatParticipantType(type?: string) {
  if (!type) {
    return '';
  }

  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getOtherParticipant(item: ConversationDto, currentUserId: number) {
  if (item.participant1Id === currentUserId) {
    return {
      id: item.participant2Id,
      type: item.participant2Type,
      unreadCount: item.participant1Unread ?? item.unreadCount ?? 0,
    };
  }

  if (item.participant2Id === currentUserId) {
    return {
      id: item.participant1Id,
      type: item.participant1Type,
      unreadCount: item.participant2Unread ?? item.unreadCount ?? 0,
    };
  }

  return {
    id: item.otherParticipantId,
    type: item.otherParticipantType,
    unreadCount: item.unreadCount ?? 0,
  };
}

function isSupportConversation(item: ConversationDto, currentUserId: number) {
  const other = getOtherParticipant(item, currentUserId);
  return other.id === ADMIN_SUPPORT_USER_ID && other.type === 'ADMIN';
}

function dedupeConversations(items: ConversationDto[]) {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.conversationId)) {
      return false;
    }
    seen.add(item.conversationId);
    return true;
  });
}

function mapConversation(item: ConversationDto, currentUserId: number): Conversation {
  const other = getOtherParticipant(item, currentUserId);
  const isSupport = other.id === ADMIN_SUPPORT_USER_ID && other.type === 'ADMIN';
  const participantType = formatParticipantType(other.type ?? item.otherParticipantType ?? undefined);
  const fallbackName = other.id ? `User #${other.id}` : `Conversation #${item.conversationId}`;

  return {
    id: String(item.conversationId),
    name: isSupport ? 'Admin Support' : item.otherParticipantName ?? fallbackName,
    message: formatConversationPreview(item.lastMessage, item.lastMessageType),
    timestamp: formatTimestamp(item.lastMessageTimestamp ?? undefined),
    participantType,
    unreadCount: other.unreadCount,
    otherUserId: other.id ?? item.otherParticipantId,
    otherUserType: other.type ?? item.otherParticipantType,
    isSupport,
    lastMessageType: item.lastMessageType,
  };
}

async function enrichConversationWithLatestMessage(
  conversation: Conversation,
  token: string
): Promise<Conversation> {
  try {
    const result = await getConversationMessages({
      token,
      conversationId: Number(conversation.id),
      page: 0,
      size: 1,
    });
    const latest = result.content?.[0];
    if (!latest) {
      return conversation;
    }

    return {
      ...conversation,
      message: formatMessagePreview(latest),
      lastMessageSenderId: latest.senderId,
      lastMessageStatus: latest.status,
      lastMessageType: latest.messageType,
      timestamp: formatTimestamp(latest.createdAt ?? undefined) || conversation.timestamp,
    };
  } catch {
    return conversation;
  }
}

function formatConversationPreview(lastMessage?: string | null, messageType?: string | null) {
  if (lastMessage?.trim()) {
    return lastMessage;
  }
  if (messageType === 'IMAGE') return 'Photo';
  if (messageType === 'VOICE') return 'Voice message';
  if (messageType === 'LOCATION') return 'Shared location';
  return 'No messages yet';
}

function formatMessagePreview(message: ChatMessageDto) {
  if (message.deleted) return 'Message deleted';
  if (message.messageType === 'IMAGE') return 'Photo';
  if (message.messageType === 'VOICE') return 'Voice message';
  if (message.messageType === 'LOCATION') return 'Shared location';
  return message.content || 'Message';
}

function ListReadTick({ status }: { status?: string | null }) {
  const isRead = status === 'READ';
  const isDelivered = status === 'DELIVERED' || isRead;

  return (
    <MaterialCommunityIcons
      name={isDelivered ? 'check-all' : 'check'}
      size={14}
      color={isRead ? '#0066FF' : '#94A3B8'}
      style={stylesStatic.listTick}
    />
  );
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function createStyles({
  horizontalPadding,
  bottomInset,
  isSmallPhone,
  theme,
}: {
  horizontalPadding: number;
  bottomInset: number;
  isSmallPhone: boolean;
  theme: any;
}) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: horizontalPadding,
      paddingVertical: 14,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerSide: {
      width: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: isSmallPhone ? 16 : 17,
      fontWeight: '700',
      color: theme.text,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: horizontalPadding,
      marginVertical: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.card,
      borderRadius: 8,
    },
    searchInput: {
      flex: 1,
      marginLeft: 8,
      fontSize: 13,
      color: theme.text,
    },
    listContent: {
      paddingHorizontal: 8,
      paddingBottom: Math.max(16, bottomInset + 8),
      flexGrow: 1,
    },
    conversationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    conversationItemUnread: {
      backgroundColor: theme.accentSoft,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: 12,
      flexShrink: 0,
    },
    avatar: {
      width: isSmallPhone ? 44 : 48,
      height: isSmallPhone ? 44 : 48,
      borderRadius: 999,
      backgroundColor: '#0066FF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarSupport: {
      backgroundColor: '#00AA00',
    },
    avatarText: {
      fontSize: isSmallPhone ? 14 : 16,
      fontWeight: '700',
      color: '#FFF',
    },
    unreadBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      marginTop: 6,
    },
    unreadBadgeText: {
      color: '#FFF',
      fontSize: 9,
      fontWeight: '700',
    },
    conversationContent: {
      flex: 1,
      minWidth: 0,
    },
    conversationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    conversationName: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginRight: 8,
    },
    conversationNameUnread: {
      fontWeight: '800',
    },
    messagePreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
    },
    conversationTime: {
      fontSize: 11,
      color: theme.secondaryText,
      fontWeight: '600',
      flexShrink: 0,
    },
    conversationTimeUnread: {
      color: theme.accent,
      fontWeight: '800',
    },
    conversationMessage: {
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      color: theme.secondaryText,
    },
    conversationMessageUnread: {
      color: theme.text,
      fontWeight: '800',
    },
    conversationMeta: {
      alignItems: 'flex-end',
      alignSelf: 'stretch',
      justifyContent: 'center',
      marginLeft: 10,
      minWidth: 54,
    },
    participantTypeText: {
      fontSize: 10,
      color: '#999',
      marginTop: 3,
      fontWeight: '500',
    },
    centerState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 40,
    },
    stateText: {
      marginTop: 10,
      fontSize: 13,
      color: theme.secondaryText,
      textAlign: 'center',
    },
  });
}

const stylesStatic = StyleSheet.create({
  listTick: {
    marginRight: 3,
  },
});

export default DriverChatScreen;
