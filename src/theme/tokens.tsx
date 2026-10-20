import React from 'react';
import { Text, TextProps, useColorScheme } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  useFonts,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { useBrowserStore } from '../browser/browserStore';

/* ---------- Apple Theme Specification & Palettes ---------- */
export interface AppleTheme {
  isDark: boolean;
  bg: string;
  grouped: string;
  card: string;
  cardElevated: string;
  cardBorder: string;
  text: string;
  sec: string;
  tertiary: string;
  blue: string;
  green: string;
  red: string;
  sep: string;
  fill: string;
  fillSecondary: string;
  inputBg: string;
  swOff: string;
  knob: string;
  statusBar: 'light' | 'dark';
}

export const darkTheme: AppleTheme = {
  isDark: true,
  bg: '#000000',           // Pure Apple OLED Black
  grouped: '#000000',      // Apple iOS Grouped Background (Dark)
  card: '#1c1c1e',         // Apple Secondary System Background / Grouped Card
  cardElevated: '#2c2c2e', // Apple Tertiary System Background / Search & Input bar
  cardBorder: '#2c2c2e',   // Hairline elevated border
  text: '#ffffff',         // Apple Primary Label
  sec: '#8e8e93',          // Apple Secondary Label (contrast > 5.5:1 against #1c1c1e)
  tertiary: '#636366',     // Apple Tertiary Label
  blue: '#0a84ff',         // Apple Dark Mode System Blue (Vibrant)
  green: '#30d158',        // Apple Dark Mode System Green
  red: '#ff453a',          // Apple Dark Mode System Red
  sep: '#38383a',          // Apple Dark Mode Separator
  fill: 'rgba(120,120,128,0.32)', // Apple System Fill
  fillSecondary: 'rgba(120,120,128,0.20)',
  inputBg: '#2c2c2e',      // Apple Dark Mode Input Fill
  swOff: '#39393d',        // Apple Dark Mode Switch Track Off
  knob: '#ffffff',
  statusBar: 'light',
};

export const lightTheme: AppleTheme = {
  isDark: false,
  bg: '#ffffff',
  grouped: '#f2f2f7',
  card: '#ffffff',
  cardElevated: '#ffffff',
  cardBorder: 'rgba(60,60,67,0.12)',
  text: '#000000',
  sec: '#6c6c70',
  tertiary: '#8e8e93',
  blue: '#0071e3',
  green: '#2fb457',
  red: '#d70015',
  sep: 'rgba(60,60,67,0.18)',
  fill: 'rgba(118,118,128,0.12)',
  fillSecondary: 'rgba(118,118,128,0.08)',
  inputBg: 'rgba(118,118,128,0.12)',
  swOff: 'rgba(120,120,128,0.32)',
  knob: '#ffffff',
  statusBar: 'dark',
};

export function useTheme(): AppleTheme {
  const themeMode = useBrowserStore((s) => s.themeMode);
  const colorScheme = useColorScheme();
  const isDark = themeMode === 'system' ? colorScheme === 'dark' : themeMode === 'dark';
  return isDark ? darkTheme : lightTheme;
}

/* ---------- Color Tokens (Backwards compatibility defaults) ---------- */
export const C = {
  blue: '#0a84ff',
  sec: '#8e8e93',
  gray: '#636366',
  sep: '#38383a',
  fill: 'rgba(120,120,128,0.32)',
  grouped: '#000000',
  thumb: '#2b3138',
  video: '#1d242b',
  body: '#e5e5ea',
  red: '#ff453a',
  green: '#30d158',
  off: '#39393d',
  darkCard: '#2c2c2e',
  darkBg: '#1c1c1e',
  black: '#000000',
  white: '#ffffff',
};

/* ---------- Font Family Tokens ---------- */
export const F = {
  r: 'HankenGrotesk_400Regular',
  m: 'HankenGrotesk_500Medium',
  s: 'HankenGrotesk_600SemiBold',
  b: 'HankenGrotesk_700Bold',
};

/* ---------- Font Hook ---------- */
export function useHanken() {
  const [loaded] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });
  return loaded;
}

/* ---------- Text Component ---------- */
export const T = (p: TextProps) => {
  const theme = useTheme();
  return (
    <Text
      {...p}
      style={[{ fontFamily: F.r, fontSize: 17, lineHeight: 22, color: theme.text }, p.style]}
    />
  );
};

/* ---------- Icon SVG Paths (Matching design specifications) ---------- */
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
  playIcon: ['M8 5v14l11-7z'],
  video: ['M15 10l5-3v10l-5-3v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3z'],
  trash: ['M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  search: ['M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z'],
  gear: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
  check: ['M20 6L9 17l-5-5'],
  x: ['M18 6L6 18M6 6l12 12'],
  info: ['M12 16v-4M12 8h.01', 'M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0z'],
  speed: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
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

type IcProps = {
  n: string;
  c?: string;
  s?: number;
  w?: number;
};

export const Ic = ({ n, c, s = 24, w = 1.8 }: IcProps) => {
  const theme = useTheme();
  const strokeColor = c ?? theme.blue;
  return (
    <Svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
    {PATHS[n]?.map((d, index) => (
      <Path key={`${n}-${index}`} d={d} />
    ))}
  </Svg>
);}

export const Play = ({ s = 16, c = '#ffffff' }: { s?: number; c?: string }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
    <Path d="M7 4.5v15l13-7.5z" />
  </Svg>
);
