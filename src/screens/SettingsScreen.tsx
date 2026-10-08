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