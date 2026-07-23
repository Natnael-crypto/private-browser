/**
 * TabsScreen.tsx
 * Tab switcher (dark, like Safari private browsing). Imports shared helpers from ./BrowserScreen.
 */
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C, F, Ic, T, useHanken } from './BrowserScreen';

const TABS = [
  { id: 'a', title: 'northfield', block: 80 },
  { id: 'b', title: 'New tab', block: 30 },
  { id: 'c', title: 'maps.example', block: 110 },
  { id: 'd', title: 'docs.example', block: 60 },
];

export default function TabsScreen() {
  const ok = useHanken();
  if (!ok) return null;
  return (
    <View style={{ flex: 1, backgroundColor: '#1c1c1e' }}>
      <StatusBar style="light" />
      <View style={s.grid}>
        {TABS.map((t) => (
          <View key={t.id} style={s.card}>
            <View style={s.cardHead}>
              <T style={{ fontSize: 12, fontFamily: F.s }}>{t.title}</T>
              <T style={{ fontSize: 12, color: C.sec }}>×</T>
            </View>
            <View style={{ padding: 10 }}>
              <View style={[s.line, { width: '90%', marginBottom: 6 }]} />
              <View style={[s.line, { width: '60%', marginBottom: 12 }]} />
              <View style={{ height: t.block, backgroundColor: C.video, borderRadius: 6 }} />
            </View>
          </View>
        ))}
      </View>
      <View style={s.bottom}>
        <Pressable accessibilityLabel="New tab" style={s.hit}><Ic n="plus" c="#fff" s={26} /></Pressable>
        <View style={s.hit}><T style={{ color: '#fff', fontSize: 15, fontFamily: F.s }}>{TABS.length} Tabs</T></View>
        <Pressable style={s.hit}><T style={{ color: '#fff', fontFamily: F.s }}>Done</T></Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  grid: { paddingTop: 70, paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  card: { width: 167, height: 236, borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden' },
  cardHead: { height: 34, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.grouped },
  line: { height: 11, backgroundColor: '#d1d1d6', borderRadius: 3 },
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, paddingTop: 10, paddingHorizontal: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: 'rgba(44,44,46,0.96)',
  },
  hit: { height: 44, justifyContent: 'center' },
});
