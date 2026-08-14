import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { sendAiAssistantMessage } from "../../services/aiAssistantApi";
import { useSession } from "../../store/sessionStore";

interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const quickPrompts = [
  "Find buses from Colombo Fort to Kandy tomorrow morning",
  "ETA for NB-0012",
  "Book one seat from Colombo Fort to Galle",
  "What should I do if my bus is late?",
];

type InlineSegment = {
  text: string;
  bold: boolean;
};

function parseInlineMarkdown(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  return segments.length > 0 ? segments : [{ text, bold: false }];
}

function InlineMarkdown({ text }: { text: string }) {
  return (
    <>
      {parseInlineMarkdown(text).map((segment, index) => (
        <Text key={`${segment.text}-${index}`} style={segment.bold && styles.markdownBold}>
          {segment.text}
        </Text>
      ))}
    </>
  );
}

function AssistantMarkdownMessage({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);

  return (
    <View style={styles.markdownWrap}>
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        const bullet = line.match(/^[-*]\s+(.+)$/);
        const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);

        if (!line) {
          return <View key={`space-${index}`} style={styles.markdownSpacer} />;
        }

        if (bullet || numbered) {
          return (
            <View key={`${line}-${index}`} style={styles.markdownRow}>
              <Text style={styles.markdownMarker}>
                {bullet ? "•" : `${numbered?.[1]}.`}
              </Text>
              <Text style={[styles.messageText, styles.assistantText, styles.markdownLine]}>
                <InlineMarkdown text={bullet?.[1] ?? numbered?.[2] ?? line} />
              </Text>
            </View>
          );
        }

        return (
          <Text
            key={`${line}-${index}`}
            style={[styles.messageText, styles.assistantText, styles.markdownParagraph]}
          >
            <InlineMarkdown text={line} />
          </Text>
        );
      })}
    </View>
  );
}

export default function AssistantScreen() {
  const { currentUser } = useSession();
  const insets = useSafeAreaInsets();
  const chatId = useRef(`mobile-${Date.now()}`);
  const listRef = useRef<FlatList<AssistantMessage>>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ayubowan. I can search Sri Lankan buses, check live ETA, help with bookings, reminders, refunds, and complaints. I use TrackNGo live route and booking data where available.",
    },
  ]);

  const canSend = input.trim().length > 0 && !loading;
  const bottomInset = keyboardVisible ? 0 : insets.bottom;
  const keyboardLift =
    Platform.OS === "android" && keyboardVisible
      ? Math.max(0, keyboardHeight - insets.bottom)
      : 0;

  const helperText = useMemo(() => {
    if (!currentUser) {
      return "Sign in for personalized bookings and recommendations.";
    }
    return "Personalized with your TrackNGo passenger context.";
  }, [currentUser]);

  React.useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates.height);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) {
      return;
    }

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await sendAiAssistantMessage(
        trimmed,
        chatId.current,
        currentUser?.userId,
      );
      chatId.current = response.chatId || chatId.current;
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.reply,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content:
            error instanceof Error
              ? `I could not reach TrackNGo AI: ${error.message}`
              : "I could not reach TrackNGo AI. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={Platform.OS === "ios"}
        keyboardVerticalOffset={0}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <View style={styles.logo}>
            <MaterialCommunityIcons name="robot-outline" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>TrackNGo AI</Text>
            <Text style={styles.subtitle}>{helperText}</Text>
          </View>
        </View>

        <View style={styles.quickWrap}>
          {quickPrompts.map((prompt) => (
            <Pressable
              key={prompt}
              disabled={loading}
              onPress={() => sendMessage(prompt)}
              style={styles.quickChip}
            >
              <Text style={styles.quickText}>{prompt}</Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messages,
            { paddingBottom: 12 + bottomInset },
          ]}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === "user" ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              {item.role === "assistant" ? (
                <Ionicons name="sparkles-outline" size={15} color="#2F6BFF" />
              ) : null}
              {item.role === "assistant" ? (
                <AssistantMarkdownMessage content={item.content} />
              ) : (
                <Text style={[styles.messageText, styles.userText]}>
                  {item.content}
                </Text>
              )}
            </View>
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <View
          style={[
            styles.composer,
            { paddingBottom: 14 + bottomInset + keyboardLift },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about buses, seats, ETA, refunds..."
            placeholderTextColor="#8A94A6"
            multiline
            style={styles.input}
            editable={!loading}
            onFocus={() =>
              requestAnimationFrame(() =>
                listRef.current?.scrollToEnd({ animated: true }),
              )
            }
          />
          <Pressable
            disabled={!canSend}
            onPress={() => sendMessage(input)}
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },
  keyboard: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DDE3EA",
    backgroundColor: "#FFFFFF",
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2F6BFF",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#18212F",
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#667085",
  },
  quickWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  quickChip: {
    maxWidth: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  quickText: {
    fontSize: 12,
    color: "#263445",
    fontWeight: "600",
  },
  messages: {
    gap: 10,
    padding: 20,
    paddingBottom: 12,
  },
  bubble: {
    maxWidth: "88%",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2F6BFF",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  messageText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  assistantText: {
    color: "#18212F",
  },
  markdownWrap: {
    flexShrink: 1,
    flex: 1,
  },
  markdownParagraph: {
    marginBottom: 4,
  },
  markdownRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  markdownMarker: {
    width: 18,
    paddingTop: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#18212F",
    fontWeight: "700",
  },
  markdownLine: {
    flex: 1,
  },
  markdownBold: {
    fontWeight: "800",
  },
  markdownSpacer: {
    height: 6,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#DDE3EA",
    backgroundColor: "#FFFFFF",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 108,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#18212F",
    backgroundColor: "#F8FAFC",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2F6BFF",
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
