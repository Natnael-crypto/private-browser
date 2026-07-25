import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { F, Ic, T, useTheme } from '../../theme/tokens';
import { useBrowserStore } from '../../browser/browserStore';

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

export default function ContentSettingsScreen({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const {
    globalJs,
    setGlobalJs,
    blockThirdPartyScripts,
    setBlockThirdPartyScripts,
    blockAutoplay,
    setBlockAutoplay,
    blockLocalNetwork,
    setBlockLocalNetwork,
    imagesEnabled,
    setImagesEnabled,
    blockWebFonts,
    setBlockWebFonts,
    blockServiceWorkers,
    setBlockServiceWorkers,
    blockBeacons,
    setBlockBeacons,
  } = useBrowserStore();

  const rowBorder = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.sep };

  return (
    <View style={{ flex: 1, backgroundColor: theme.grouped }}>
      <StatusBar style={theme.statusBar} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
        <View style={s.topBar}>
          <Pressable onPress={onBack} hitSlop={10} style={s.backBtn}>
            <Ic n="back" c={theme.blue} s={22} />
            <T style={{ color: theme.blue, fontFamily: F.m, fontSize: 17, marginLeft: 4 }}>Settings</T>
          </Pressable>
          <View style={{ width: 40 }} />
        </View>

        <T style={[s.title, { color: theme.text }]}>Content & Scripts</T>

        {/* JavaScript & Script Controls */}
        <T style={[s.hd, { color: theme.sec }]}>JAVASCRIPT CONTROLS (SCR-1, SCR-2)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <T style={[s.label, { color: theme.text }]}>Enable JavaScript</T>
            <Toggle
              label="Enable JavaScript"
              on={globalJs}
              onPress={() => setGlobalJs(!globalJs)}
            />
          </View>
          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Block 3rd-Party Scripts</T>
            <Toggle
              label="Block third-party scripts"
              on={blockThirdPartyScripts}
              onPress={() => setBlockThirdPartyScripts(!blockThirdPartyScripts)}
            />
          </View>
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          Blocking 3rd-party scripts restricts execution only to scripts hosted on the primary domain, shutting down external analytics and trackers.
        </T>

        {/* Media & Autoplay Controls */}
        <T style={[s.hd, { color: theme.sec }]}>MEDIA & NETWORK (SCR-3, SCR-4)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <T style={[s.label, { color: theme.text }]}>Block Media Autoplay</T>
            <Toggle
              label="Block autoplay media"
              on={blockAutoplay}
              onPress={() => setBlockAutoplay(!blockAutoplay)}
            />
          </View>
          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Block Local Network Access</T>
            <Toggle
              label="Block local network access"
              on={blockLocalNetwork}
              onPress={() => setBlockLocalNetwork(!blockLocalNetwork)}
            />
          </View>
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          Blocks pages from scanning or contacting LAN addresses (127.0.0.1, 192.168.x.x, 10.x.x.x) to stop router probing and local fingerprinting.
        </T>

        {/* Bandwidth & Assets Controls */}
        <T style={[s.hd, { color: theme.sec }]}>ASSETS & BANDWIDTH (SCR-5, SCR-6)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <T style={[s.label, { color: theme.text }]}>Load Images</T>
            <Toggle
              label="Load images"
              on={imagesEnabled}
              onPress={() => setImagesEnabled(!imagesEnabled)}
            />
          </View>
          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Block Remote Web Fonts</T>
            <Toggle
              label="Block remote web fonts"
              on={blockWebFonts}
              onPress={() => setBlockWebFonts(!blockWebFonts)}
            />
          </View>
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          Disabling remote fonts prevents font probing attacks used to uniquely fingerprint your device.
        </T>

        {/* Background Execution & Beacons */}
        <T style={[s.hd, { color: theme.sec }]}>BACKGROUND WORKERS & BEACONS (SCR-7, SCR-9)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <T style={[s.label, { color: theme.text }]}>Block Service Workers</T>
            <Toggle
              label="Block service workers"
              on={blockServiceWorkers}
              onPress={() => setBlockServiceWorkers(!blockServiceWorkers)}
            />
          </View>
          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Block Ping & Beacon API</T>
            <Toggle
              label="Block ping and beacon API"
              on={blockBeacons}
              onPress={() => setBlockBeacons(!blockBeacons)}
            />
          </View>
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          Stops invisible background workers and link tracking pings from transmitting telemetry when leaving pages.
        </T>
      </ScrollView>
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
});
