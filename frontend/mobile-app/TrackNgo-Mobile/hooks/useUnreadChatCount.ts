import { useCallback, useEffect, useRef, useState } from "react";
import { getUserConversations } from "../services/chatApi";
import { useSession } from "../store/sessionStore";
import { getConversationUnread } from "../utils/chat";

/**
 * Total unread chat messages for the signed-in user, refreshed on a timer.
 *
 * The backend has no dedicated unread-count endpoint and the chat socket only
 * publishes per-conversation topics, so there is nothing to subscribe to for
 * "a message arrived in any of my threads". Polling the conversation list is
 * how the driver app already solves this; the passenger tab bar and the
 * corporate tab bar both read from here so the two stay in step.
 */
const POLL_INTERVAL_MS = 5000;

// One page is enough to drive a badge: a user with more than this many
// conversations still sees the badge, only the total would be undercounted.
const CONVERSATION_PAGE_SIZE = 50;

export function useUnreadChatCount() {
  const { currentUser } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const userId = currentUser?.userId ?? null;
  // Kept in a ref so the polling effect does not restart on every tick.
  const activeRef = useRef(true);

  const refresh = useCallback(async () => {
    if (userId === null) {
      setUnreadCount(0);
      return;
    }

    try {
      const result = await getUserConversations({
        userId,
        page: 0,
        size: CONVERSATION_PAGE_SIZE,
      });
      const conversations = Array.isArray(result?.content) ? result.content : [];
      const total = conversations.reduce(
        (sum, conversation) => sum + getConversationUnread(conversation, userId),
        0,
      );
      if (activeRef.current) {
        setUnreadCount(total);
      }
    } catch {
      // A dropped poll says nothing about the inbox, so the previous count
      // stays put rather than blinking the badge off on a flaky connection.
    }
  }, [userId]);

  useEffect(() => {
    activeRef.current = true;
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      activeRef.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  return unreadCount;
}

// Tab badges everywhere in the product cap at the same point.
export function formatUnreadBadge(count: number) {
  if (count <= 0) return undefined;
  return count > 99 ? "99+" : String(count);
}
