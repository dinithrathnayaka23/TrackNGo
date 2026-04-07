import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ConversationListItem } from "../components/ConversationListItem";
import { ADMIN_SUPPORT_USER_ID } from "../config/env";
import {
  createConversation,
  getUserConversations,
  searchUserConversations,
} from "../services/chatApi";
import { getUserProfile } from "../services/userProfileApi";
import { useSession } from "../store/sessionStore";
import type { ConversationDto, SessionUser, UserProfile } from "../types/chat";
import type { RootStackParamList } from "../navigation/types";
import { getOtherParticipant } from "../utils/chat";

type Props = NativeStackScreenProps<RootStackParamList, "ChatList">;

export function ChatListScreen({ navigation }: Props) {
  const { currentUser, clearCurrentUser } = useSession();
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

  if (!currentUser) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Messages</Text>
          <Text style={styles.userTag}>
            {currentUser.userType} #{currentUser.userId}
          </Text>
        </View>
        <Pressable onPress={clearCurrentUser}>
          <Text style={styles.switchText}>Switch User</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search messages..."
          style={styles.search}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#1f8fff" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.conversationId)}
          renderItem={({ item }) => (
            <ConversationListItem
              item={item}
              currentUser={currentUser}
              otherProfile={
                profilesById[getOtherParticipant(item, currentUser).userId]
              }
              onPress={onOpenConversation}
            />
          )}
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
              <Text style={styles.empty}>No conversations found.</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f4f8",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2a34",
  },
  userTag: {
    marginTop: 2,
    color: "#63788d",
    fontSize: 12,
  },
  switchText: {
    color: "#1f8fff",
    fontWeight: "700",
  },
  searchWrap: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  search: {
    backgroundColor: "#e7edf3",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#2e4254",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footerLoading: {
    paddingVertical: 10,
  },
  empty: {
    textAlign: "center",
    marginTop: 30,
    color: "#6c8195",
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
});
