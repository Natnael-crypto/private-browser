import React, { useState, useEffect, useCallback } from 'react';
import { View, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C, F, Ic, T, useHanken, useTheme } from '../theme/tokens';
import { LockManager } from '../security/lockManager';
import { ConfirmDialogModal } from '../components/AppModal';

interface LockScreenProps {
  onUnlocked: () => void;
  onClose?: () => void;
}

export default function LockScreen({ onUnlocked, onClose }: LockScreenProps) {
  const ok = useHanken();
  const theme = useTheme();
  const [pw, setPw] = useState('');
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [confirmPw, setConfirmPw] = useState('');
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotConfirmVisible, setForgotConfirmVisible] = useState(false);

  const handleBiometricUnlock = useCallback(async () => {
    const success = await LockManager.authenticateBiometrics();
    if (success) {
      onUnlocked();
    }
  }, [onUnlocked]);

  useEffect(() => {
    async function checkInitialState() {
      const isSet = await LockManager.isPasswordSet();
      setIsFirstRun(!isSet);
      const canBio = await LockManager.canUseBiometrics();
      const bioEnabled = await LockManager.isBiometricEnabled();
      setHasBiometrics(canBio && bioEnabled);

      // If biometric enabled and not first run, prompt biometric
      if (isSet && canBio && bioEnabled) {
        handleBiometricUnlock();
      }
    }
    checkInitialState();
  }, [handleBiometricUnlock]);

  async function handleUnlock() {
    if (loading) return;
    setErrorMessage('');

    if (isFirstRun) {
      if (pw.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return;
      }
      if (pw !== confirmPw) {
        setErrorMessage('Passwords do not match.');
        return;
      }
      setLoading(true);
      const success = await LockManager.setMasterPassword(pw);
      setLoading(false);
      if (success) {
        onUnlocked();
      } else {
        setErrorMessage('Failed to set password.');
      }
      return;
    }

    setLoading(true);
    const result = await LockManager.verifyPassword(pw);
    setLoading(false);

    if (result.success) {
      onUnlocked();
    } else {
      setErrorMessage(result.error || 'Incorrect password.');
    }
  }



  function handleForgotPassword() {
    setForgotConfirmVisible(true);
  }

  if (!ok) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />
      {onClose && (
        <View style={s.modalTopBar}>
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 8 }}>
            <T style={{ color: theme.blue, fontFamily: F.s, fontSize: 17 }}>Cancel</T>
          </Pressable>
        </View>
      )}
      <View style={s.center}>
        <View style={s.badge}>
          <Ic n="lock" c="#fff" s={44} w={1.6} />
        </View>

        <T style={s.title}>Private Browser</T>

        <T style={s.prompt}>
          {isFirstRun
            ? 'Create your master password'
            : 'Enter your password to open'}
        </T>

        <TextInput
          value={pw}
          onChangeText={(text) => {
            setPw(text);
            if (errorMessage) setErrorMessage('');
          }}
          secureTextEntry
          placeholder={isFirstRun ? 'New password (min 6 chars)' : '••••••••'}
          placeholderTextColor="#8e8e93"
          accessibilityLabel="Password"
          autoFocus={!hasBiometrics}
          style={s.input}
        />

        {isFirstRun && (
          <TextInput
            value={confirmPw}
            onChangeText={(text) => {
              setConfirmPw(text);
              if (errorMessage) setErrorMessage('');
            }}
            secureTextEntry
            placeholder="Confirm password"
            placeholderTextColor="#8e8e93"