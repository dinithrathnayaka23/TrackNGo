import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ADMIN_SUPPORT_USER_ID } from '@/config/env';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslateFn } from '@/locales';
import {
  createConversation,
  getConversationMessages,
  type ChatMessageDto,
  getUserConversations,
  type ChatParticipantType,
  type ConversationDto,
} from '@/services/chatApi';

interface Conversation {
  id: string;
  name: string;
  message: string;
  timestamp: string;
  unreadCount: number;
  otherUserId?: number | null;
  otherUserType?: ChatParticipantType | null;
  isSupport: boolean;
  lastMessageSenderId?: number | null;
  lastMessageStatus?: string | null;
  lastMessageType?: string | null;
  lastMessageTimestamp?: string | null;
}

export default function DriverChatScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [last, setLast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = useMemo(() => query.trim(), [query]);

  const refreshConversations = useCallback(
    async (targetPage = 0, reset = true, showLoading = false) => {
      if (!user?.userId || !user?.token) {
        setIsLoading(false);
        return;
      }

      try {
        if (targetPage === 0 && showLoading) {
          setIsLoading(true);
        } else if (targetPage > 0) {
          setIsLoadingMore(true);
        }
        setError(null);

        const result = await getUserConversations({
          token: user.token,
          userId: user.userId,
          page: targetPage,
          size: 20,
          q: trimmed || undefined,
        });

        let items = Array.isArray(result.content) ? result.content : [];
        const supportConversation = items.find((item) =>
          isSupportConversation(item, user.userId),
        );

        if (!supportConversation && !trimmed && targetPage === 0) {
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
          mapConversation(item, user.userId, t),
        );
        const enriched = await Promise.all(
          mapped.map((item) => enrichConversationWithLatestMessage(item, user.token, t)),
        );

        setPage(result.page ?? targetPage);
        setLast(result.last ?? true);
        setConversations((current) =>
          reset
            ? pinSupportAndSort(enriched)
            : pinSupportAndSort([...current, ...enriched]),
        );
      } catch (fetchError) {
        console.error('Error fetching driver conversations:', fetchError);
        if (reset) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : t('chat.failedToLoadConversations'),
          );
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [trimmed, user?.token, user?.userId, t],
  );

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      void refreshConversations(0, true, true);
    }, 250);
    return () => clearTimeout(debounceTimer);
  }, [refreshConversations]);

  useFocusEffect(
    useCallback(() => {
      void refreshConversations(0, true, conversations.length === 0);

      const refreshTimer = setInterval(() => {
        void refreshConversations(0, true, false);
      }, 4000);

      return () => clearInterval(refreshTimer);
    }, [conversations.length, refreshConversations]),
  );

  const visibleConversations = useMemo(() => {
    if (!trimmed) {
      return conversations;
    }
    const normalizedQuery = normalizeSearchValue(trimmed);
    return conversations.filter(
      (item) =>
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.message.toLowerCase().includes(normalizedQuery),
    );
  }, [conversations, trimmed]);

  const openConversation = (item: Conversation) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: item.id,
        name: item.name,
        otherUserId: item.otherUserId ? String(item.otherUserId) : '',
        otherUserType: item.otherUserType ?? '',
      },
    });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('chat.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('chat.searchPlaceholder')}
          placeholderTextColor="#A6B0C3"
          returnKeyType="search"
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#1A73E8" />
        </View>
      ) : (
        <FlatList
          data={visibleConversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          renderItem={({ item }) => {
            const unread = item.unreadCount;
            const title = item.name;
            const fallback = getParticipantAvatarFallback(
              item.otherUserType,
              item.isSupport,
            );
            const isOutgoingLast = item.lastMessageSenderId === user?.userId;

            return (
              <Pressable style={styles.chatItem} onPress={() => openConversation(item)}>
                <View style={styles.avatarWrap}>
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>{fallback}</Text>
                  </View>
                </View>

                <View style={styles.chatBody}>
                  <Text style={styles.chatTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <View style={styles.previewRow}>
                    {isOutgoingLast ? (
                      <ListReadTick status={item.lastMessageStatus} />
                    ) : null}
                    <Text style={styles.chatSubtitle} numberOfLines={1}>
                      {item.message}
                    </Text>
                  </View>
                </View>

                <View style={styles.chatMeta}>
                  <Text style={styles.chatTime}>
                    {getConversationTimeLabel(item.lastMessageTimestamp, t)}
                  </Text>
                  {unread > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {unread > 99 ? '99+' : unread}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          onEndReached={() => {
            if (!isLoadingMore && !last) {
              void refreshConversations(page + 1, false, false);
            }
          }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            error ? (
              <View style={styles.centered}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable
                  style={styles.retryButton}
                  onPress={() => refreshConversations(0, true, true)}
                >
                  <Text style={styles.retryText}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>{t('chat.noConversations')}</Text>
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
    </SafeAreaView>
  );
}

function normalizeSearchValue(value?: string | number | null) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function timestampValue(timestamp?: string | null) {
  if (!timestamp) {
    return null;
  }
  const value = new Date(timestamp).getTime();
  return Number.isNaN(value) ? null : value;
}

function getConversationTimeLabel(timestamp: string | null | undefined, t: TranslateFn) {
  const dayLabel = formatDayLabel(timestamp, t);
  if (dayLabel === t('chat.today')) {
    return formatTime(timestamp) || dayLabel;
  }
  return dayLabel || '';
}

function formatTime(iso?: string | null) {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(iso: string | null | undefined, t: TranslateFn) {
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
  const isSameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  if (isSameDay(date, today)) {
    return t('chat.today');
  }
  if (isSameDay(date, yesterday)) {
    return t('chat.yesterday');
  }
  return date.toLocaleDateString();
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

function pinSupportAndSort(items: Conversation[]) {
  const byId = new Map<string, Conversation>();
  items.forEach((item) => byId.set(item.id, { ...(byId.get(item.id) ?? {}), ...item }));
  const deduped = Array.from(byId.values());
  const support = deduped.find((item) => item.isSupport);
  const rest = deduped
    .filter((item) => item.id !== support?.id)
    .sort(
      (a, b) =>
        (timestampValue(b.lastMessageTimestamp) ?? 0) -
        (timestampValue(a.lastMessageTimestamp) ?? 0),
    );

  return support ? [support, ...rest] : rest;
}

function mapConversation(item: ConversationDto, currentUserId: number, t: TranslateFn): Conversation {
  const other = getOtherParticipant(item, currentUserId);
  const isSupport = other.id === ADMIN_SUPPORT_USER_ID && other.type === 'ADMIN';
  const fallbackName = other.id
    ? t('chat.userFallback', { id: other.id })
    : t('chat.conversationFallback', { id: item.conversationId });

  return {
    id: String(item.conversationId),
    name: isSupport
      ? t('chat.customerSupport')
      : getParticipantTitle(other.type, other.id, item.otherParticipantName ?? fallbackName, t),
    message: formatConversationPreview(item.lastMessage, item.lastMessageType, t),
    timestamp: getConversationTimeLabel(item.lastMessageTimestamp, t),
    unreadCount: other.unreadCount,
    otherUserId: other.id ?? item.otherParticipantId,
    otherUserType: other.type ?? item.otherParticipantType,
    isSupport,
    lastMessageType: item.lastMessageType,
    lastMessageTimestamp: item.lastMessageTimestamp,
  };
}

async function enrichConversationWithLatestMessage(
  conversation: Conversation,
  token: string,
  t: TranslateFn,
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
      message: formatMessagePreview(latest, t),
      lastMessageSenderId: latest.senderId,
      lastMessageStatus: latest.status,
      lastMessageType: latest.messageType,
      lastMessageTimestamp: latest.createdAt ?? conversation.lastMessageTimestamp,
      timestamp: getConversationTimeLabel(latest.createdAt ?? conversation.lastMessageTimestamp, t),
    };
  } catch {
    return conversation;
  }
}

function formatConversationPreview(
  lastMessage: string | null | undefined,
  messageType: string | null | undefined,
  t: TranslateFn,
) {
  if (messageType === 'IMAGE') return t('chat.photo');
  if (messageType === 'VOICE') return t('chat.voiceMessage');
  if (messageType === 'LOCATION') return t('chat.sharedLocation');
  return lastMessage?.trim() || t('chat.noMessagesYet');
}

function formatMessagePreview(message: ChatMessageDto, t: TranslateFn) {
  if (message.deleted) return t('chat.messageDeleted');
  if (message.messageType === 'IMAGE') return t('chat.photo');
  if (message.messageType === 'VOICE') return t('chat.voiceMessage');
  if (message.messageType === 'LOCATION') return t('chat.sharedLocation');
  return message.content || t('chat.noMessagesYet');
}

function getParticipantTitle(
  type: ChatParticipantType | null | undefined,
  userId: number | null | undefined,
  name: string | null | undefined,
  t: TranslateFn,
) {
  const personName = name?.trim() || t('chat.userFallback', { id: userId ?? '' });
  if (type === 'ADMIN') {
    return t('chat.customerSupport');
  }
  if (type === 'PASSENGER') {
    return t('chat.participantPassenger', { name: personName });
  }
  if (type === 'DRIVER') {
    return t('chat.participantDriver', { name: personName });
  }
  if (type === 'CORPORATE_USER') {
    return t('chat.participantCorporate', { name: personName });
  }
  return personName;
}

function getParticipantAvatarFallback(
  type?: ChatParticipantType | null,
  isSupport?: boolean,
) {
  if (isSupport || type === 'ADMIN') {
    return 'A';
  }
  if (type === 'DRIVER') {
    return 'D';
  }
  if (type === 'CORPORATE_USER') {
    return 'C';
  }
  return 'P';
}

function ListReadTick({ status }: { status?: string | null }) {
  const isRead = status === 'READ';
  const isDelivered = status === 'DELIVERED' || isRead;

  return (
    <MaterialCommunityIcons
      name={isDelivered ? 'check-all' : 'check'}
      size={14}
      color={isRead ? '#60A5FA' : '#9AA4B2'}
      style={stylesStatic.listTick}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  headerRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 34,
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6ECF3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  itemSeparator: {
    height: 12,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6ECF3',
    padding: 12,
    gap: 10,
  },
  avatarWrap: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DDE5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#475569',
  },
  chatBody: {
    flex: 1,
    minWidth: 0,
  },
  chatTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
  },
  previewRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  chatSubtitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '600',
    color: '#8A94A6',
  },
  chatMeta: {
    minWidth: 42,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  chatTime: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1A73E8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoading: {
    paddingVertical: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6C8195',
    fontSize: 14,
  },
  errorText: {
    textAlign: 'center',
    color: '#D9534F',
    marginBottom: 12,
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: '#1A73E8',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

const stylesStatic = StyleSheet.create({
  listTick: {
    marginRight: 3,
  },
});
