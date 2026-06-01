import React, { useEffect, useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';

interface Conversation { // Conversation type definition for the conversation list items
  id: string;
  name: string;
  message: string;
  timestamp: string;
  participantType: string;
  unreadCount: number;
}

interface ConversationResponseItem { // Type definition for the conversation items received from the backend API. This type includes all the fields that we expect to receive from the API, with some fields marked as optional in case they are not provided by the backend. This allows us to handle cases where certain data might be missing without causing errors in our application.
  conversationId: number;
  otherParticipantId?: number;
  otherParticipantName?: string;
  otherParticipantType?: string;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTimestamp?: string;
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

  useEffect(() => {
    const fetchConversations = async () => {
      if (!user?.userId || !user?.token) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const endpoint = new URL(`http://10.233.234.185:8080/api/users/${user.userId}/conversations`); 
        endpoint.searchParams.set('page', '0'); // Always fetch the first page of conversations for simplicity. In a real app, you would implement pagination to load more conversations as the user scrolls.
        endpoint.searchParams.set('size', '20'); // Fetch up to 20 conversations at a time. This is a reasonable number to display in a chat list without overwhelming the user, while also allowing for some level of pagination if needed.
        if (searchQuery.trim()) { // If there is a search query, include it as a query parameter to filter conversations on the server side. This allows the backend to return only conversations that match the search criteria, improving performance and relevance of the results.
          endpoint.searchParams.set('q', searchQuery.trim()); //q means query
        }

        const response = await fetch(endpoint.toString(), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch conversations: ${response.statusText}`);
        }

        const result = await response.json();
        const items: ConversationResponseItem[] = Array.isArray(result.content) ? result.content : []; // Ensure that we have an array of conversations from the response. If the content is not an array, we default to an empty array to avoid errors when mapping over it.

        setConversations(
          items.map((item) => ({  // Map each conversation item to our Conversation type, providing default values for any missing fields.
            id: String(item.conversationId),
            name: item.otherParticipantName ?? `User #${item.otherParticipantId ?? item.conversationId}`,
            message: item.lastMessage ?? 'No messages yet',
            timestamp: formatTimestamp(item.lastMessageTimestamp),
            participantType: formatParticipantType(item.otherParticipantType),
            unreadCount: item.unreadCount ?? 0,
          }))
        ); // Map the response items to our Conversation type, providing default values for any missing fields. This ensures that our UI can display a consistent conversation list even if some data is not available from the backend.
      } catch (fetchError) {
        console.error('Error fetching driver conversations:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load conversations');
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchConversations, 250); // Delay the fetch by 250ms to avoid overloading the server with requests.
    return () => clearTimeout(debounceTimer); // Clear the debounce timer if the component unmounts or if the search query changes before the timer completes, preventing unnecessary API calls and ensuring that we only fetch conversations when the user has paused typing.
  }, [searchQuery, user?.token, user?.userId]); // Re-run the effect whenever the search query changes or when the user's authentication information changes, ensuring that we always have the most up-to-date conversations based on the current search criteria and user context.

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

  const renderConversation = ({ item }: { item: Conversation }) => ( // Render a single conversation item as a TouchableOpacity component. When pressed, it navigates to the chat screen for that conversation, passing the conversation ID and participant name as parameters. The conversation item displays an avatar with the participant's initials, the participant's name, the last message, the timestamp of the last message, and any unread message count. If there are unread messages, a badge is shown on the avatar indicating the number of unread messages.
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() =>
        router.push({
          pathname: '/chat/[id]',
          params: { id: item.id, name: item.name },
        })
      }
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.conversationTime} numberOfLines={1}>
            {item.timestamp}
          </Text>
        </View>

        <Text style={styles.conversationMessage} numberOfLines={1}>
          {item.message}
        </Text>

        {!!item.participantType && (
          <Text style={styles.participantTypeText} numberOfLines={1}>
            {item.participantType}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

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
    avatarText: {
      fontSize: isSmallPhone ? 14 : 16,
      fontWeight: '700',
      color: '#FFF',
    },
    unreadBadge: {
      position: 'absolute',
      top: -2,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#EF4444',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
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
    conversationTime: {
      fontSize: 11,
      color: '#0066FF',
      fontWeight: '500',
      flexShrink: 0,
    },
    conversationMessage: {
      fontSize: 12,
      color: theme.secondaryText,
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

export default DriverChatScreen;
