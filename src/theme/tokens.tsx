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