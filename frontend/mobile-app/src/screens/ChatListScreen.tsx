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
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ADMIN_SUPPORT_USER_ID } from "../config/env";
import type { RootStackParamList } from "../navigation/types";
import {
  createConversation,
  getUserConversations,
  searchUserConversations,
} from "../services/chatApi";
import { getUserProfile } from "../services/userProfileApi";
import { useSession } from "../store/sessionStore";
import type { ConversationDto, SessionUser, UserProfile } from "../types/chat";
import {
  getParticipantAvatarFallback,
  getParticipantAvatarUri,
  formatConversationPreview,
  formatDayLabel,
  formatTime,
  getOtherParticipant,
  getParticipantTitle,
} from "../utils/chat";

type Props = NativeStackScreenProps<RootStackParamList, "ChatList">;

function getConversationTimeLabel(timestamp?: string | null) {
  const dayLabel = formatDayLabel(timestamp);
  if (dayLabel === "Today") {
    return formatTime(timestamp) || dayLabel;
  }
  return dayLabel || "";
}

export function ChatListScreen({ navigation }: Props) {
  const { currentUser, clearCurrentUser } = useSession();
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

  const trimmed = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    profilesRef.current = profilesById;
  }, [profilesById]);

  useEffect(() => {
    supportConversationRef.current = supportConversation;
  }, [supportConversation]);

  const needsPersistentSupportChat = useCallback((user: SessionUser) => {
    return (
      user.userType === "PASSENGER" ||
      user.userType === "DRIVER" ||
      user.userType === "CORPORATE_USER"
    );
  }, []);

  const getOtherParticipantFor = useCallback(
    (conversation: ConversationDto, user: SessionUser) => {
      return getOtherParticipant(conversation, user);
    },
    [],
  );

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

  const loadMissingProfiles = useCallback(
    async (conversations: ConversationDto[]) => {
      if (!currentUser || conversations.length === 0) {
        return;
      }

      const ids = conversations
        .map(
          (conversation) =>
            getOtherParticipant(conversation, currentUser).userId,
        )
        .filter((id, index, arr) => arr.indexOf(id) === index)
        .filter((id) => !profilesRef.current[id]);

      if (ids.length === 0) {
        return;
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

      setProfilesById((prev) => {
        const next = { ...prev };
        fetched.forEach((profile) => {
          if (profile) {
            next[profile.userId] = profile;
          }
        });
        return next;
      });
    },
    [currentUser],
  );

  const ensureSupportConversation = useCallback(async () => {
    if (!currentUser || !needsPersistentSupportChat(currentUser)) {
      setSupportConversation(null);
      return null;
    }

    try {
      const conversation = await createConversation({
        user1Id: currentUser.userId,
        user2Id: ADMIN_SUPPORT_USER_ID,
      });
      setSupportConversation(conversation);
      await loadMissingProfiles([conversation]);
      return conversation;
    } catch {
      setSupportConversation(null);
      return null;
    }
  }, [currentUser, loadMissingProfiles, needsPersistentSupportChat]);

  const loadPage = useCallback(
    async (targetPage: number, reset = false) => {
      if (!currentUser) {
        return;
      }

      if (targetPage === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        let support = supportConversationRef.current;
        const response =
          trimmed.length > 0
            ? await searchUserConversations({
                userId: currentUser.userId,
                q: trimmed,
                page: targetPage,
                size: 20,
              })
            : await getUserConversations({
                userId: currentUser.userId,
                page: targetPage,
                size: 20,
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

        await loadMissingProfiles(dedupedMerged);
        setPage(response.page);
        setLast(response.last);
        setError(null);
        setItems((prev) =>
          reset
            ? dedupedMerged
            : mergeWithSupportConversation(
                [...prev, ...response.content],
                support,
              ),
        );
      } catch (err) {
        if (reset) {
          setError(
            err instanceof Error ? err.message : "Failed to load conversations",
          );
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

  useEffect(() => {
    setItems([]);
    setPage(0);
    setLast(false);
    setProfilesById({});
    setSupportConversation(null);
    loadPage(0, true);
  }, [loadPage]);

  useFocusEffect(
    useCallback(() => {
      if (currentUser) {
        loadPage(0, true);
      }
    }, [currentUser, loadPage]),
  );

  const onOpenConversation = (conversation: ConversationDto) => {
    if (!currentUser) {
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.conversationId !== conversation.conversationId) {
          return item;
        }
        if (item.participant1Id === currentUser.userId) {
          return { ...item, participant1Unread: 0 };
        }
        return { ...item, participant2Unread: 0 };
      }),
    );

    const other = getOtherParticipant(conversation, currentUser);
    navigation.navigate("ChatRoom", {
      conversationId: conversation.conversationId,
      otherUserId: other.userId,
      otherUserType: other.userType,
    });
  };

  const onBack = useCallback(async () => {
    await clearCurrentUser();
    navigation.replace("Dashboard");
  }, [clearCurrentUser, navigation]);

  if (!currentUser) {
    return null;
  }

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={[styles.safeArea, { paddingTop: topInset }]}
    >
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
          placeholder="Search messages..."
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

            return (
              <Pressable
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
                  {unread > 0 ? <View style={styles.statusDot} /> : null}
                </View>

                <View style={styles.chatBody}>
                  <Text style={styles.chatTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={styles.chatSubtitle} numberOfLines={1}>
                    {formatConversationPreview(item)}
                  </Text>
                </View>

                <Text style={styles.chatTime}>
                  {getConversationTimeLabel(item.lastMessageTimestamp)}
                </Text>
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
  statusDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    bottom: 2,
    right: 2,
  },
  chatBody: {
    flex: 1,
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
  chatTime: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
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
