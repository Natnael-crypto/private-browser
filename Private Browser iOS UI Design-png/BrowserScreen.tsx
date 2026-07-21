/**
 * BrowserScreen.tsx
 * Main browsing screen. Also exports the shared tokens and helpers (C, F, T, Ic, Play,
 * Article, BottomBar, useHanken) that the other five screens import from this file.
 *
 * Install:  npx expo install react-native-svg expo-status-bar expo-font
 *           npm i @expo-google-fonts/hanken-grotesk
 * All six files go in the same folder. Demo data is hard-coded in each screen.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, TextProps, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  useFonts,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';

/* ---------- tokens ---------- */
export const C = {
  blue: '#0071e3',
  sec: '#6c6c70',
  gray: '#c7c7cc',
  sep: 'rgba(60,60,67,0.18)',
  fill: 'rgba(118,118,128,0.12)',
  grouped: '#f2f2f7',
  thumb: '#2b3138',
  video: '#1d242b',
  body: '#3a3a3c',
  red: '#d70015',
  green: '#2fb457',
  off: 'rgba(120,120,128,0.32)',
};
export const F = {
  r: 'HankenGrotesk_400Regular',
  m: 'HankenGrotesk_500Medium',
  s: 'HankenGrotesk_600SemiBold',
  b: 'HankenGrotesk_700Bold',
};
export function useHanken() {
  const [ok] = useFonts({ HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold });
  return ok;
}
export const T = (p: TextProps) => <Text {...p} style={[base.text, p.style]} />;

/* ---------- icons (same paths as the design) ---------- */
const PATHS: Record<string, string[]> = {
  back: ['M15 5l-7 7 7 7'],
  fwd: ['M9 5l7 7-7 7'],
  share: ['M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1'],
  book: ['M3 5.5C6 4 9 4 12 6c3-2 6-2 9-.5V19c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5zM12 6v13.5'],
  rl: ['M20 12a8 8 0 11-2.4-5.7M20 4v4h-4'],
  dl: ['M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14'],
  sh: ['M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z'],
  plus: ['M12 5v14M5 12h14'],
  ch: ['M9 6l6 6-6 6'],
  pause: ['M9 6v12M15 6v12'],
  fp: [
    'M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4',
    'M14 13.12c0 2.38 0 6.38-1 8.88',
    'M17.29 21.02c.12-.6.43-2.3.5-3.02',
    'M2 12a10 10 0 0 1 18-6',
    'M21.8 16c.2-2 .131-5.354 0-6',
    'M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2',
    'M8.65 22c.21-.66.45-1.32.57-2',
    'M9 6.8a6 6 0 0 1 9 5.2v2',
  ],
};
type IcProps = { n: string; c?: string; s?: number; w?: number };
export const Ic = ({ n, c = C.blue, s = 24, w = 1.8 }: IcProps) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    {n === 'lock' && (
      <>
        <Rect x="5" y="11" width="14" height="9" rx="2" />
        <Path d="M8 11V8a4 4 0 018 0v3" />
      </>
    )}
    {n === 'tabs' && (
      <>
        <Rect x="4" y="8" width="12" height="12" rx="2" />
        <Path d="M8 8V6a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2h-2" />
      </>
    )}
    {PATHS[n]?.map((d) => <Path key={d} d={d} />)}
  </Svg>
);
export const Play = ({ s = 16 }: { s?: number }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="#fff">
    <Path d="M7 4.5v15l13-7.5z" />
  </Svg>
);

/* ---------- demo data ---------- */
const PAGE = {
  site: 'northfield',
  section: 'Film',
  title: 'Inside the quiet revival of small-town cinemas',
  byline: 'Film desk · 6 min read',
  host: 'northfield.example',
  blocked: 14,
  videosFound: 2,
  text:
    'On weeknights the lobby fills early. Volunteers sell tickets from a folding table, and the projectionist still threads the reel by hand.',
};

/* ---------- shared pieces ---------- */
export function Article() {
  return (
    <View style={s.article}>
      <View style={s.siteRow}>
        <T style={{ fontFamily: F.b, fontSize: 15 }}>{PAGE.site}</T>
        <T style={{ fontFamily: F.m, fontSize: 15, color: C.sec }}>{PAGE.section}</T>
      </View>
      <T style={s.h1}>{PAGE.title}</T>
      <T style={s.sub}>{PAGE.byline}</T>
      <View style={s.video}>
        <View style={s.playDisc}>
          <Play s={22} />
        </View>
      </View>
      <T style={s.para}>{PAGE.text}</T>
    </View>
  );
}

export function BottomBar({ host = PAGE.host, blocked = PAGE.blocked }: { host?: string; blocked?: number }) {
  return (
    <View style={s.bar}>
      <View style={s.cap}>
        <Pressable accessibilityLabel={`Blocker: ${blocked} blocked`} style={s.capLeft}>
          <Ic n="sh" c={C.sec} s={18} />
          <T style={{ fontSize: 14, color: C.sec, fontFamily: F.m }}>{blocked}</T>
        </Pressable>
        <View style={s.capCenter}>
          <Ic n="lock" c="#000" s={13} w={2.2} />
          <T style={{ fontSize: 16, fontFamily: F.m }}>{host}</T>
        </View>
        <Pressable accessibilityLabel="Reload">
          <Ic n="rl" c="#000" s={18} />
        </Pressable>
      </View>
      <View style={s.tb}>
        <Pressable accessibilityLabel="Back"><Ic n="back" s={26} /></Pressable>
        <Pressable accessibilityLabel="Forward" disabled><Ic n="fwd" c={C.gray} s={26} /></Pressable>
        <Pressable accessibilityLabel="Share"><Ic n="share" /></Pressable>
        <Pressable accessibilityLabel="Bookmarks"><Ic n="book" /></Pressable>
        <Pressable accessibilityLabel="Tabs"><Ic n="tabs" /></Pressable>
      </View>
    </View>
  );
}

/* ---------- screen ---------- */
export default function BrowserScreen() {
  const ok = useHanken();
  if (!ok) return null;
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="dark" />
      <Article />
      <View style={s.pillWrap} pointerEvents="box-none">
        <Pressable style={s.pill} onPress={() => {}}>
          <Ic n="dl" c="#fff" s={18} w={2.2} />
          <T style={{ color: '#fff', fontSize: 15, fontFamily: F.s }}>{PAGE.videosFound} videos found</T>
        </Pressable>
      </View>
      <BottomBar />
    </View>
  );
}

const base = StyleSheet.create({ text: { fontFamily: F.r, fontSize: 17, lineHeight: 22, color: '#000' } });
const s = StyleSheet.create({
  article: { paddingTop: 62, paddingHorizontal: 16 },
  siteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  h1: { fontFamily: F.b, fontSize: 29, lineHeight: 33, letterSpacing: -0.4, marginBottom: 8 },
  sub: { fontSize: 13, color: C.sec, marginBottom: 16 },
  video: { height: 201, borderRadius: 10, backgroundColor: C.video, alignItems: 'center', justifyContent: 'center' },
  playDisc: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  para: { color: C.body, fontSize: 16, lineHeight: 23, marginTop: 16 },
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingTop: 8, paddingHorizontal: 12, paddingBottom: 30,
    backgroundColor: 'rgba(247,247,249,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.22)',
  },
  cap: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.fill },
  capLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  capCenter: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  tb: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 44, paddingHorizontal: 14, marginTop: 2 },
  pillWrap: { position: 'absolute', left: 0, right: 0, bottom: 152, flexDirection: 'row', justifyContent: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.blue,
    borderRadius: 20, paddingVertical: 9, paddingHorizontal: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
});
