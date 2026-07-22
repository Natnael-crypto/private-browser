/**
 * DownloadsScreen.tsx
 * Private video library: in-progress, saved items with a link to the source page,
 * and a button to remove video details. Imports shared helpers from ./BrowserScreen.
 */
import React from 'react';
import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C, F, Ic, Play, T, useHanken } from './BrowserScreen';

const ACTIVE = { id: 'x1', label: 'Downloading video', progress: 0.62, status: '92 of 148 MB' };
const SAVED = [
  { id: 's1', title: 'Director’s commentary', meta: '720p · 96 MB · Today', source: 'northfield.example' },
  { id: 's2', title: 'Lecture 4, full recording', meta: '1080p · 412 MB · Yesterday', source: 'docs.example' },
];

export default function DownloadsScreen() {
  const ok = useHanken();
  if (!ok) return null;
  return (
    <View style={{ flex: 1, backgroundColor: C.grouped }}>
      <StatusBar style="dark" />
      <ScrollView scrollEnabled={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={s.top}>
          <View style={{ width: 40 }} />
          <Pressable><T style={{ color: C.blue, fontFamily: F.s }}>Done</T></Pressable>
        </View>
        <T style={s.title}>Downloads</T>
        <View style={s.search}><T style={{ color: C.sec, fontSize: 16, fontFamily: F.r }}>Search videos</T></View>

        <T style={s.hd}>In progress</T>
        <View style={s.grp}>
          <View style={s.row}>
            <View style={s.thumb}><Play /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={{ fontSize: 15, fontFamily: F.s }}>{ACTIVE.label}</T>
              <View style={s.track}><View style={[s.fillBar, { width: `${ACTIVE.progress * 100}%` }]} /></View>
              <T style={s.sub}>{ACTIVE.status}</T>
            </View>
            <Pressable accessibilityLabel="Pause"><Ic n="pause" s={22} /></Pressable>
          </View>
        </View>

        <T style={s.hd}>Saved</T>
        <View style={s.grp}>
          {SAVED.map((v, i) => (
            <View key={v.id} style={[s.row, i > 0 && s.rowBorder]}>
              <View style={s.thumb}><Play /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T numberOfLines={1} style={{ fontSize: 15, fontFamily: F.s }}>{v.title}</T>
                <T style={s.sub}>{v.meta}</T>
                <Pressable style={s.link} accessibilityLabel={`Open source page ${v.source}`}>
                  <T style={{ fontSize: 13, color: C.blue }}>{v.source}</T>
                  <Ic n="ch" s={14} w={2.4} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        <View style={s.grp}>
          <Pressable style={s.danger}><T style={{ color: C.red }}>Remove video details…</T></Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  top: { paddingTop: 62, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontFamily: F.b, fontSize: 34, lineHeight: 44, letterSpacing: 0.3, marginTop: 6, marginHorizontal: 16, marginBottom: 12 },
  search: { height: 44, marginHorizontal: 16, marginBottom: 20, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.fill, justifyContent: 'center' },
  hd: { marginHorizontal: 32, marginBottom: 6, fontSize: 13, color: C.sec },
  grp: { marginHorizontal: 16, marginBottom: 20, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, paddingHorizontal: 12 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.sep },
  thumb: { width: 88, height: 50, borderRadius: 6, backgroundColor: C.thumb, alignItems: 'center', justifyContent: 'center' },
  sub: { fontSize: 13, color: C.sec },
  track: { height: 4, borderRadius: 2, backgroundColor: '#e5e5ea', marginTop: 7, marginBottom: 5 },
  fillBar: { height: 4, borderRadius: 2, backgroundColor: C.blue },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  danger: { minHeight: 46, alignItems: 'center', justifyContent: 'center' },
});
