import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  message: string;
  timestamp: string;
  isOnline?: boolean;
}

const DriverChatScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState('');

  const conversations: Conversation[] = [
    {
      id: '1',
      name: 'Customer Support',
      avatar: '👩‍💼',
      message: 'How can we help you today with your inquiry?',
      timestamp: 'Yesterday',
      isOnline: false,
    },
    {
      id: '2',
      name: 'Driver - Kamal',
      avatar: '👨‍✈️',
      message: 'Ok sir.',
      timestamp: 'Sun',
      isOnline: false,
    },
    {
      id: '3',
      name: 'Driver - Suresh',
      avatar: '👨‍✈️',
      message: 'I will arrive in 5 mins at the pickup point.',
      timestamp: '9:15 AM',
      isOnline: true,
    },
  ];

  const isSmallPhone = width < 360;
  const horizontalPadding = isSmallPhone ? 14 : 16;

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return conversations;

    return conversations.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        item.message.toLowerCase().includes(query) ||
        item.timestamp.toLowerCase().includes(query)
      );
    });
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
    [horizontalPadding, insets.bottom, isSmallPhone,theme]
  );

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => router.push({
  pathname: '/chat/[id]',
  params: { id: item.id },
    })}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.avatar}</Text>
        </View>
        {item.isOnline && <View style={styles.onlineIndicator} />}
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

        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </SafeAreaView>
  );
};

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
      fontSize: isSmallPhone ? 18 : 20,
    },
    onlineIndicator: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: '#22c55e',
      borderWidth: 2,
      borderColor: '#fff',
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
      color: '#666',
    },
  });
}

export default DriverChatScreen;
