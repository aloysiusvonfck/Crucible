import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import colors from '@/constants/colors';
import { useApp } from '@/lib/app-context';

const C = colors.dark;

export default function KeysScreen() {
  const insets = useSafeAreaInsets();
  const { apiKey, setApiKey, hasApiKey } = useApp();
  const [inputKey, setInputKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const key = inputKey.trim();
    if (!key) {
      Alert.alert('Invalid Key', 'Please enter a valid API key');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setApiKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    Alert.alert(
      'Clear API Key',
      'Are you sure you want to remove your saved API key?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await setApiKey('');
            setInputKey('');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ],
    );
  };

  const maskedKey = inputKey
    ? inputKey.substring(0, 8) + '...' + inputKey.substring(inputKey.length - 4)
    : '';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>API Keys</Text>
      </View>

      <Animated.View entering={FadeIn.duration(400)} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBadge}>
            <Ionicons name="key" size={20} color={C.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>NVIDIA NIM API Key</Text>
            <Text style={styles.cardSubtitle}>Encrypted with AES-256-GCM</Text>
          </View>
          {hasApiKey && (
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Active</Text>
            </View>
          )}
        </View>

        <View style={styles.inputRow}>
          <View style={styles.keyInputWrapper}>
            <TextInput
              style={styles.keyInput}
              value={showKey ? inputKey : (inputKey ? maskedKey : '')}
              onChangeText={setInputKey}
              placeholder="nvapi-..."
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showKey && !!inputKey}
              testID="api-key-input"
            />
            <Pressable
              onPress={() => setShowKey(!showKey)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showKey ? 'eye-off' : 'eye'}
                size={18}
                color={C.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            onPress={handleSave}
            style={[styles.saveButton, saved && styles.savedButton]}
            testID="save-key-button"
          >
            <Ionicons
              name={saved ? 'checkmark' : 'shield-checkmark'}
              size={16}
              color="#fff"
            />
            <Text style={styles.saveText}>{saved ? 'Saved' : 'Save Key'}</Text>
          </Pressable>

          {hasApiKey && (
            <Pressable onPress={handleClear} style={styles.clearButton}>
              <Ionicons name="trash-outline" size={16} color={C.error} />
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="lock-closed" size={16} color={C.green} />
          <Text style={styles.infoText}>
            Keys are stored with encrypted secure storage on your device
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="server" size={16} color={C.accent} />
          <Text style={styles.infoText}>
            Used for NVIDIA NIM API (nemotron-4-340b-instruct)
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="cloud-offline" size={16} color={C.warning} />
          <Text style={styles.infoText}>
            Keys never leave your device unencrypted
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How to get a key</Text>
        <Text style={styles.infoDesc}>
          1. Visit build.nvidia.com{'\n'}
          2. Sign up for NVIDIA NIM{'\n'}
          3. Generate an API key{'\n'}
          4. Paste it above and save
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 20 },
  header: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    marginBottom: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  cardSubtitle: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.greenBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  statusText: { fontSize: 11, fontWeight: '600', color: C.green },
  inputRow: { marginBottom: 16 },
  keyInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
  },
  keyInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    paddingVertical: 14,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  eyeButton: { padding: 8 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    paddingVertical: 14,
    borderRadius: 12,
  },
  savedButton: { backgroundColor: C.green },
  saveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  clearText: { fontSize: 14, fontWeight: '500', color: C.error },
  infoCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  infoText: { flex: 1, fontSize: 13, color: C.textSecondary, lineHeight: 18 },
  infoTitle: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 },
  infoDesc: { fontSize: 13, color: C.textSecondary, lineHeight: 22 },
});
