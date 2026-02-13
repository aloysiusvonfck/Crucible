import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

interface FileEntry {
  name: string;
  content: string;
  lastModified: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface BuildLog {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: number;
}

interface AppContextValue {
  apiKey: string;
  setApiKey: (key: string) => Promise<void>;
  hasApiKey: boolean;
  isKeyLoaded: boolean;

  files: FileEntry[];
  currentFile: string | null;
  editorCode: string;
  setEditorCode: (code: string) => void;
  setCurrentFile: (name: string | null) => void;
  saveFile: (name: string, content: string) => Promise<void>;
  deleteFile: (name: string) => Promise<void>;
  createFile: (name: string) => Promise<void>;
  loadFiles: () => Promise<void>;

  chatMessages: ChatMessage[];
  setChatMessages: (msgs: ChatMessage[]) => void;
  addChatMessage: (msg: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  clearChat: () => Promise<void>;

  buildLogs: BuildLog[];
  addBuildLog: (message: string, type: BuildLog['type']) => void;
  clearBuildLogs: () => void;

  generatedCode: string;
  setGeneratedCode: (code: string) => void;
  applyToEditor: (code: string, fileName?: string) => void;

  moduleVersion: number;
  incrementModuleVersion: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

let msgCounter = 0;
export function generateId(): string {
  msgCounter++;
  return `id-${Date.now()}-${msgCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

const STORAGE_KEYS = {
  FILES: 'nexus_files',
  MESSAGES: 'nexus_chat_messages',
  API_KEY: 'nim_key',
  MODULE_VERSION: 'nexus_module_version',
};

const DEFAULT_FILE: FileEntry = {
  name: 'main.kt',
  content: `package com.nexus.module

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun MainModule() {
    var count by remember { mutableStateOf(0) }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Dynamic Module v1",
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = { count++ }) {
            Text("Clicked: \$count times")
        }
    }
}`,
  lastModified: Date.now(),
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState('');
  const [isKeyLoaded, setIsKeyLoaded] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [editorCode, setEditorCode] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([]);
  const [generatedCode, setGeneratedCode] = useState('');
  const [moduleVersion, setModuleVersion] = useState(1);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    (async () => {
      try {
        const key = await SecureStore.getItemAsync(STORAGE_KEYS.API_KEY);
        if (key) setApiKeyState(key);
      } catch {}
      setIsKeyLoaded(true);

      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.FILES);
        if (stored) {
          const parsed = JSON.parse(stored) as FileEntry[];
          setFiles(parsed);
          if (parsed.length > 0) {
            setCurrentFile(parsed[0].name);
            setEditorCode(parsed[0].content);
          }
        } else {
          setFiles([DEFAULT_FILE]);
          setCurrentFile(DEFAULT_FILE.name);
          setEditorCode(DEFAULT_FILE.content);
          await AsyncStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify([DEFAULT_FILE]));
        }
      } catch {
        setFiles([DEFAULT_FILE]);
        setCurrentFile(DEFAULT_FILE.name);
        setEditorCode(DEFAULT_FILE.content);
      }

      try {
        const msgs = await AsyncStorage.getItem(STORAGE_KEYS.MESSAGES);
        if (msgs) setChatMessages(JSON.parse(msgs));
      } catch {}

      try {
        const ver = await AsyncStorage.getItem(STORAGE_KEYS.MODULE_VERSION);
        if (ver) setModuleVersion(parseInt(ver, 10));
      } catch {}
    })();
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    setApiKeyState(key);
    await SecureStore.setItemAsync(STORAGE_KEYS.API_KEY, key);
  }, []);

  const saveFile = useCallback(async (name: string, content: string) => {
    setFiles(prev => {
      const updated = prev.map(f =>
        f.name === name ? { ...f, content, lastModified: Date.now() } : f
      );
      const exists = prev.some(f => f.name === name);
      const result = exists ? updated : [...prev, { name, content, lastModified: Date.now() }];
      AsyncStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(result));
      return result;
    });
  }, []);

  const deleteFile = useCallback(async (name: string) => {
    setFiles(prev => {
      const updated = prev.filter(f => f.name !== name);
      AsyncStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(updated));
      return updated;
    });
    setCurrentFile(prev => prev === name ? null : prev);
  }, []);

  const createFile = useCallback(async (name: string) => {
    const entry: FileEntry = { name, content: '', lastModified: Date.now() };
    setFiles(prev => {
      const updated = [...prev, entry];
      AsyncStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(updated));
      return updated;
    });
    setCurrentFile(name);
    setEditorCode('');
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.FILES);
      if (stored) setFiles(JSON.parse(stored));
    } catch {}
  }, []);

  const addChatMessage = useCallback((msg: ChatMessage) => {
    setChatMessages(prev => {
      const updated = [...prev, msg];
      AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateLastMessage = useCallback((content: string) => {
    setChatMessages(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[updated.length - 1] = { ...updated[updated.length - 1], content };
      }
      AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearChat = useCallback(async () => {
    setChatMessages([]);
    await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify([]));
  }, []);

  const addBuildLog = useCallback((message: string, type: BuildLog['type']) => {
    setBuildLogs(prev => [...prev, { id: generateId(), message, type, timestamp: Date.now() }]);
  }, []);

  const clearBuildLogs = useCallback(() => setBuildLogs([]), []);

  const applyToEditor = useCallback((code: string, fileName?: string) => {
    const target = fileName || currentFile || 'generated.kt';
    setEditorCode(code);
    setCurrentFile(target);
    saveFile(target, code);
  }, [currentFile, saveFile]);

  const incrementModuleVersion = useCallback(() => {
    setModuleVersion(prev => {
      const next = prev + 1;
      AsyncStorage.setItem(STORAGE_KEYS.MODULE_VERSION, next.toString());
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    apiKey,
    setApiKey,
    hasApiKey: apiKey.length > 0,
    isKeyLoaded,
    files,
    currentFile,
    editorCode,
    setEditorCode,
    setCurrentFile,
    saveFile,
    deleteFile,
    createFile,
    loadFiles,
    chatMessages,
    setChatMessages,
    addChatMessage,
    updateLastMessage,
    clearChat,
    buildLogs,
    addBuildLog,
    clearBuildLogs,
    generatedCode,
    setGeneratedCode,
    applyToEditor,
    moduleVersion,
    incrementModuleVersion,
  }), [apiKey, setApiKey, isKeyLoaded, files, currentFile, editorCode, chatMessages, buildLogs, generatedCode, moduleVersion, saveFile, deleteFile, createFile, loadFiles, addChatMessage, updateLastMessage, clearChat, addBuildLog, clearBuildLogs, applyToEditor, incrementModuleVersion]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
