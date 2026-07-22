/**
 * LockScreen.tsx
 * Password + fingerprint unlock. Imports shared helpers from ./BrowserScreen.
 * Demo only: replace onUnlock with your real key-unwrapping call.
 */
import React, { useState } from 'react';
import { View, Pressable, TextInput, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C, F, Ic, T, useHanken } from './BrowserScreen';

const DEMO = { title: 'Private Browser', prompt: 'Enter your password to open', footer: 'Nothing is saved unless you save it.' };

export default function LockScreen({ onUnlock = () => {} }: { onUnlock?: () => void }) {
  const ok = useHanken();
  const [pw, setPw] = useState('12345678');
  if (!ok) return null;
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />
      <View style={s.center}>
        <View style={s.badge}><Ic n="lock" c="#fff" s={30} w={1.6} /></View>
        <T style={s.title}>{DEMO.title}</T>
        <T style={s.prompt}>{DEMO.prompt}</T>
        <TextInput
          value={pw}
          onChangeText={setPw}
          secureTextEntry
          accessibilityLabel="Password"
          placeholderTextColor="#8e8e93"
          style={s.input}
        />
        <Pressable style={s.unlock} onPress={onUnlock}>
          <T style={{ color: '#fff', fontFamily: F.s }}>Unlock</T>
        </Pressable>
        <Pressable style={s.fp} onPress={onUnlock}>
          <Ic n="fp" c="#4da3ff" s={22} />
          <T style={{ color: '#4da3ff', fontSize: 16 }}>Use fingerprint</T>
        </Pressable>
      </View>
      <T style={s.footer}>{DEMO.footer}</T>
    </View>
  );
}

const s = StyleSheet.create({
  center: { position: 'absolute', left: 0, right: 0, top: 230, alignItems: 'center' },
  badge: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#2c2c2e', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.b, fontSize: 24, lineHeight: 31, color: '#fff', marginTop: 18, marginBottom: 4 },
  prompt: { color: '#a1a1a6', fontSize: 15, marginBottom: 28 },
  input: { width: 300, height: 50, borderRadius: 12, backgroundColor: '#2c2c2e', paddingHorizontal: 16, color: '#fff', fontSize: 20, letterSpacing: 5, fontFamily: F.r },
  unlock: { width: 300, height: 50, marginTop: 12, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  fp: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 48, textAlign: 'center', color: '#8e8e93', fontSize: 13 },
});
