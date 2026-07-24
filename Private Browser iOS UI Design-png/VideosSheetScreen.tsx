/**
 * VideosSheetScreen.tsx
 * "Videos on this page" bottom sheet over the browser page.
 * Imports shared tokens/helpers from ./BrowserScreen.
 */
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Article, BottomBar, C, F, Ic, Play, T, useHanken } from './BrowserScreen';

type Item = { id: string; title: string; meta: string; protectedStream?: boolean };
const SOURCE = 'northfield.example/cinemas';
const ITEMS: Item[] = [
  { id: '1', title: 'Opening night, restored print', meta: 'MP4 · 1080p · 148 MB' },
  { id: '2', title: 'Director’s commentary', meta: 'HLS · 4 qualities · 720p selected' },
  { id: '3', title: 'Trailer stream', meta: 'DRM protected', protectedStream: true },
];

function VideoRow({ item, first }: { item: Item; first: boolean }) {
  return (
    <View style={[s.row, !first && s.rowBorder]}>
      <View style={s.thumb}>{item.protectedStream ? <Ic n="lock" c="#fff" s={18} /> : <Play />}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T numberOfLines={1} style={{ fontSize: 15, fontFamily: F.s }}>{item.title}</T>
        <T style={s.sub}>{item.meta}</T>
      </View>
      {item.protectedStream ? (
        <T style={{ color: C.sec, fontSize: 14, fontFamily: F.s }}>Unavailable</T>
      ) : (
        <Pressable style={s.get} onPress={() => {}}>
          <T style={{ color: C.blue, fontSize: 14, fontFamily: F.b }}>Download</T>
        </Pressable>
      )}
    </View>
  );
}

export default function VideosSheetScreen() {
  const ok = useHanken();
  if (!ok) return null;
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="dark" />
      <Article />
      <BottomBar />
      <View style={s.dim} />
      <View style={s.sheet}>
        <View style={s.grabber} />
        <View style={s.head}>
          <View style={{ width: 50 }} />
          <T style={{ fontFamily: F.s }}>Videos on this page</T>
          <Pressable style={{ width: 50, alignItems: 'flex-end' }}>
            <T style={{ color: C.blue, fontFamily: F.s }}>Done</T>
          </Pressable>
        </View>
        <T style={[s.sub, { textAlign: 'center', marginBottom: 14 }]}>{SOURCE}</T>
        <View style={s.grp}>
          {ITEMS.map((it, i) => <VideoRow key={it.id} item={it} first={i === 0} />)}
        </View>
        <T style={[s.sub, { marginTop: -8, marginHorizontal: 32 }]}>
          Each download keeps this page’s address, so you can come back to the source later.
        </T>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 566, backgroundColor: C.grouped, borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingTop: 8 },
  grabber: { width: 36, height: 5, borderRadius: 3, backgroundColor: C.gray, alignSelf: 'center', marginBottom: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 36 },
  sub: { fontSize: 13, color: C.sec },
  grp: { marginHorizontal: 16, marginBottom: 20, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, paddingHorizontal: 12 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.sep },
  thumb: { width: 88, height: 50, borderRadius: 6, backgroundColor: C.thumb, alignItems: 'center', justifyContent: 'center' },
  get: { backgroundColor: 'rgba(0,113,227,0.12)', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 14 },
});
