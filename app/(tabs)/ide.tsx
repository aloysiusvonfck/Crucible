import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { useApp } from '@/lib/app-context';

const C = colors.dark;

const KEYWORDS = [
  'fun', 'val', 'var', 'class', 'object', 'interface', 'package', 'import',
  'return', 'if', 'else', 'when', 'for', 'while', 'do', 'try', 'catch',
  'finally', 'throw', 'override', 'open', 'abstract', 'sealed', 'data',
  'enum', 'companion', 'private', 'public', 'protected', 'internal',
  'suspend', 'lateinit', 'by', 'lazy', 'inline', 'reified', 'typealias',
  'annotation', 'true', 'false', 'null', 'this', 'super', 'is', 'as', 'in',
];

const COMPOSE_KEYWORDS = [
  '@Composable', '@Preview', 'remember', 'mutableStateOf', 'LaunchedEffect',
  'Modifier', 'Column', 'Row', 'Box', 'Text', 'Button', 'Spacer',
  'Surface', 'Scaffold', 'TopAppBar', 'MaterialTheme',
];

function getLineHighlights(line: string): { text: string; color: string }[] {
  const segments: { text: string; color: string }[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    let matched = false;

    if (remaining.startsWith('//')) {
      segments.push({ text: remaining, color: C.comment });
      return segments;
    }

    const stringMatch = remaining.match(/^"(?:[^"\\]|\\.)*"/);
    if (stringMatch) {
      segments.push({ text: stringMatch[0], color: C.string });
      remaining = remaining.slice(stringMatch[0].length);
      matched = true;
      continue;
    }

    const annotationMatch = remaining.match(/^@\w+/);
    if (annotationMatch) {
      segments.push({ text: annotationMatch[0], color: C.type });
      remaining = remaining.slice(annotationMatch[0].length);
      matched = true;
      continue;
    }

    const numMatch = remaining.match(/^\b\d+(\.\d+)?(f|L|u)?\b/);
    if (numMatch) {
      segments.push({ text: numMatch[0], color: C.number });
      remaining = remaining.slice(numMatch[0].length);
      matched = true;
      continue;
    }

    const wordMatch = remaining.match(/^\b\w+\b/);
    if (wordMatch) {
      const word = wordMatch[0];
      if (KEYWORDS.includes(word)) {
        segments.push({ text: word, color: C.keyword });
      } else if (COMPOSE_KEYWORDS.includes(word)) {
        segments.push({ text: word, color: C.function });
      } else if (word[0] === word[0].toUpperCase() && /^[A-Z]/.test(word)) {
        segments.push({ text: word, color: C.type });
      } else {
        segments.push({ text: word, color: C.text });
      }
      remaining = remaining.slice(word.length);
      matched = true;
      continue;
    }

    if (!matched) {
      segments.push({ text: remaining[0], color: C.text });
      remaining = remaining.slice(1);
    }
  }
  return segments;
}

function SyntaxLine({ lineNumber, line }: { lineNumber: number; line: string }) {
  const highlights = useMemo(() => getLineHighlights(line), [line]);
  return (
    <View style={styles.codeLine}>
      <Text style={styles.lineNumber}>{lineNumber}</Text>
      <View style={styles.lineContent}>
        {highlights.map((seg, i) => (
          <Text key={i} style={[styles.codeText, { color: seg.color }]}>{seg.text}</Text>
        ))}
        {line.length === 0 && <Text style={styles.codeText}>{' '}</Text>}
      </View>
    </View>
  );
}

