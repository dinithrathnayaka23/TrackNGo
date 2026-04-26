import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "expo-router";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ADMIN_SUPPORT_USER_ID } from "../../config/env";
import type { RootStackParamList } from "../../navigation/types";
import {
  createConversation,
  getPresenceSnapshot,
  getUserConversations,
} from "../../services/chatApi";
import { chatSocket } from "../../services/chatSocket";
import { getUserProfile } from "../../services/userProfileApi";
import { useSession } from "../../store/sessionStore";
import type {
  ChatMessage,
  ConversationDto,
  PresenceUpdate,
  SessionUser,
  TypingIndicator,
  UserProfile,
} from "../../types/chat";
import {
  getParticipantAvatarFallback,
  getParticipantAvatarUri,
  formatConversationPreview,
  formatDayLabel,
  formatTime,
  getOtherParticipant,
  getParticipantTitle,
} from "../../utils/chat";

type Props = NativeStackScreenProps<RootStackParamList, "ChatList">;

// Formats the right-side timestamp shown for each conversation row.
export function getConversationTimeLabel(timestamp?: string | null) {
  const dayLabel = formatDayLabel(timestamp);
  if (dayLabel === "Today") {
    return formatTime(timestamp) || dayLabel;
  }
  return dayLabel || "";
}

// Normalizes websocket presence payload values into numeric user ids.
export function toPresenceUserId(value: number | string) {
  return Number(value);
}

// Converts an ISO timestamp into a numeric sort value when possible.
export function timestampValue(timestamp?: string | null) {
  if (!timestamp) {
    return null;
  }
  const value = new Date(timestamp).getTime();
  return Number.isNaN(value) ? null : value;
}

// Builds the latest-message preview text shown in the chat list.
export function messagePreview(message: ChatMessage) {
  if (message.deleted) {
    return "Message deleted";
  }
  if (message.messageType === "IMAGE") {
    return "Photo";
  }
  if (message.messageType === "VOICE") {
    return "Voice message";
  }
  if (message.messageType === "LOCATION") {
    return "Shared location";
  }
  return message.content || "No messages yet";
}

// Sorts conversations so the most recently active thread appears first.
export function compareByRecentActivity(a: ConversationDto, b: ConversationDto) {
  const aTime = timestampValue(a.lastMessageTimestamp) ?? 0;
  const bTime = timestampValue(b.lastMessageTimestamp) ?? 0;
  return bTime - aTime;
}

// Lowercases and trims values before chat-list search matching.
export function normalizeSearchValue(value?: string | number | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

// Identifies the pinned customer-support conversation for the current user.
export function isSupportConversation(
  conversation: ConversationDto,
  currentUser: SessionUser,
) {
  const other = getOtherParticipant(conversation, currentUser);
  return other.userType === "ADMIN" && other.userId === ADMIN_SUPPORT_USER_ID;
}

// Checks whether a conversation matches the current chat-list search query.
export function matchesConversationSearch(
  conversation: ConversationDto,
  currentUser: SessionUser,
  profilesById: Record<number, UserProfile>,
  query: string,
) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return true;
  }

  const other = getOtherParticipant(conversation, currentUser);
  const profile = profilesById[other.userId];
  const searchableValues = [
    getParticipantTitle(other.userType, other.userId, profile),
    formatConversationPreview(conversation),
    profile?.fullName,
    profile?.companyName,
    profile?.contactPersonName,
    profile?.email,
    other.userType,
    other.userId,
  ];

  return searchableValues.some((value) =>
    normalizeSearchValue(value).includes(normalizedQuery),
  );
}

// Applies an incoming message to a conversation preview and unread counters.
export function mergeMessageIntoConversation(
  conversation: ConversationDto,
  message: ChatMessage,
  currentUser: SessionUser,
) {
  const messageTime = timestampValue(message.createdAt);
  const currentTime = timestampValue(conversation.lastMessageTimestamp);
  const shouldReplacePreview =
    currentTime === null || messageTime === null || messageTime >= currentTime;

  if (!shouldReplacePreview) {
    return conversation;
  }

  const isNewIncoming =
    message.senderId !== currentUser.userId &&
    (currentTime === null || (messageTime !== null && messageTime > currentTime));
  const next: ConversationDto = {
    ...conversation,
    lastMessage: messagePreview(message),
    lastMessageType: message.messageType ?? "TEXT",
    lastMessageTimestamp: message.createdAt ?? new Date().toISOString(),
  };

  if (isNewIncoming) {
    if (conversation.participant1Id === currentUser.userId) {
      next.participant1Unread = conversation.participant1Unread + 1;
    } else if (conversation.participant2Id === currentUser.userId) {
      next.participant2Unread = conversation.participant2Unread + 1;
    }
  }

  return next;
}

