import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import colors from '@/constants/colors';
import { useApp, generateId } from '@/lib/app-context';
import { streamFromApi } from '@/lib/streaming';

const C = colors.dark;

function MessageBubble({ item }: { item: { id: string; role: string; content: string } }) {
  const isUser = item.role === 'user';
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.aiBubble,
      ]}
    >
      {!isUser && (
        <View style={styles.aiLabel}>
          <Ionicons name="sparkles" size={12} color={C.green} />
          <Text style={styles.aiLabelText}>NexusAI</Text>
        </View>
      )}
      <Text style={[styles.messageText, isUser && styles.userText]} selectable>
        {item.content}
      </Text>
    </Animated.View>
  );
}

function TypingIndicator() {
  return (
    <View style={[styles.bubble, styles.aiBubble, styles.typingBubble]}>
      <View style={styles.aiLabel}>
        <Ionicons name="sparkles" size={12} color={C.green} />
        <Text style={styles.aiLabelText}>NexusAI</Text>
      </View>
      <View style={styles.dots}>
        <ActivityIndicator size="small" color={C.accent} />
        <Text style={styles.typingText}>Generating...</Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { chatMessages, setChatMessages, addChatMessage, updateLastMessage, clearChat, apiKey } = useApp();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');

    const currentMessages = [...chatMessages];
    const userMsg = {
      id: generateId(),
      role: 'user' as const,
      content: text,
      timestamp: Date.now(),
    };

    addChatMessage(userMsg);
    setIsStreaming(true);
    setShowTyping(true);

    let fullContent = '';
    let assistantAdded = false;

    try {
      const chatHistory = [
        ...currentMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ];

      await streamFromApi(
        'api/chat',
        { messages: chatHistory, apiKey: apiKey || undefined },
        (chunk) => {
          fullContent += chunk;
          if (!assistantAdded) {
            setShowTyping(false);
            const aiMsg = {
              id: generateId(),
              role: 'assistant' as const,
              content: fullContent,
              timestamp: Date.now(),
            };
            addChatMessage(aiMsg);
            assistantAdded = true;
          } else {
            updateLastMessage(fullContent);
          }
        },
      );
    } catch (error: any) {
      setShowTyping(false);
      if (!assistantAdded) {
        addChatMessage({
          id: generateId(),
          role: 'assistant',
          content: `Error: ${error.message}`,
          timestamp: Date.now(),
        });
      }
    } finally {
      setIsStreaming(false);
      setShowTyping(false);
    }
  }, [input, isStreaming, chatMessages, apiKey, addChatMessage, updateLastMessage]);

  const reversedMessages = [...chatMessages].reverse();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat</Text>
        {chatMessages.length > 0 && (
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); clearChat(); }}>
            <Ionicons name="trash-outline" size={20} color={C.textSecondary} />
          </Pressable>
        )}
      </View>

      {chatMessages.length === 0 && !showTyping ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={48} color={C.textMuted} />
          <Text style={styles.emptyTitle}>NexusAI Assistant</Text>
          <Text style={styles.emptyText}>Ask about code, get help building modules, or explore ideas</Text>
        </View>
      ) : (
        <FlatList
          data={reversedMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble item={item} />}
          inverted={!!chatMessages.length}
          scrollEnabled={!!chatMessages.length}
          ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message NexusAI..."
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={4000}
            blurOnSubmit={false}
            returnKeyType="default"
            testID="chat-input"
          />
          <Pressable
            onPress={() => { handleSend(); inputRef.current?.focus(); }}
            disabled={!input.trim() || isStreaming}
            style={[styles.sendButton, (!input.trim() || isStreaming) && styles.sendDisabled]}
            testID="send-button"
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={!input.trim() || isStreaming ? C.textMuted : '#fff'}
            />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: C.text },
  emptyText: { fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
  messageList: { paddingHorizontal: 16, paddingVertical: 8 },
  bubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 18,
    marginVertical: 4,
  },
  userBubble: {
    backgroundColor: C.userBubble,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: C.aiBubble,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  aiLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  aiLabelText: { fontSize: 11, fontWeight: '600', color: C.green },
  messageText: { fontSize: 15, color: C.text, lineHeight: 22 },
  userText: { color: '#fff' },
  typingBubble: { paddingVertical: 12 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { fontSize: 13, color: C.textSecondary },
  inputBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    backgroundColor: C.background,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: C.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    maxHeight: 120,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendDisabled: { backgroundColor: C.borderLight },
});