export default function IDEScreen() {
  const insets = useSafeAreaInsets();
  const {
    files, currentFile, editorCode, setEditorCode,
    setCurrentFile, saveFile, deleteFile, createFile, moduleVersion,
  } = useApp();
  const [showBrowser, setShowBrowser] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const codeLines = useMemo(() => editorCode.split('\n'), [editorCode]);

  const handleSave = useCallback(async () => {
    if (!currentFile) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveFile(currentFile, editorCode);
    Alert.alert('Saved', `${currentFile} saved to workspace`);
  }, [currentFile, editorCode, saveFile]);

  const handleSelectFile = useCallback((name: string) => {
    const file = files.find(f => f.name === name);
    if (file) {
      setCurrentFile(name);
      setEditorCode(file.content);
      setShowBrowser(false);
      setIsEditing(false);
    }
  }, [files, setCurrentFile, setEditorCode]);

  const handleCreateFile = useCallback(async () => {
    const name = newFileName.trim();
    if (!name) return;
    await createFile(name.endsWith('.kt') ? name : `${name}.kt`);
    setNewFileName('');
    setShowNewFile(false);
    setShowBrowser(false);
  }, [newFileName, createFile]);

  const handleDeleteFile = useCallback((name: string) => {
    Alert.alert('Delete File', `Delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteFile(name),
      },
    ]);
  }, [deleteFile]);

  const monoFont = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Pressable onPress={() => setShowBrowser(true)} style={styles.toolbarButton}>
          <Ionicons name="folder-open" size={18} color={C.accent} />
        </Pressable>
        <View style={styles.fileTab}>
          <Ionicons name="document-text" size={14} color={C.green} />
          <Text style={styles.fileName} numberOfLines={1}>
            {currentFile || 'No file open'}
          </Text>
          <Text style={styles.versionBadge}>v{moduleVersion}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable
            onPress={() => setIsEditing(!isEditing)}
            style={[styles.toolbarButton, isEditing && styles.activeToolbarButton]}
          >
            <Ionicons name={isEditing ? 'code-slash' : 'create'} size={18} color={isEditing ? C.green : C.accent} />
          </Pressable>
          <Pressable onPress={handleSave} style={styles.toolbarButton}>
            <Ionicons name="save" size={18} color={C.accent} />
          </Pressable>
        </View>
      </View>

      {isEditing ? (
        <TextInput
          style={[styles.rawEditor, { fontFamily: monoFont }]}
          value={editorCode}
          onChangeText={setEditorCode}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textAlignVertical="top"
          testID="code-editor"
        />
      ) : (
        <FlatList
          data={codeLines}
          keyExtractor={(_, i) => `line-${i}`}
          renderItem={({ item, index }) => (
            <SyntaxLine lineNumber={index + 1} line={item} />
          )}
          style={styles.codeView}
          contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
          showsVerticalScrollIndicator
          scrollEnabled={codeLines.length > 0}
        />
      )}

      <Modal visible={showBrowser} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Workspace Files</Text>
              <Pressable onPress={() => setShowBrowser(false)}>
                <Ionicons name="close" size={24} color={C.text} />
              </Pressable>
            </View>

            <FlatList
              data={files}
              keyExtractor={item => item.name}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelectFile(item.name)}
                  style={[
                    styles.fileItem,
                    item.name === currentFile && styles.fileItemActive,
                  ]}
                >
                  <Ionicons
                    name="document-text"
                    size={18}
                    color={item.name === currentFile ? C.accent : C.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileItemName}>{item.name}</Text>
                    <Text style={styles.fileItemMeta}>
                      {new Date(item.lastModified).toLocaleDateString()} - {item.content.split('\n').length} lines
                    </Text>
                  </View>
                  <Pressable onPress={() => handleDeleteFile(item.name)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={16} color={C.error} />
                  </Pressable>
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyFiles}>
                  <Text style={styles.emptyText}>No files in workspace</Text>
                </View>
              }
              scrollEnabled={!!files.length}
            />

            {showNewFile ? (
              <View style={styles.newFileRow}>
                <TextInput
                  style={styles.newFileInput}
                  value={newFileName}
                  onChangeText={setNewFileName}
                  placeholder="filename.kt"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="none"
                  autoFocus
                />
                <Pressable onPress={handleCreateFile} style={styles.newFileButton}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </Pressable>
                <Pressable onPress={() => setShowNewFile(false)} style={styles.newFileCancelButton}>
                  <Ionicons name="close" size={18} color={C.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setShowNewFile(true)} style={styles.addFileButton}>
                <Ionicons name="add" size={18} color={C.accent} />
                <Text style={styles.addFileText}>New File</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    gap: 8,
  },
  toolbarButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeToolbarButton: { backgroundColor: C.greenBg, borderWidth: 1, borderColor: C.greenDim },
  fileTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  fileName: { flex: 1, fontSize: 13, fontWeight: '500', color: C.text },
  versionBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: C.accent,
    backgroundColor: C.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeView: { flex: 1 },
  codeLine: { flexDirection: 'row', paddingHorizontal: 4, minHeight: 22 },
  lineNumber: {
    width: 40,
    textAlign: 'right',
    paddingRight: 12,
    fontSize: 12,
    color: C.textMuted,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    lineHeight: 22,
  },
  lineContent: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  codeText: {
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    lineHeight: 22,
  },
  rawEditor: {
    flex: 1,
    fontSize: 13,
    color: C.text,
    padding: 12,
    lineHeight: 22,
    backgroundColor: C.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  fileItemActive: { backgroundColor: C.surfaceElevated },
  fileItemName: { fontSize: 14, fontWeight: '500', color: C.text },
  fileItemMeta: { fontSize: 11, color: C.textSecondary, marginTop: 2 },
  emptyFiles: { paddingVertical: 30, alignItems: 'center' },
  emptyText: { fontSize: 14, color: C.textSecondary },
  newFileRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  newFileInput: {
    flex: 1,
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  newFileButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newFileCancelButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
  },
  addFileText: { fontSize: 14, fontWeight: '500', color: C.accent },
});
