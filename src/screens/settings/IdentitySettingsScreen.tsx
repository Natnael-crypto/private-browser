import React, { useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { F, Ic, T, useTheme } from '../../theme/tokens';
import { useBrowserStore } from '../../browser/browserStore';
import { ActionSheetModal } from '../../components/AppModal';

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

export default function IdentitySettingsScreen({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const {
    uaPreset,
    setUaPreset,
    customUa,
    setCustomUa,
    spoofLanguage,
    setSpoofLanguage,
    spoofTimezone,
    setSpoofTimezone,
    roundScreen,
    setRoundScreen,
    reduceFingerprinting,
    setReduceFingerprinting,
  } = useBrowserStore();

  const [uaModalVisible, setUaModalVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [tzModalVisible, setTzModalVisible] = useState(false);

  const rowBorder = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.sep };

  const UA_LABELS: Record<string, string> = {
    default: 'Default (System WebView)',
    safari_ios: 'Safari (iOS 18 iPhone)',
    safari_mac: 'Safari (macOS Sonoma)',
    chrome_win: 'Google Chrome (Windows 11)',
    firefox_linux: 'Mozilla Firefox (Linux)',
    chrome_android: 'Google Chrome (Android 14)',
    custom: 'Custom User-Agent...',
  };

  const LANG_LABELS: Record<string, string> = {
    system: 'Default (System Language)',
    'en-US': 'English (United States)',
    'en-GB': 'English (United Kingdom)',
    'fr-FR': 'French (France)',
    'de-DE': 'German (Germany)',
    'es-ES': 'Spanish (Spain)',
  };

  const TZ_LABELS: Record<string, string> = {
    system: 'Default (System Timezone)',
    UTC: 'UTC (Coordinated Universal Time)',
    'America/New_York': 'America/New York (EST/EDT)',
    'Europe/London': 'Europe/London (GMT/BST)',
    'Asia/Tokyo': 'Asia/Tokyo (JST)',
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.grouped }}>
      <StatusBar style={theme.statusBar} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Top Navigation */}
        <View style={s.topBar}>
          <Pressable onPress={onBack} hitSlop={10} style={s.backBtn}>
            <Ic n="back" c={theme.blue} s={22} />
            <T style={{ color: theme.blue, fontFamily: F.m, fontSize: 17, marginLeft: 4 }}>Settings</T>
          </Pressable>
          <View style={{ width: 40 }} />
        </View>

        <T style={[s.title, { color: theme.text }]}>Identity & Fingerprint</T>

        {/* User Agent Section */}
        <T style={[s.hd, { color: theme.sec }]}>USER AGENT & CLIENT HINTS (IDN-1 to IDN-5)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <Pressable style={s.row} onPress={() => setUaModalVisible(true)}>
            <T style={[s.label, { color: theme.text }]}>Browser Identity</T>
            <View style={s.val}>
              <T numberOfLines={1} style={{ color: theme.sec, fontFamily: F.r, maxWidth: 170 }}>
                {UA_LABELS[uaPreset] || uaPreset}
              </T>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>

          {uaPreset === 'custom' && (
            <View style={[s.customUaRow, rowBorder]}>
              <T style={[s.inputLabel, { color: theme.sec }]}>Custom UA String</T>
              <TextInput
                style={[s.textInput, { backgroundColor: theme.inputBg, color: theme.text }]}
                value={customUa}
                onChangeText={setCustomUa}
                placeholder="Mozilla/5.0..."
                placeholderTextColor={theme.sec}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          When spoofing browser identity, Client Hints (navigator.userAgentData) are automatically aligned to match the spoofed platform.
        </T>

        {/* Localization & Environment */}
        <T style={[s.hd, { color: theme.sec }]}>LOCALIZATION & ENVIRONMENT (IDN-6 to IDN-8)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <Pressable style={s.row} onPress={() => setLangModalVisible(true)}>
            <T style={[s.label, { color: theme.text }]}>Spoofed Language</T>
            <View style={s.val}>
              <T style={{ color: theme.sec, fontFamily: F.r }}>
                {LANG_LABELS[spoofLanguage] || spoofLanguage}
              </T>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>

          <Pressable style={[s.row, rowBorder]} onPress={() => setTzModalVisible(true)}>
            <T style={[s.label, { color: theme.text }]}>Spoofed Timezone</T>
            <View style={s.val}>
              <T style={{ color: theme.sec, fontFamily: F.r }}>
                {TZ_LABELS[spoofTimezone] || spoofTimezone}
              </T>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>

          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Round Screen Resolution</T>
            <Toggle
              label="Round screen resolution"
              on={roundScreen}
              onPress={() => setRoundScreen(!roundScreen)}
            />
          </View>
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          Rounds screen.width/height to common 100px boundaries (IDN-8) so sites cannot uniquely track your device display dimensions.
        </T>

        {/* Fingerprint Hardening */}
        <T style={[s.hd, { color: theme.sec }]}>FINGERPRINT SHIELDS (FPH-1 to FPH-3)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <T style={[s.label, { color: theme.text }]}>Fingerprint Hardening</T>
            <Toggle
              label="Fingerprint hardening"
              on={reduceFingerprinting}
              onPress={() => setReduceFingerprinting(!reduceFingerprinting)}
            />
          </View>
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          • Injects imperceptible random noise into HTML5 Canvas and AudioContext outputs to disrupt mathematical hash tracking.{'\n'}
          • Normalizes hardware concurrency to 4 cores and RAM to 8 GB.{'\n'}
          • Disables Battery Status API and Ambient Sensors.{'\n'}
          • Neutralizes media devices enumeration to protect against audio/video device fingerprinting.
        </T>
      </ScrollView>

      {/* UA Selection Modal */}
      <ActionSheetModal
        visible={uaModalVisible}
        title="Select Browser Identity"
        message="Websites will see your browser and device as this profile:"
        cancelText="Cancel"
        onClose={() => setUaModalVisible(false)}
        options={[
          {
            text: uaPreset === 'default' ? 'Default (System WebView) ✓' : 'Default (System WebView)',
            onPress: () => setUaPreset('default'),
          },
          {
            text: uaPreset === 'safari_ios' ? 'Safari (iOS 18 iPhone) ✓' : 'Safari (iOS 18 iPhone)',
            onPress: () => setUaPreset('safari_ios'),
          },
          {
            text: uaPreset === 'safari_mac' ? 'Safari (macOS Sonoma) ✓' : 'Safari (macOS Sonoma)',
            onPress: () => setUaPreset('safari_mac'),
          },
          {
            text: uaPreset === 'chrome_win' ? 'Google Chrome (Windows 11) ✓' : 'Google Chrome (Windows 11)',
            onPress: () => setUaPreset('chrome_win'),
          },
          {
            text: uaPreset === 'firefox_linux' ? 'Mozilla Firefox (Linux) ✓' : 'Mozilla Firefox (Linux)',
            onPress: () => setUaPreset('firefox_linux'),
          },
          {
            text: uaPreset === 'chrome_android' ? 'Google Chrome (Android 14) ✓' : 'Google Chrome (Android 14)',
            onPress: () => setUaPreset('chrome_android'),
          },
          {
            text: uaPreset === 'custom' ? 'Custom User-Agent... ✓' : 'Custom User-Agent...',
            onPress: () => setUaPreset('custom'),
          },
        ]}
      />

      {/* Language Selection Modal */}
      <ActionSheetModal
        visible={langModalVisible}
        title="Spoofed Language (IDN-6)"
        message="Override navigator.language exposed to web pages:"
        cancelText="Cancel"
        onClose={() => setLangModalVisible(false)}
        options={[
          {
            text: spoofLanguage === 'system' ? 'System Default ✓' : 'System Default',
            onPress: () => setSpoofLanguage('system'),
          },
          {
            text: spoofLanguage === 'en-US' ? 'English (United States) [en-US] ✓' : 'English (United States) [en-US]',
            onPress: () => setSpoofLanguage('en-US'),
          },
          {
            text: spoofLanguage === 'en-GB' ? 'English (United Kingdom) [en-GB] ✓' : 'English (United Kingdom) [en-GB]',
            onPress: () => setSpoofLanguage('en-GB'),
          },
          {
            text: spoofLanguage === 'fr-FR' ? 'French [fr-FR] ✓' : 'French [fr-FR]',
            onPress: () => setSpoofLanguage('fr-FR'),
          },
          {
            text: spoofLanguage === 'de-DE' ? 'German [de-DE] ✓' : 'German [de-DE]',
            onPress: () => setSpoofLanguage('de-DE'),
          },
          {
            text: spoofLanguage === 'es-ES' ? 'Spanish [es-ES] ✓' : 'Spanish [es-ES]',
            onPress: () => setSpoofLanguage('es-ES'),
          },
        ]}
      />

      {/* Timezone Selection Modal */}
      <ActionSheetModal
        visible={tzModalVisible}
        title="Spoofed Timezone (IDN-7)"
        message="Override Intl.DateTimeFormat timezone for web scripts:"
        cancelText="Cancel"
        onClose={() => setTzModalVisible(false)}
        options={[
          {
            text: spoofTimezone === 'system' ? 'System Default ✓' : 'System Default',
            onPress: () => setSpoofTimezone('system'),
          },
          {
            text: spoofTimezone === 'UTC' ? 'UTC (Coordinated Universal Time) ✓' : 'UTC (Coordinated Universal Time)',
            onPress: () => setSpoofTimezone('UTC'),
          },
          {
            text: spoofTimezone === 'America/New_York' ? 'America/New York (EST/EDT) ✓' : 'America/New York (EST/EDT)',
            onPress: () => setSpoofTimezone('America/New_York'),
          },
          {
            text: spoofTimezone === 'Europe/London' ? 'Europe/London (GMT/BST) ✓' : 'Europe/London (GMT/BST)',
            onPress: () => setSpoofTimezone('Europe/London'),
          },
          {
            text: spoofTimezone === 'Asia/Tokyo' ? 'Asia/Tokyo (JST) ✓' : 'Asia/Tokyo (JST)',
            onPress: () => setSpoofTimezone('Asia/Tokyo'),
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
  backBtn: {
    flexDirection: 'row',
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
    fontSize: 12,
    fontFamily: F.s,
    letterSpacing: 0.5,
  },
  footerNote: {
    marginHorizontal: 32,
    marginTop: -14,
    marginBottom: 20,
    fontSize: 12,
    fontFamily: F.r,
    lineHeight: 18,
  },
  grp: {
    marginHorizontal: 16,
    marginBottom: 20,
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
  customUaRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: F.m,
    marginBottom: 4,
  },
  textInput: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: F.r,
  },
});
