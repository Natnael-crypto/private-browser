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
            accessibilityLabel="Confirm Password"
            style={[s.input, { marginTop: 12 }]}
          />
        )}

        {!!errorMessage && (
          <T style={[s.errorText, { color: theme.red }]}>{errorMessage}</T>
        )}

        <Pressable
          style={[s.unlock, { backgroundColor: theme.blue }, loading && { opacity: 0.7 }]}
          onPress={handleUnlock}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <T style={{ color: '#fff', fontFamily: F.s }}>
              {isFirstRun ? 'Save & Open' : 'Unlock'}
            </T>
          )}
        </Pressable>

        {!isFirstRun && hasBiometrics && (
          <Pressable style={s.fp} onPress={handleBiometricUnlock}>
            <Ic n="fp" c={theme.blue} s={22} />
            <T style={{ color: theme.blue, fontSize: 16, fontFamily: F.m }}>Use fingerprint</T>
          </Pressable>
        )}

        {!isFirstRun && (
          <Pressable style={{ marginTop: 20 }} onPress={handleForgotPassword}>
            <T style={{ color: '#8e8e93', fontSize: 13, textDecorationLine: 'underline' }}>
              Forgot password?
            </T>
          </Pressable>
        )}
      </View>

      <T style={s.footer}>Nothing is saved unless you save it.</T>

      <ConfirmDialogModal
        visible={forgotConfirmVisible}
        title="Forgot Password"
        message="For privacy and security, there is no password recovery. Resetting will erase all stored video details, downloads, and preferences."
        confirmText="Wipe All Data"
        confirmStyle="destructive"
        onConfirm={async () => {
          await LockManager.fullDataWipe();
          setIsFirstRun(true);
          setPw('');
          setConfirmPw('');
          setErrorMessage('All data wiped. Create a new password.');
        }}
        onClose={() => setForgotConfirmVisible(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  modalTopBar: {
    paddingTop: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    zIndex: 10,
  },
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 190,
    alignItems: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: F.b,
    fontSize: 24,
    lineHeight: 31,
    color: '#fff',
    marginTop: 18,
    marginBottom: 4,
  },
  prompt: {
    color: '#a1a1a6',
    fontSize: 15,
    marginBottom: 24,
  },
  input: {
    width: 300,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 18,
    fontFamily: F.r,
  },
  errorText: {
    color: C.red,
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  unlock: {
    width: 300,
    height: 50,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fp: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 48,
    textAlign: 'center',
    color: '#8e8e93',
    fontSize: 13,
  },
});
