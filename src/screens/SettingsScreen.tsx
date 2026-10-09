import React from 'react';
import { View, Pressable, StyleSheet, Platform, ScrollView, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C, F, Ic, T, useHanken, useTheme } from '../theme/tokens';
import { useBrowserStore } from '../browser/browserStore';
import { LockManager } from '../security/lockManager';
import { DownloadManager } from '../downloads/downloadManager';
import { ActionSheetModal, ConfirmDialogModal, NoticeDialogModal } from '../components/AppModal';
import SearchEngineIcon from '../components/SearchEngineIcon';
import NetworkSettingsScreen from './settings/NetworkSettingsScreen';
import IdentitySettingsScreen from './settings/IdentitySettingsScreen';
import ContentSettingsScreen from './settings/ContentSettingsScreen';
import PermissionsSettingsScreen from './settings/PermissionsSettingsScreen';
import LockEmergencySettingsScreen from './settings/LockEmergencySettingsScreen';
import SafetySettingsScreen from './settings/SafetySettingsScreen';

interface SettingsScreenProps {
  onDone: () => void;
  onChangePasswordPrompt: () => void;
}

function Toggle({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={[s.sw, { backgroundColor: on ? theme.green : theme.swOff }]}
    >
      <View style={[s.knob, { backgroundColor: theme.knob }, on ? { right: 2 } : { left: 2 }]} />
    </Pressable>
  );
}

export default function SettingsScreen({ onDone, onChangePasswordPrompt }: SettingsScreenProps) {
  const ok = useHanken();
  const theme = useTheme();

  const [activeSubScreen, setActiveSubScreen] = React.useState<
    'main' | 'network' | 'identity' | 'content' | 'permissions' | 'lock' | 'safety'
  >('main');

  const {
    themeMode,
    setThemeMode,
    searchEngine,
    setSearchEngine,
    searchSuggestions,
    setSearchSuggestions,
    blockAds,
    setBlockAds,
    blockCookies,
    setBlockCookies,
    httpsOnly,
    setHttpsOnly,
    sendGpc,
    setSendGpc,
    wifiOnly,
    setWifiOnly,
    removeDetailsAfterDl,
    setRemoveDetailsAfterDl,
    saveDestination,
    setSaveDestination,
    autoLockLabel,
    setAutoLockLabel,
    fingerprintEnabled,
    setFingerprintEnabled,
    clearEverything,
  } = useBrowserStore();

  const [clearDataConfirmVisible, setClearDataConfirmVisible] = React.useState(false);
  const [sessionClearedNotice, setSessionClearedNotice] = React.useState(false);
  const [searchEngineModalVisible, setSearchEngineModalVisible] = React.useState(false);

  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeSubScreen !== 'main') {
        setActiveSubScreen('main');
        return true;
      }
      if (searchEngineModalVisible) {
        setSearchEngineModalVisible(false);
        return true;
      }
      if (clearDataConfirmVisible) {
        setClearDataConfirmVisible(false);
        return true;
      }
      if (sessionClearedNotice) {
        setSessionClearedNotice(false);
        return true;
      }
      onDone();
      return true;
    });
    return () => sub.remove();
  }, [activeSubScreen, searchEngineModalVisible, clearDataConfirmVisible, sessionClearedNotice, onDone]);

  function handleThemeCycle() {
    const modes: ('dark' | 'light' | 'system')[] = ['dark', 'light', 'system'];
    const idx = modes.indexOf(themeMode);
    const next = modes[(idx + 1) % modes.length];
    setThemeMode(next);
  }

  function handleAutoLockCycle() {
    const options = ['Immediately', '1 minute', '5 minutes', 'Never'];
    const timeouts = ['0', '60', '300', '-1'];
    const idx = options.indexOf(autoLockLabel);
    const nextIdx = (idx + 1) % options.length;
    setAutoLockLabel(options[nextIdx]);
    LockManager.setAutoLockTimeout(timeouts[nextIdx]);
  }

  function handleSaveDestinationToggle() {
    const next = saveDestination === 'Downloads' ? 'App Secure Storage' : 'Downloads';
    setSaveDestination(next);
    DownloadManager.setSaveDestination(next === 'Downloads' ? 'downloads' : 'app_private');
  }

  function handleClearAllData() {
    setClearDataConfirmVisible(true);
  }

  if (!ok) return null;

  // Sub-screen rendering
  if (activeSubScreen === 'network') {
    return <NetworkSettingsScreen onBack={() => setActiveSubScreen('main')} />;
  }
  if (activeSubScreen === 'identity') {
    return <IdentitySettingsScreen onBack={() => setActiveSubScreen('main')} />;
  }
  if (activeSubScreen === 'content') {
    return <ContentSettingsScreen onBack={() => setActiveSubScreen('main')} />;
  }
  if (activeSubScreen === 'permissions') {
    return <PermissionsSettingsScreen onBack={() => setActiveSubScreen('main')} />;
  }
  if (activeSubScreen === 'lock') {
    return (
      <LockEmergencySettingsScreen
        onBack={() => setActiveSubScreen('main')}
        onChangePasswordPrompt={onChangePasswordPrompt}
      />
    );
  }
  if (activeSubScreen === 'safety') {
    return <SafetySettingsScreen onBack={() => setActiveSubScreen('main')} />;
  }

  const rowBorder = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.sep };

  return (
    <View style={{ flex: 1, backgroundColor: theme.grouped }}>
      <StatusBar style={theme.statusBar} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <View style={{ width: 40 }} />
          <Pressable onPress={onDone} hitSlop={10}>
            <T style={{ color: theme.blue, fontFamily: F.s, fontSize: 17 }}>Done</T>
          </Pressable>
        </View>