export function ChatListScreen({ navigation }: Props) {
  const { currentUser } = useSession();
  const { top: topInset } = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ConversationDto[]>([]);
  const [page, setPage] = useState(0);
  const [last, setLast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profilesById, setProfilesById] = useState<Record<number, UserProfile>>(
    {},
  );
  const profilesRef = useRef<Record<number, UserProfile>>({});
  const [supportConversation, setSupportConversation] =
    useState<ConversationDto | null>(null);
  const supportConversationRef = useRef<ConversationDto | null>(null);
  const supportConversationPromiseRef = useRef<Promise<ConversationDto | null> | null>(
    null,
  );
  const [onlineByUserId, setOnlineByUserId] = useState<Record<number, boolean>>(
    {},
  );
  const [typingByConversationId, setTypingByConversationId] = useState<
    Record<number, boolean>
  >({});
  const [screenFocused, setScreenFocused] = useState(false);
  const typingClearTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {},
  );

  const trimmed = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    profilesRef.current = profilesById;
  }, [profilesById]);

  useEffect(() => {
    supportConversationRef.current = supportConversation;
  }, [supportConversation]);

  useEffect(
    () => () => {
      Object.values(typingClearTimersRef.current).forEach((timer) =>
        clearTimeout(timer),
      );
    },
    [],
  );

  // Determines whether the signed-in user should always keep a support thread pinned.
  const needsPersistentSupportChat = useCallback((user: SessionUser) => {
    return user.userId !== ADMIN_SUPPORT_USER_ID;
  }, []);

  // Resolves the non-current participant for a conversation row.
  const getOtherParticipantFor = useCallback(
    (conversation: ConversationDto, user: SessionUser) => {
      return getOtherParticipant(conversation, user);
    },
    [],
  );

  // Removes duplicate rows and keeps only one shared support conversation in the list.
  const dedupeConversations = useCallback(
    (conversations: ConversationDto[]) => {
      if (!currentUser) {
        return conversations;
      }

      const seenConversationIds = new Set<number>();
      let supportAlreadyIncluded = false;

      return conversations.filter((conversation) => {
        if (seenConversationIds.has(conversation.conversationId)) {
          return false;
        }
        seenConversationIds.add(conversation.conversationId);

        const other = getOtherParticipantFor(conversation, currentUser);
        const isAdminSupport =
          other.userType === "ADMIN" && other.userId === ADMIN_SUPPORT_USER_ID;

        if (other.userType === "ADMIN" && !isAdminSupport) {
          return false;
        }

        if (!isAdminSupport) {
          return true;
        }
        if (supportAlreadyIncluded) {
          return false;
        }
        supportAlreadyIncluded = true;
        return true;
      });
    },
    [currentUser, getOtherParticipantFor],
  );

  // Pins the support conversation at the top while removing duplicates from the loaded page.
  const mergeWithSupportConversation = useCallback(
    (conversations: ConversationDto[], support?: ConversationDto | null) => {
      const pinned = support ?? supportConversationRef.current;
      if (!pinned) {
        return dedupeConversations(conversations);
      }

      const withoutDuplicate = conversations.filter(
        (item) => item.conversationId !== pinned.conversationId,
      );
      return dedupeConversations([pinned, ...withoutDuplicate]);
    },
    [dedupeConversations],
  );

  // Sorts conversations by recency while preserving the pinned support thread.
  const pinAndSortConversations = useCallback(
    (conversations: ConversationDto[]) => {
      const deduped = dedupeConversations(conversations);
      const pinnedId = supportConversationRef.current?.conversationId;
      const pinned = pinnedId
        ? deduped.find((item) => item.conversationId === pinnedId)
        : null;
      const rest = deduped
        .filter((item) => item.conversationId !== pinned?.conversationId)
        .sort(compareByRecentActivity);

      return pinned ? [pinned, ...rest] : rest;
    },
    [dedupeConversations],
  );

  // Applies the latest presence snapshot or websocket presence delta to the chat list.
  const applyPresenceUpdate = useCallback((presence: PresenceUpdate) => {
    if (Array.isArray(presence.onlineUserIds)) {
      setOnlineByUserId(
        presence.onlineUserIds.reduce<Record<number, boolean>>(
          (next, userId) => {
            const normalizedUserId = toPresenceUserId(userId);
            if (Number.isFinite(normalizedUserId)) {
              next[normalizedUserId] = true;
            }
            return next;
          },
          {},
        ),
      );
      return;
    }

    setOnlineByUserId((current) => {
      const normalizedUserId = toPresenceUserId(presence.userId);
      if (!Number.isFinite(normalizedUserId)) {
        return current;
      }
      if (presence.online) {
        return current[normalizedUserId]
          ? current
          : { ...current, [normalizedUserId]: true };
      }

      if (!current[normalizedUserId]) {
        return current;
      }
      const next = { ...current };
      delete next[normalizedUserId];
      return next;
    });
  }, []);

  // Tracks transient typing state for the visible conversation list rows.
  const setConversationTyping = useCallback(
    (conversationId: number, typing: boolean) => {
      const existingTimer = typingClearTimersRef.current[conversationId];
      if (existingTimer) {
        clearTimeout(existingTimer);
        delete typingClearTimersRef.current[conversationId];
      }

      setTypingByConversationId((current) => {
        if (typing) {
          return current[conversationId]
            ? current
            : { ...current, [conversationId]: true };
        }
        if (!current[conversationId]) {
          return current;
        }
        const next = { ...current };
        delete next[conversationId];
        return next;
      });

      if (typing) {
        typingClearTimersRef.current[conversationId] = setTimeout(() => {
          setTypingByConversationId((current) => {
            if (!current[conversationId]) {
              return current;
            }
            const next = { ...current };
            delete next[conversationId];
            return next;
          });
          delete typingClearTimersRef.current[conversationId];
        }, 3500);
      }
    },
    [],
  );

  // Handles incoming typing events from the websocket connection.
  const handleTyping = useCallback(
    (typing: TypingIndicator) => {
      if (!currentUser || typing.userId === currentUser.userId) {
        return;
      }
      setConversationTyping(typing.conversationId, typing.typing);
    },
    [currentUser, setConversationTyping],
  );

  // Loads any participant profiles that are still missing from the local profile cache.
  const loadMissingProfiles = useCallback(
    async (conversations: ConversationDto[]) => {
      if (!currentUser || conversations.length === 0) {
        return profilesRef.current;
      }

      const ids = conversations
        .map(
          (conversation) =>
            getOtherParticipant(conversation, currentUser).userId,
        )
        .filter((id, index, arr) => arr.indexOf(id) === index)
        .filter((id) => !profilesRef.current[id]);

      if (ids.length === 0) {
        return profilesRef.current;
      }

      const fetched = await Promise.all(
        ids.map(async (id) => {
          try {
            return await getUserProfile(id);
          } catch {
            return null;
          }
        }),
      );

      const nextProfiles = { ...profilesRef.current };
      fetched.forEach((profile) => {
        if (profile) {
          nextProfiles[profile.userId] = profile;
        }
      });
      profilesRef.current = nextProfiles;
      setProfilesById(nextProfiles);
      return nextProfiles;
    },
    [currentUser],
  );

  // Ensures a dedicated support conversation exists for non-admin users.
  const ensureSupportConversation = useCallback(async () => {
    if (!currentUser || !needsPersistentSupportChat(currentUser)) {
      setSupportConversation(null);
      return null;
    }

    if (supportConversationRef.current) {
      return supportConversationRef.current;
    }

    if (supportConversationPromiseRef.current) {
      return supportConversationPromiseRef.current;
    }

    supportConversationPromiseRef.current = (async () => {
      try {
        const conversation = await createConversation({
          user1Id: currentUser.userId,
          user2Id: ADMIN_SUPPORT_USER_ID,
        });
        supportConversationRef.current = conversation;
        setSupportConversation(conversation);
        await loadMissingProfiles([conversation]);
        return conversation;
      } catch {
        setSupportConversation(null);
        return null;
      } finally {
        supportConversationPromiseRef.current = null;
      }
    })();

    return supportConversationPromiseRef.current;
  }, [currentUser, loadMissingProfiles, needsPersistentSupportChat]);

  // Loads one page of conversations and optionally resets the visible list state.
  const loadPage = useCallback(
    async (targetPage: number, reset = false) => {
      console.log(
        `[ChatListScreen] loadPage called: page=${targetPage}, reset=${reset}, currentUser=${currentUser?.userId}`,
      );
      if (!currentUser) {
        console.log("[ChatListScreen] No current user, skipping");
        return;
      }

      if (targetPage === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const searching = trimmed.length > 0;
        let support = supportConversationRef.current;
        const response = await getUserConversations({
          userId: currentUser.userId,
          page: searching ? 0 : targetPage,
          size: searching ? 100 : 20,
        });

        if (reset && currentUser && needsPersistentSupportChat(currentUser)) {
          const existingSupport = response.content.find((conversation) => {
            const other = getOtherParticipantFor(conversation, currentUser);
            return (
              other.userType === "ADMIN" &&
              other.userId === ADMIN_SUPPORT_USER_ID
            );
          });

          if (existingSupport) {
            support = existingSupport;
            supportConversationRef.current = existingSupport;
            setSupportConversation(existingSupport);
          } else {
            support = await ensureSupportConversation();
          }
        }

        const merged = support
          ? [
              support,
              ...response.content.filter(
                (item) => item.conversationId !== support.conversationId,
              ),
            ]
          : response.content;

        const dedupedMerged = dedupeConversations(merged);
        const profilesSnapshot = await loadMissingProfiles(dedupedMerged);
        const visibleMerged = searching
          ? dedupedMerged.filter(
              (conversation) =>
                isSupportConversation(conversation, currentUser) ||
                matchesConversationSearch(
                  conversation,
                  currentUser,
                  profilesSnapshot,
                  trimmed,
                ),
            )
          : dedupedMerged;

        setPage(searching ? 0 : response.page);
        setLast(searching ? true : response.last);
        setError(null);
        setItems((prev) =>
          reset
            ? visibleMerged
            : mergeWithSupportConversation(
                [...prev, ...response.content],
                support,
              ),
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load conversations";
        console.error("[ChatListScreen] Error loading conversations:", err);
        if (reset) {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      currentUser,
      dedupeConversations,
      ensureSupportConversation,
      getOtherParticipantFor,
      loadMissingProfiles,
      mergeWithSupportConversation,
      needsPersistentSupportChat,
      trimmed,
    ],
  );

  // Merges websocket messages into the conversation list preview and unread state.
  const updateConversationFromSocket = useCallback(
    (message: ChatMessage) => {
      if (!currentUser || !message.conversationId) {
        return;
      }

      if (message.senderId !== currentUser.userId) {
        setConversationTyping(message.conversationId, false);
      }

      let updatedConversation: ConversationDto | null = null;
      let missingConversation = false;
      setItems((current) => {
        const next = current.map((conversation) => {
          if (conversation.conversationId !== message.conversationId) {
            return conversation;
          }

          const updated = mergeMessageIntoConversation(
            conversation,
            message,
            currentUser,
          );
          updatedConversation = updated;
          return updated;
        });

        if (!updatedConversation) {
          missingConversation = true;
          return current;
        }

        return pinAndSortConversations(next);
      });

      if (missingConversation && !trimmed) {
        void loadPage(0, true);
      }

      const resolvedUpdatedConversation =
        updatedConversation as ConversationDto | null;
      if (
        resolvedUpdatedConversation &&
        supportConversationRef.current?.conversationId ===
          resolvedUpdatedConversation.conversationId
      ) {
        setSupportConversation(resolvedUpdatedConversation);
      }

      if (resolvedUpdatedConversation) {
        void loadMissingProfiles([resolvedUpdatedConversation]);
      }
    },
    [
      currentUser,
      loadMissingProfiles,
      loadPage,
      pinAndSortConversations,
      setConversationTyping,
      trimmed,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      if (currentUser) {
        setItems([]);
        setPage(0);
        setLast(false);
        setProfilesById({});
        supportConversationRef.current = null;
        supportConversationPromiseRef.current = null;
        setSupportConversation(null);
        loadPage(0, true);
      }
      return () => {
        setScreenFocused(false);
      };
    }, [currentUser, loadPage]),
  );

  const conversationIdsKey = useMemo(
    () =>
      items
        .map((item) => item.conversationId)
        .sort((a, b) => a - b)
        .join(","),
    [items],
  );

  useEffect(() => {
    if (!screenFocused || !currentUser) {
      return undefined;
    }

    chatSocket.connect(currentUser.userId);
    const conversationIds = conversationIdsKey
      .split(",")
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);

    const unsubscribePresence = chatSocket.subscribePresence(
      applyPresenceUpdate,
    );
    void getPresenceSnapshot()
      .then(applyPresenceUpdate)
      .catch(() => undefined);
    const unsubscribers = conversationIds.map((conversationId) =>
      chatSocket.subscribeConversation(conversationId, {
        onMessage: updateConversationFromSocket,
        onTyping: handleTyping,
        onStatus: () => undefined,
        onDeleted: () => {
          void loadPage(0, true);
        },
      }),
    );

    return () => {
      unsubscribePresence();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      chatSocket.disconnect();
    };
  }, [
    applyPresenceUpdate,
    conversationIdsKey,
    currentUser,
    handleTyping,
    loadPage,
    screenFocused,
    updateConversationFromSocket,
  ]);

  const onOpenConversation = (conversation: ConversationDto) => {
    if (!currentUser) {
      return;
    }

    let openedConversation: ConversationDto | null = null;
    setItems((prev) =>
      prev.map((item) => {
        if (item.conversationId !== conversation.conversationId) {
          return item;
        }
        if (item.participant1Id === currentUser.userId) {
          openedConversation = { ...item, participant1Unread: 0 };
          return openedConversation;
        }
        openedConversation = { ...item, participant2Unread: 0 };
        return openedConversation;
      }),
    );
    const resolvedOpenedConversation =
      openedConversation as ConversationDto | null;
    if (
      resolvedOpenedConversation &&
      supportConversationRef.current?.conversationId ===
        resolvedOpenedConversation.conversationId
    ) {
      setSupportConversation(resolvedOpenedConversation);
    }

    const other = getOtherParticipant(conversation, currentUser);
    navigation.navigate("ChatRoom", {
      conversationId: conversation.conversationId,
      otherUserId: other.userId,
      otherUserType: other.userType,
    });
  };

  // Returns the user to the dashboard from the mobile chat list.
  const onBack = useCallback(() => {
    navigation.replace("Dashboard");
  }, [navigation]);

  if (!currentUser) {
    return null;
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or message..."
          placeholderTextColor="#A6B0C3"
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#1A73E8" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.conversationId)}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          renderItem={({ item }) => {
            const other = getOtherParticipant(item, currentUser);
            const otherProfile = profilesById[other.userId];
            const unread =
              item.participant1Id === currentUser.userId
                ? item.participant1Unread
                : item.participant2Unread;
            const title = getParticipantTitle(
              other.userType,
              other.userId,
              otherProfile,
            );
            const avatarUri = getParticipantAvatarUri(otherProfile);
            const avatarFallback = getParticipantAvatarFallback(
              other.userType,
              otherProfile,
            );
            const isOnline = onlineByUserId[other.userId];
            const isTyping = typingByConversationId[item.conversationId] === true;

            return (
              <Pressable
                testID={`conversation-${item.conversationId}`}
                style={styles.chatItem}
                onPress={() => onOpenConversation(item)}
              >
                <View style={styles.avatarWrap}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>
                        {avatarFallback}
                      </Text>
                    </View>
                  )}
                  {isOnline ? <View style={styles.onlineDot} /> : null}
                </View>

                <View style={styles.chatBody}>
                  <Text style={styles.chatTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text
                    style={[
                      styles.chatSubtitle,
                      isTyping ? styles.chatTypingSubtitle : null,
                    ]}
                    numberOfLines={1}
                  >
                    {isTyping ? "typing..." : formatConversationPreview(item)}
                  </Text>
                </View>

                <View style={styles.chatMeta}>
                  <Text style={styles.chatTime}>
                    {getConversationTimeLabel(item.lastMessageTimestamp)}
                  </Text>
                  {unread > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {unread > 99 ? "99+" : unread}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          onEndReached={() => {
            if (!loadingMore && !last) {
              loadPage(page + 1, false);
            }
          }}
          onEndReachedThreshold={0.3}
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
                <Text style={styles.emptyText}>No conversations found.</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  headerRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
  },
  headerSpacer: {
    width: 34,
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6ECF3",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#1F2937",
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6ECF3",
    padding: 12,
    gap: 10,
  },
  avatarWrap: {
    position: "relative",
    width: 44,
    height: 44,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DDE5F0",
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DDE5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#475569",
  },
  onlineDot: {
    position: "absolute",
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    bottom: 1,
    right: 1,
  },
  chatBody: {
    flex: 1,
    minWidth: 0,
  },
  chatTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1F2937",
  },
  chatSubtitle: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: "#8A94A6",
  },
  chatTypingSubtitle: {
    fontWeight: "800",
    color: "#1A73E8",
  },
  chatMeta: {
    minWidth: 42,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
  },
  chatTime: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#1A73E8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footerLoading: {
    paddingVertical: 12,
  },
  emptyText: {
    textAlign: "center",
    color: "#6C8195",
    fontSize: 14,
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
});
