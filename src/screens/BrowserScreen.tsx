import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
  Share,
  ScrollView,
  Linking,
  ImageBackground,
  StatusBar as RNStatusBar,
  BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import { C, F, Ic, T, useHanken, useTheme } from '../theme/tokens';
import { useBrowserStore, BrowserTab } from '../browser/browserStore';
import { PrivacyManager } from '../privacy/privacyManager';
import { BlockerEngine } from '../blocker/blockerEngine';
import { INJECTED_VIDEO_DETECTOR_SCRIPT } from '../video/injectedDetector';
import { VideoRegistry, DetectedVideoItem } from '../video/videoRegistry';
import { SuggestionsService } from '../browser/suggestionsService';
import { DownloadManager } from '../downloads/downloadManager';
import { ActionSheetModal, ConfirmDialogModal, NoticeDialogModal } from '../components/AppModal';
import SearchEngineIcon from '../components/SearchEngineIcon';
import { PolicyEngine, USER_AGENT_PRESETS } from '../policy/policyEngine';
import { DebugLogger } from '../utils/debugLogger';

function MicIcon({ size = 20, color = '#5f6368' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Path d="M12 19v4" />
      <Path d="M8 23h8" />
    </Svg>
  );
}

function LensIcon({ size = 20, color = '#5f6368' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </Svg>
  );
}

interface BrowserScreenProps {
  isLocked?: boolean;
  isActiveScreen?: boolean;
  onOpenTabs: () => void;
  onOpenBookmarks: () => void;
  onOpenDownloads: () => void;
  onOpenSettings: () => void;
  onOpenVideosSheet: () => void;
}

export default function BrowserScreen({
  isLocked = false,
  isActiveScreen = true,
  onOpenTabs,
  onOpenBookmarks,
  onOpenDownloads,
  onOpenSettings,
  onOpenVideosSheet,
}: BrowserScreenProps) {
  const ok = useHanken();
  const theme = useTheme();
  const webViewRefs = useRef<{ [tabId: string]: any }>({});
  const [webViewRemountKeys, setWebViewRemountKeys] = useState<Record<string, number>>({});

  const {
    tabs,
    activeTabId,
    createTab,
    updateTab,
    navigateTab,
    reloadTab,
    stopTab,
    toggleDesktopMode,
    incrementBlockedCount,
    resetBlockedCount,
    blockAds,
    blockCookies,
    sendGpc,