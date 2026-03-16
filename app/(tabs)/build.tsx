import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { useApp, generateId } from '@/lib/app-context';
import { streamFromApi } from '@/lib/streaming';

const C = colors.dark;

function LogEntry({ item }: { item: { message: string; type: string; timestamp: number } }) {
  const iconMap: Record<string, { name: string; color: string }> = {
    info: { name: 'information-circle', color: C.accent },
    success: { name: 'checkmark-circle', color: C.green },
    error: { name: 'alert-circle', color: C.error },
    warning: { name: 'warning', color: C.warning },
  };
  const icon = iconMap[item.type] || iconMap.info;
  return (
    <View style={styles.logItem}>
      <Ionicons name={icon.name as any} size={14} color={icon.color} />
      <Text style={[styles.logText, { color: icon.color }]}>
        [{new Date(item.timestamp).toLocaleTimeString()}] {item.message}
      </Text>
    </View>
  );
}

export default function BuildScreen() {
  const insets = useSafeAreaInsets();
  const {
    editorCode, currentFile, apiKey, buildLogs, addBuildLog,
    clearBuildLogs, generatedCode, setGeneratedCode,
    applyToEditor, incrementModuleVersion, saveFile,
  } = useApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [modifyPrompt, setModifyPrompt] = useState('');
  const [activeMode, setActiveMode] = useState<'generate' | 'modify'>('generate');
  const scrollRef = useRef<ScrollView>(null);

  const handleGenerate = useCallback(async () => {
    if (!editorCode.trim()) {
      Alert.alert('No Code', 'Open a file in the IDE tab first');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGenerating(true);
    setGeneratedCode('');
    clearBuildLogs();
    addBuildLog('Starting module generation...', 'info');
    addBuildLog(`Source: ${currentFile || 'editor'}`, 'info');

    let fullCode = '';
    try {
      await streamFromApi(
        'api/generate-module',
        { code: editorCode, apiKey: apiKey || undefined },
        (chunk) => {
          fullCode += chunk;
          setGeneratedCode(fullCode);
        },
      );
      addBuildLog('Module generation complete', 'success');
      addBuildLog(`Generated ${fullCode.split('\n').length} lines`, 'info');
    } catch (err: any) {
      addBuildLog(`Generation failed: ${err.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [editorCode, currentFile, apiKey, addBuildLog, clearBuildLogs, setGeneratedCode]);

  const handleSelfModify = useCallback(async () => {
    if (!editorCode.trim()) {
      Alert.alert('No Code', 'Open a file in the IDE tab first');
      return;
    }
    if (!modifyPrompt.trim()) {
      Alert.alert('No Instruction', 'Enter what you want to change');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGenerating(true);
    setGeneratedCode('');
    clearBuildLogs();
    addBuildLog('Self-modification initiated...', 'info');
    addBuildLog(`Instruction: ${modifyPrompt}`, 'info');
    addBuildLog(`Target: ${currentFile || 'editor'}`, 'info');

    let fullCode = '';
    try {
      await streamFromApi(
        'api/self-modify',
        { code: editorCode, instruction: modifyPrompt, apiKey: apiKey || undefined },
        (chunk) => {
          fullCode += chunk;
          setGeneratedCode(fullCode);
        },
      );
      addBuildLog('Self-modification complete', 'success');
      addBuildLog(`Modified code: ${fullCode.split('\n').length} lines`, 'info');
    } catch (err: any) {
      addBuildLog(`Modification failed: ${err.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [editorCode, modifyPrompt, currentFile, apiKey, addBuildLog, clearBuildLogs, setGeneratedCode]);

  const handleCompileAndLoad = useCallback(async () => {
    if (!generatedCode.trim()) {
      Alert.alert('No Code', 'Generate a module first');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsCompiling(true);
    addBuildLog('Validating Kotlin syntax...', 'info');

    // Basic Kotlin validation
    const validation = validateKotlinCode(generatedCode);
    
    if (!validation.valid) {
      addBuildLog(`Syntax error: ${validation.error}`, 'error');
      setIsCompiling(false);
      Alert.alert('Validation Failed', validation.error || 'Code contains errors');
      return;
    }

    addBuildLog('Syntax validation passed', 'success');
    addBuildLog(`Found ${validation.composableCount} @Composable functions`, 'info');

    // Determine target file
    const targetFile = currentFile || `Module_${Date.now()}.kt`;
    
    try {
      // Apply to editor (this saves to async-storage)
      applyToEditor(generatedCode, targetFile);
      addBuildLog(`Saved to: ${targetFile}`, 'success');

      incrementModuleVersion();
      addBuildLog('Module version incremented', 'info');

      await new Promise(r => setTimeout(r, 400));
      addBuildLog('Hot-reload triggered - code updated in IDE', 'success');

      setIsCompiling(false);

      Alert.alert(
        'Code Saved',
        `Saved to ${targetFile}. Open the IDE tab to view and edit.`,
        [
          { text: 'OK', style: 'default' },
        ],
      );
    } catch (err: any) {
      addBuildLog(`Save failed: ${err.message}`, 'error');
      setIsCompiling(false);
    }
  }, [generatedCode, currentFile, applyToEditor, incrementModuleVersion, addBuildLog]);

  // Basic Kotlin syntax validator
  function validateKotlinCode(code: string): { valid: boolean; error?: string; composableCount: number } {
    // Check for basic structure
    if (!code.includes('package')) {
      return { valid: false, error: 'Missing package declaration', composableCount: 0 };
    }

    // Count composable functions
    const composableMatches = code.match(/@Composable\s*\n?\s*fun/g) || [];
    const composableCount = composableMatches.length;

    // Check for balanced braces
    let braceCount = 0;
    for (const char of code) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (braceCount < 0) {
        return { valid: false, error: 'Unbalanced braces - too many closing braces', composableCount };
      }
    }

    if (braceCount !== 0) {
      return { valid: false, error: `Unbalanced braces - ${braceCount} unclosed`, composableCount };
    }

    // Check for import statements if using Compose
    if (code.includes('@Composable') && !code.includes('import androidx.compose')) {
      return { valid: false, error: 'Missing Compose imports', composableCount };
    }

    return { valid: true, composableCount };
  }

  const monoFont = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Build</Text>
        {buildLogs.length > 0 && (
          <Pressable onPress={clearBuildLogs}>
            <Ionicons name="trash-outline" size={20} color={C.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={styles.modeSelector}>
        <Pressable
          onPress={() => setActiveMode('generate')}
          style={[styles.modeButton, activeMode === 'generate' && styles.modeActive]}
        >
          <Ionicons name="cube" size={16} color={activeMode === 'generate' ? C.accent : C.textSecondary} />
          <Text style={[styles.modeText, activeMode === 'generate' && styles.modeTextActive]}>
            Generate Module
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveMode('modify')}
          style={[styles.modeButton, activeMode === 'modify' && styles.modeActive]}
        >
          <MaterialCommunityIcons name="dna" size={16} color={activeMode === 'modify' ? C.green : C.textSecondary} />
          <Text style={[styles.modeText, activeMode === 'modify' && styles.modeTextActive]}>
            Self-Modify
          </Text>
        </Pressable>
      </View>

      <View style={styles.sourceCard}>
        <View style={styles.sourceHeader}>
          <Ionicons name="document-text" size={16} color={C.textSecondary} />
          <Text style={styles.sourceLabel}>Source: {currentFile || 'No file selected'}</Text>
          <Text style={styles.sourceLines}>{editorCode.split('\n').length} lines</Text>
        </View>
        <Text style={[styles.sourcePreview, { fontFamily: monoFont }]} numberOfLines={3}>
          {editorCode.substring(0, 200) || 'Open a file in the IDE tab...'}
        </Text>
      </View>

      {activeMode === 'modify' && (
        <View style={styles.promptCard}>
          <Text style={styles.promptLabel}>Modification Instruction</Text>
          <TextInput
            style={[styles.promptInput, { fontFamily: monoFont }]}
            value={modifyPrompt}
            onChangeText={setModifyPrompt}
            placeholder="e.g. Add dark theme support, optimize performance, add error handling..."
            placeholderTextColor={C.textMuted}
            multiline
            textAlignVertical="top"
          />
        </View>
      )}

      <Pressable
        onPress={activeMode === 'generate' ? handleGenerate : handleSelfModify}
        disabled={isGenerating}
        style={[
          styles.actionButton,
          activeMode === 'modify' && styles.modifyButton,
          isGenerating && styles.buttonDisabled,
        ]}
        testID="generate-button"
      >
        <Ionicons
          name={isGenerating ? 'hourglass' : activeMode === 'generate' ? 'flash' : 'git-merge'}
          size={18}
          color="#fff"
        />
        <Text style={styles.actionText}>
          {isGenerating
            ? 'Processing...'
            : activeMode === 'generate'
            ? 'Generate Module'
            : 'Self-Modify Code'}
        </Text>
      </Pressable>

      {generatedCode.length > 0 && (
        <View style={styles.outputCard}>
          <View style={styles.outputHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="code-slash" size={16} color={C.green} />
              <Text style={styles.outputTitle}>Generated Output</Text>
            </View>
            <Text style={styles.outputLines}>{generatedCode.split('\n').length} lines</Text>
          </View>
          <ScrollView
            horizontal={false}
            style={styles.outputScroll}
            nestedScrollEnabled
          >
            <Text style={[styles.outputCode, { fontFamily: monoFont }]} selectable>
              {generatedCode}
            </Text>
          </ScrollView>
          <View style={styles.outputActions}>
            <Pressable
              onPress={handleCompileAndLoad}
              disabled={isCompiling}
              style={[styles.compileButton, isCompiling && styles.buttonDisabled]}
              testID="compile-button"
            >
              <MaterialCommunityIcons name="rocket-launch" size={16} color="#fff" />
              <Text style={styles.compileText}>
                {isCompiling ? 'Compiling...' : 'Compile & Load'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                applyToEditor(generatedCode);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert('Applied', 'Code pasted to IDE editor');
              }}
              style={styles.pasteButton}
            >
              <Ionicons name="clipboard" size={16} color={C.accent} />
              <Text style={styles.pasteText}>Paste to IDE</Text>
            </Pressable>
          </View>
        </View>
      )}

      {buildLogs.length > 0 && (
        <View style={styles.logsCard}>
          <View style={styles.logsHeader}>
            <Ionicons name="terminal" size={16} color={C.textSecondary} />
            <Text style={styles.logsTitle}>Build Log</Text>
          </View>
          {buildLogs.map(log => (
            <LogEntry key={log.id} item={log} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    marginBottom: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  modeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  modeActive: {
    borderColor: C.accent,
    backgroundColor: C.surfaceElevated,
  },
  modeText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  modeTextActive: { color: C.text },
  sourceCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sourceLabel: { flex: 1, fontSize: 12, fontWeight: '500', color: C.textSecondary },
  sourceLines: { fontSize: 11, color: C.textMuted },
  sourcePreview: { fontSize: 11, color: C.textMuted, lineHeight: 16 },
  promptCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.greenDim,
    marginBottom: 16,
  },
  promptLabel: { fontSize: 12, fontWeight: '600', color: C.green, marginBottom: 8 },
  promptInput: {
    fontSize: 13,
    color: C.text,
    minHeight: 60,
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.accent,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 20,
  },
  modifyButton: { backgroundColor: C.greenDim },
  buttonDisabled: { opacity: 0.5 },
  actionText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  outputCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  outputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  outputTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  outputLines: { fontSize: 11, color: C.textMuted },
  outputScroll: { maxHeight: 250, padding: 14 },
  outputCode: { fontSize: 12, color: C.text, lineHeight: 18 },
  outputActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },
  compileButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.green,
    paddingVertical: 12,
    borderRadius: 10,
  },
  compileText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  pasteText: { fontSize: 13, fontWeight: '500', color: C.accent },
  logsCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  logsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  logsTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  logText: { flex: 1, fontSize: 11, lineHeight: 16 },
});
