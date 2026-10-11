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

        <T style={[s.title, { color: theme.text }]}>Settings</T>

        {/* Appearance Section */}
        <T style={[s.hd, { color: theme.sec }]}>Appearance</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <Pressable style={s.row} onPress={handleThemeCycle}>
            <T style={[s.label, { color: theme.text }]}>Theme</T>
            <View style={s.val}>
              <T style={{ color: theme.sec, fontFamily: F.r }}>
                {themeMode === 'dark' ? 'Dark (Apple)' : themeMode === 'light' ? 'Light' : 'Automatic (System)'}
              </T>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>
        </View>

        {/* Privacy Section */}
        <T style={[s.hd, { color: theme.sec }]}>Privacy</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <T style={[s.label, { color: theme.text }]}>Block ads and trackers</T>
            <Toggle
              label="Block ads and trackers"
              on={blockAds}
              onPress={() => setBlockAds(!blockAds)}
            />
          </View>
          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Block third-party cookies</T>
            <Toggle
              label="Block third-party cookies"
              on={blockCookies}
              onPress={() => setBlockCookies(!blockCookies)}
            />
          </View>
          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>HTTPS-only mode</T>
            <Toggle
              label="HTTPS-only mode"
              on={httpsOnly}
              onPress={() => setHttpsOnly(!httpsOnly)}
            />
          </View>
          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Send Global Privacy Control</T>
            <Toggle
              label="Send Global Privacy Control"
              on={sendGpc}
              onPress={() => setSendGpc(!sendGpc)}
            />
          </View>
        </View>

        {/* Advanced Security & Privacy (More Settings) Section */}
        <T style={[s.hd, { color: theme.sec }]}>More Security Settings</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <Pressable style={s.row} onPress={() => setActiveSubScreen('network')}>
            <T style={[s.label, { color: theme.text, flex: 1 }]}>Network & Proxy</T>
            <View style={s.val}>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>
          <Pressable style={[s.row, rowBorder]} onPress={() => setActiveSubScreen('identity')}>
            <T style={[s.label, { color: theme.text, flex: 1 }]}>Identity & Fingerprint</T>
            <View style={s.val}>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>
          <Pressable style={[s.row, rowBorder]} onPress={() => setActiveSubScreen('content')}>
            <T style={[s.label, { color: theme.text, flex: 1 }]}>Content & Scripts</T>
            <View style={s.val}>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>
          <Pressable style={[s.row, rowBorder]} onPress={() => setActiveSubScreen('permissions')}>
            <T style={[s.label, { color: theme.text, flex: 1 }]}>Permissions & Safe Browsing</T>
            <View style={s.val}>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>
          <Pressable style={[s.row, rowBorder]} onPress={() => setActiveSubScreen('lock')}>
            <T style={[s.label, { color: theme.text, flex: 1 }]}>Lock & Panic Wipe</T>
            <View style={s.val}>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>
          <Pressable style={[s.row, rowBorder]} onPress={() => setActiveSubScreen('safety')}>
            <T style={[s.label, { color: theme.text, flex: 1 }]}>Safety & Diagnostics</T>
            <View style={s.val}>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>
        </View>

        {/* Search Engine Section */}
        <T style={[s.hd, { color: theme.sec }]}>Search Engine</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <Pressable style={s.row} onPress={() => setSearchEngineModalVisible(true)}>
            <T style={[s.label, { color: theme.text }]}>Search Engine</T>
            <View style={s.val}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <SearchEngineIcon engine={searchEngine} size={20} />
                <T style={{ color: theme.sec, fontFamily: F.r }}>{searchEngine}</T>
              </View>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>
          <View style={[s.row, rowBorder]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <T style={[s.label, { color: theme.text }]}>Search Suggestions</T>
              <T style={{ color: theme.sec, fontSize: 13, fontFamily: F.r }}>
                Autocomplete suggestions as you type (off by default)
              </T>
            </View>
            <Toggle
              label="Search Suggestions"
              on={searchSuggestions}
              onPress={() => setSearchSuggestions(!searchSuggestions)}
            />
          </View>
        </View>

        {/* Lock Section */}
        <T style={[s.hd, { color: theme.sec }]}>Lock</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <Pressable style={s.row} onPress={onChangePasswordPrompt}>
            <T style={[s.label, { color: theme.text }]}>Password</T>
            <View style={s.val}>
              <T style={{ color: theme.sec, fontFamily: F.r }}>Change</T>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>
          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Unlock with fingerprint</T>
            <Toggle
              label="Unlock with fingerprint"
              on={fingerprintEnabled}
              onPress={async () => {
                const next = !fingerprintEnabled;
                setFingerprintEnabled(next);
                await LockManager.setBiometricEnabled(next);
              }}
            />
          </View>
          <Pressable style={[s.row, rowBorder]} onPress={handleAutoLockCycle}>
            <T style={[s.label, { color: theme.text }]}>Auto-lock</T>
            <View style={s.val}>
              <T style={{ color: theme.sec, fontFamily: F.r }}>{autoLockLabel}</T>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>
        </View>

        {/* Downloads Section */}
        <T style={[s.hd, { color: theme.sec }]}>Downloads</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <T style={[s.label, { color: theme.text }]}>Wi-Fi only</T>
            <Toggle
              label="Wi-Fi only"
              on={wifiOnly}
              onPress={() => setWifiOnly(!wifiOnly)}
            />
          </View>
          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Remove details after download</T>
            <Toggle
              label="Remove details after download"
              on={removeDetailsAfterDl}
              onPress={() => {
                const next = !removeDetailsAfterDl;
                setRemoveDetailsAfterDl(next);
                DownloadManager.setAutoRemoveDetails(next);
              }}
            />
          </View>
          <Pressable style={[s.row, rowBorder]} onPress={handleSaveDestinationToggle}>
            <T style={[s.label, { color: theme.text }]}>Save to</T>
            <View style={s.val}>
              <T style={{ color: theme.sec, fontFamily: F.r }}>{saveDestination}</T>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>
        </View>

        {/* Clear Data Section */}
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <Pressable
            style={[s.row, { justifyContent: 'center' }]}
            onPress={handleClearAllData}
          >
            <T style={{ color: theme.red, fontFamily: F.m }}>Clear all data now</T>
          </Pressable>
        </View>
      </ScrollView>

      <ConfirmDialogModal
        visible={clearDataConfirmVisible}
        title="Clear All Data"
        message="Are you sure you want to clear all cookies, cache, storage, bookmarks, and open tabs?"
        confirmText="Clear Everything Now"
        confirmStyle="destructive"
        onConfirm={async () => {
          await clearEverything();
          setSessionClearedNotice(true);
        }}
        onClose={() => setClearDataConfirmVisible(false)}
      />

      <NoticeDialogModal
        visible={sessionClearedNotice}
        title="Session Cleared"
        message="All browsing data and sessions wiped."
        onClose={() => setSessionClearedNotice(false)}
      />

      <ActionSheetModal
        visible={searchEngineModalVisible}
        title="Search Engine"
        message={`Currently searching with ${searchEngine}. Choose your search engine:`}
        cancelText="Cancel"
        onClose={() => setSearchEngineModalVisible(false)}
        options={[
          {
            text: searchEngine === 'Google' ? 'Google  ✓' : 'Google',
            renderIcon: () => <SearchEngineIcon engine="Google" size={24} />,
            onPress: () => setSearchEngine('Google'),
          },
          {
            text: searchEngine === 'DuckDuckGo' ? 'DuckDuckGo  ✓' : 'DuckDuckGo',
            renderIcon: () => <SearchEngineIcon engine="DuckDuckGo" size={24} />,
            onPress: () => setSearchEngine('DuckDuckGo'),
          },
          {
            text: searchEngine === 'Brave' ? 'Brave  ✓' : 'Brave',
            renderIcon: () => <SearchEngineIcon engine="Brave" size={24} />,
            onPress: () => setSearchEngine('Brave'),
          },
          {
            text: searchEngine === 'Bing' ? 'Microsoft Bing  ✓' : 'Microsoft Bing',
            renderIcon: () => <SearchEngineIcon engine="Bing" size={24} />,
            onPress: () => setSearchEngine('Bing'),
          },
          {
            text: searchEngine === 'Ecosia' ? 'Ecosia  ✓' : 'Ecosia',
            renderIcon: () => <SearchEngineIcon engine="Ecosia" size={24} />,
            onPress: () => setSearchEngine('Ecosia'),
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  topBar: {
    paddingTop: 62,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: F.b,
    fontSize: 34,
    lineHeight: 44,
    letterSpacing: 0.3,
    marginTop: 6,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  hd: {
    marginHorizontal: 32,
    marginBottom: 6,
    fontSize: 13,
    color: C.sec,
    fontFamily: F.m,
  },
  grp: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.sep,
  },
  label: {
    fontFamily: F.r,
    fontSize: 17,
  },
  val: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sw: {
    marginLeft: 'auto',
    width: 51,
    height: 31,
    borderRadius: 16,
  },
  knob: {
    position: 'absolute',
    top: 2,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
});
