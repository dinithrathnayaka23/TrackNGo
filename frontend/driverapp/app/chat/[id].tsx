import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0066FF" />
        </TouchableOpacity>

        <Text style={styles.title}>Chat {id}</Text>

        <View style={{ width: 24 }} />
      </View>

      {/* Chat area */}
      <View style={styles.chatBox}>
        <Text style={styles.text}>This is chat room ID: {id}</Text>
        <Text style={styles.subText}>
          (Replace this with your real messages UI later)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    height: 60,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  chatBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  subText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
  },
});