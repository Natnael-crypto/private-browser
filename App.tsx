import React, { useState, useEffect } from 'react';
import { View, StyleSheet, AppState, AppStateStatus, Modal, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useHanken, useTheme } from './src/theme/tokens';
import { LockManager } from './src/security/lockManager';
import { DownloadManager } from './src/downloads/downloadManager';
import { useBrowserStore } from './src/browser/browserStore';

import * as ScreenCapture from 'expo-screen-capture';
import LockScreen from './src/screens/LockScreen';
import BrowserScreen from './src/screens/BrowserScreen';
import TabsScreen from './src/screens/TabsScreen';
import DownloadsScreen from './src/screens/DownloadsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import VideosSheetScreen from './src/screens/VideosSheetScreen';
import BookmarksModal from './src/screens/BookmarksModal';

type AppScreen = 'browser' | 'tabs' | 'downloads' | 'settings';

export default function App() {
  const fontsLoaded = useHanken();
  const theme = useTheme();

  const [isLocked, setIsLocked] = useState(true);
  const [screenStack, setScreenStack] = useState<AppScreen[]>(['browser']);
  const currentScreen = screenStack[screenStack.length - 1] || 'browser';
  const [isVideosSheetOpen, setIsVideosSheetOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [changePasswordModal, setChangePasswordModal] = useState(false);

  const { tabs, activeTabId, createTab, navigateTab } = useBrowserStore();
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const navigateTo = (screen: AppScreen) => {
    setScreenStack((prev) => {
      if (prev[prev.length - 1] === screen) return prev;
      return [...prev, screen];
    });
  };

  const goBackScreen = () => {
    setScreenStack((prev) => {
      if (prev.length > 1) {
        return prev.slice(0, prev.length - 1);
      }
      return prev;
    });
  };

  const resetToBrowser = () => {
    setScreenStack(['browser']);
  };

  // Initialize downloads settings, database, persisted settings, and screen privacy on mount
  useEffect(() => {
    useBrowserStore.getState().loadPersistedSettings();
    DownloadManager.initSettings();
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    import('react-native').then(({ StatusBar: RNStatusBar }) => {
      (RNStatusBar as any).setTranslucent?.(true);
      (RNStatusBar as any).setBackgroundColor?.('transparent');
    });
  }, []);

  // AppState Auto-Lock & Screen-Off Lock Manager (SEC-2, SEC-6)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const shouldLock = await LockManager.shouldLockOnResume();
        if (shouldLock) {
          setIsLocked(true);
        }
      } else if (nextState === 'background' || nextState === 'inactive') {
        const { screenOffLock } = useBrowserStore.getState();
        if (screenOffLock) {
          setIsLocked(true);
        }
        LockManager.recordActive();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Hardware Back Button Handler for Screen Stack & Modals
  useEffect(() => {
    const onHardwareBackPress = () => {
      if (changePasswordModal) {
        setChangePasswordModal(false);
        return true;
      }
      if (isBookmarksOpen) {
        setIsBookmarksOpen(false);
        return true;
      }
      if (isVideosSheetOpen) {
        setIsVideosSheetOpen(false);
        return true;
      }
      if (screenStack.length > 1) {
        goBackScreen();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
    return () => subscription.remove();
  }, [changePasswordModal, isBookmarksOpen, isVideosSheetOpen, screenStack]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  // Active Screen Renderer
  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        style={theme.isDark ? 'light' : (currentScreen === 'browser' && activeTab?.isBlank ? 'light' : 'dark')}
      />

      {/* Browser Screen (persisted in view hierarchy so WebViews and history stacks are preserved) */}
      <View
        style={[
          StyleSheet.absoluteFill,
          currentScreen !== 'browser' && { display: 'none' },
        ]}
      >
        <BrowserScreen
          isLocked={isLocked}
          isActiveScreen={currentScreen === 'browser' && !isLocked}
          onOpenTabs={() => navigateTo('tabs')}
          onOpenBookmarks={() => setIsBookmarksOpen(true)}
          onOpenDownloads={() => navigateTo('downloads')}
          onOpenSettings={() => navigateTo('settings')}
          onOpenVideosSheet={() => setIsVideosSheetOpen(true)}
        />
      </View>

      {currentScreen === 'tabs' && (
        <TabsScreen
          onDone={goBackScreen}
          onOpenSettings={() => navigateTo('settings')}
          onOpenDownloads={() => navigateTo('downloads')}
        />