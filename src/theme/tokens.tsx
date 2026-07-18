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