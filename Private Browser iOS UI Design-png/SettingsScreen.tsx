/**
 * SettingsScreen.tsx
 * Grouped settings list with working demo toggles. Imports shared helpers from ./BrowserScreen.
 */
import React, { useState } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C, F, Ic, T, useHanken } from './BrowserScreen';

type Row = { key: string; label: string; toggle?: boolean; value?: string };
type Section = { title: string; rows: Row[] };
const SECTIONS: Section[] = [
  { title: 'Privacy', rows: [
    { key: 'ads', label: 'Block ads and trackers', toggle: true },
    { key: 'cookies', label: 'Block third-party cookies', toggle: true },
    { key: 'https', label: 'HTTPS-only mode', toggle: true },
    { key: 'gpc', label: 'Send Global Privacy Control', toggle: true },
  ]},
  { title: 'Lock', rows: [
    { key: 'pw', label: 'Password', value: 'Change' },
    { key: 'fp', label: 'Unlock with fingerprint', toggle: true },
    { key: 'auto', label: 'Auto-lock', value: 'Immediately' },
  ]},
  { title: 'Downloads', rows: [
    { key: 'wifi', label: 'Wi-Fi only', toggle: false },
    { key: 'strip', label: 'Remove details after download', toggle: false },
    { key: 'dest', label: 'Save to', value: 'Downloads' },
  ]},
];

function Toggle({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label}
      style={[s.sw, { backgroundColor: on ? C.green : C.off }]}>
      <View style={[s.knob, on ? { right: 2 } : { left: 2 }]} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const ok = useHanken();
  const [state, setState] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    SECTIONS.forEach((sec) => sec.rows.forEach((r) => { if (r.toggle !== undefined) init[r.key] = r.toggle; }));
    return init;
  });
  if (!ok) return null;
  return (
    <View style={{ flex: 1, backgroundColor: C.grouped }}>
      <StatusBar style="dark" />
      <T style={s.title}>Settings</T>
      {SECTIONS.map((sec) => (
        <View key={sec.title}>
          <T style={s.hd}>{sec.title}</T>
          <View style={s.grp}>
            {sec.rows.map((r, i) => (
              <View key={r.key} style={[s.row, i > 0 && s.rowBorder]}>
                <T>{r.label}</T>
                {r.toggle !== undefined ? (
                  <Toggle label={r.label} on={state[r.key]} onPress={() => setState((p) => ({ ...p, [r.key]: !p[r.key] }))} />
                ) : (
                  <View style={s.val}>
                    <T style={{ color: C.sec }}>{r.value}</T>
                    <Ic n="ch" c={C.gray} s={16} w={2.4} />
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      ))}
      <View style={s.grp}>
        <Pressable style={[s.row, { justifyContent: 'center' }]}><T style={{ color: C.red }}>Clear all data now</T></Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: F.b, fontSize: 34, lineHeight: 44, letterSpacing: 0.3, marginTop: 62, marginHorizontal: 16, marginBottom: 14 },
  hd: { marginHorizontal: 32, marginBottom: 6, fontSize: 13, color: C.sec },
  grp: { marginHorizontal: 16, marginBottom: 20, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, paddingHorizontal: 16 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.sep },
  val: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 2 },
  sw: { marginLeft: 'auto', width: 51, height: 31, borderRadius: 16 },
  knob: {
    position: 'absolute', top: 2, width: 27, height: 27, borderRadius: 14, backgroundColor: '#fff',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
    }),
  },
});
