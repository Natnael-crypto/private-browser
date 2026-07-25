import React, { useState, useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { F, Ic, T, useTheme } from '../../theme/tokens';
import { useBrowserStore } from '../../browser/browserStore';
import { LockManager } from '../../security/lockManager';
import { ActionSheetModal, ConfirmDialogModal, NoticeDialogModal } from '../../components/AppModal';

function Toggle({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={[s.sw, { backgroundColor: on ? theme.green : theme.swOff }]}
    >
      <View style={[s.knob, { backgroundColor: theme.knob }, on ? { right: 2 } : { left: 2 }]} />
    </Pressable>
  );
}

export default function LockEmergencySettingsScreen({
  onBack,
  onChangePasswordPrompt,
}: {
  onBack: () => void;
  onChangePasswordPrompt: () => void;
}) {
  const theme = useTheme();
  const {
    screenOffLock,
    setScreenOffLock,
    privateKeyboard,
    setPrivateKeyboard,
    maxFailedAttempts,
    setMaxFailedAttempts,
    clearEverything,
  } = useBrowserStore();

  const [duressConfigured, setDuressConfigured] = useState(false);
  const [duressModalVisible, setDuressModalVisible] = useState(false);
  const [duressInput, setDuressInput] = useState('');
  const [duressConfirmInput, setDuressConfirmInput] = useState('');
  const [maxAttemptsModalVisible, setMaxAttemptsModalVisible] = useState(false);
  const [panicConfirmVisible, setPanicConfirmVisible] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    async function checkDuress() {
      const isSet = await LockManager.isDuressPasswordSet();
      setDuressConfigured(isSet);
    }
    checkDuress();
  }, []);

  async function handleSaveDuressPassword() {
    if (duressInput.length < 6) {
      setNotice({ title: 'Invalid PIN', message: 'Duress password must be at least 6 characters.' });
      return;
    }
    if (duressInput !== duressConfirmInput) {
      setNotice({ title: 'Mismatch', message: 'Duress passwords do not match.' });
      return;
    }
    const ok = await LockManager.setDuressPassword(duressInput);
    if (ok) {
      setDuressModalVisible(false);
      setDuressInput('');
      setDuressConfirmInput('');
      setDuressConfigured(true);
      setNotice({
        title: 'Duress PIN Configured',
        message: 'Entering this PIN on the lock screen will silently erase all browser data and open a clean decoy session.',
      });
    }
  }

  async function handleRemoveDuress() {
    await LockManager.removeDuressPassword();
    setDuressConfigured(false);
    setNotice({
      title: 'Duress PIN Removed',
      message: 'Duress wipe trigger has been disabled.',
    });
  }

  async function handlePanicWipeConfirmed() {
    setPanicConfirmVisible(false);
    await LockManager.fullDataWipe();
    await clearEverything();
    setNotice({
      title: 'Emergency Wipe Complete',
      message: 'All cookies, storage, encryption keys, bookmarks, and downloads have been securely erased.',
    });
  }

  const rowBorder = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.sep };

  return (
    <View style={{ flex: 1, backgroundColor: theme.grouped }}>
      <StatusBar style={theme.statusBar} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
        <View style={s.topBar}>
          <Pressable onPress={onBack} hitSlop={10} style={s.backBtn}>
            <Ic n="back" c={theme.blue} s={22} />
            <T style={{ color: theme.blue, fontFamily: F.m, fontSize: 17, marginLeft: 4 }}>Settings</T>
          </Pressable>
          <View style={{ width: 40 }} />
        </View>

        <T style={[s.title, { color: theme.text }]}>Lock & Panic Wipe</T>

        {/* Lock Controls */}
        <T style={[s.hd, { color: theme.sec }]}>APPLICATION LOCK (LCK-1, LCK-2)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <Pressable style={s.row} onPress={onChangePasswordPrompt}>
            <T style={[s.label, { color: theme.text }]}>Master Password</T>
            <View style={s.val}>
              <T style={{ color: theme.sec, fontFamily: F.r }}>Change</T>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>

          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Screen-Off Immediate Lock</T>
            <Toggle
              label="Screen-off lock"
              on={screenOffLock}
              onPress={() => setScreenOffLock(!screenOffLock)}
            />
          </View>

          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Private Incognito Keyboard</T>
            <Toggle
              label="Private incognito keyboard"
              on={privateKeyboard}
              onPress={() => setPrivateKeyboard(!privateKeyboard)}
            />
          </View>
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          Private keyboard instructs the mobile OS keyboard not to store or learn your typed queries or sensitive passwords.
        </T>

        {/* Duress & Maximum Attempts */}
        <T style={[s.hd, { color: theme.sec }]}>DURESS & TAMPER DEFENSE (LCK-3, LCK-4)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <Pressable
            style={s.row}
            onPress={() => {
              if (duressConfigured) {
                handleRemoveDuress();
              } else {
                setDuressInput('');
                setDuressConfirmInput('');
                setDuressModalVisible(true);
              }
            }}
          >
            <T style={[s.label, { color: theme.text }]}>Duress Panic PIN</T>
            <View style={s.val}>
              <T style={{ color: duressConfigured ? theme.green : theme.sec, fontFamily: F.r }}>
                {duressConfigured ? 'Configured (Tap to Remove)' : 'Not Set'}
              </T>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>

          <Pressable style={[s.row, rowBorder]} onPress={() => setMaxAttemptsModalVisible(true)}>
            <T style={[s.label, { color: theme.text }]}>Auto-Wipe on Failed Attempts</T>
            <View style={s.val}>
              <T style={{ color: theme.sec, fontFamily: F.r }}>
                {maxFailedAttempts === 0 ? 'Never' : `${maxFailedAttempts} attempts`}
              </T>
              <Ic n="ch" c={theme.sec} s={16} w={2.4} />
            </View>
          </Pressable>
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          If compelled to unlock under duress, entering the secondary Duress PIN instantaneously and irrevocably purges all data and displays a blank browser session.
        </T>

        {/* Panic Wipe Section */}
        <T style={[s.hd, { color: theme.sec }]}>EMERGENCY DATA DESTRUCTION (LCK-5, PRV-4)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <Pressable
            style={[s.row, { justifyContent: 'center' }]}
            onPress={() => setPanicConfirmVisible(true)}
          >
            <T style={{ color: theme.red, fontFamily: F.b }}>EMERGENCY PANIC WIPE</T>
          </Pressable>
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          Instantly zeroes out database tables, deletes secure encryption keys, drops proxy & VPN credentials, and clears all download metadata.
        </T>
      </ScrollView>

      {/* Duress Setup Modal */}
      {duressModalVisible && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }]}>
          <View style={[s.modalBox, { backgroundColor: theme.cardElevated, borderColor: theme.cardBorder }]}>
            <T style={[s.modalTitle, { color: theme.text }]}>Set Duress PIN</T>
            <T style={{ color: theme.sec, fontSize: 13, fontFamily: F.r, marginBottom: 12 }}>
              Choose a secondary password different from your master password. Entering this PIN will instantly destroy all stored data without displaying any alert.
            </T>

            <T style={[s.inputLabel, { color: theme.sec }]}>Duress PIN / Password (min 6 chars)</T>
            <TextInput
              style={[s.textInput, { backgroundColor: theme.inputBg, color: theme.text }]}
              value={duressInput}
              onChangeText={setDuressInput}
              secureTextEntry
              placeholder="••••••"
              placeholderTextColor={theme.sec}
            />

            <T style={[s.inputLabel, { color: theme.sec }]}>Confirm Duress PIN</T>
            <TextInput
              style={[s.textInput, { backgroundColor: theme.inputBg, color: theme.text }]}
              value={duressConfirmInput}
              onChangeText={setDuressConfirmInput}
              secureTextEntry
              placeholder="••••••"
              placeholderTextColor={theme.sec}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
              <Pressable onPress={() => setDuressModalVisible(false)} style={s.modalBtn}>
                <T style={{ color: theme.sec, fontFamily: F.m }}>Cancel</T>
              </Pressable>
              <Pressable onPress={handleSaveDuressPassword} style={[s.modalBtn, { backgroundColor: theme.red, borderRadius: 8, paddingHorizontal: 16 }]}>
                <T style={{ color: '#fff', fontFamily: F.s }}>Enable Duress PIN</T>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Max Attempts Modal */}
      <ActionSheetModal
        visible={maxAttemptsModalVisible}
        title="Failed Unlock Attempts Wipe"
        message="Permanently wipe all browser data if consecutive wrong passwords reach:"
        cancelText="Cancel"
        onClose={() => setMaxAttemptsModalVisible(false)}
        options={[
          {
            text: maxFailedAttempts === 5 ? '5 Attempts (Recommended) ✓' : '5 Attempts (Recommended)',
            onPress: () => {
              setMaxFailedAttempts(5);
              LockManager.setMaxFailedAttempts(5);
            },
          },
          {
            text: maxFailedAttempts === 10 ? '10 Attempts ✓' : '10 Attempts',
            onPress: () => {
              setMaxFailedAttempts(10);
              LockManager.setMaxFailedAttempts(10);
            },
          },
          {
            text: maxFailedAttempts === 0 ? 'Never (Infinite Attempts) ✓' : 'Never (Infinite Attempts)',
            onPress: () => {
              setMaxFailedAttempts(0);
              LockManager.setMaxFailedAttempts(0);
            },
          },
        ]}
      />

      {/* Panic Wipe Confirmation Modal */}
      <ConfirmDialogModal
        visible={panicConfirmVisible}
        title="Trigger Emergency Panic Wipe?"
        message="This will immediately and irrevocably destroy all bookmarks, browsing history, saved videos, cookies, proxy credentials, and encryption keys."
        confirmText="DESTROY ALL DATA NOW"
        confirmStyle="destructive"
        onConfirm={handlePanicWipeConfirmed}
        onClose={() => setPanicConfirmVisible(false)}
      />

      {/* Notice Modal */}
      <NoticeDialogModal
        visible={!!notice}
        title={notice?.title || ''}
        message={notice?.message || ''}
        onClose={() => setNotice(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  topBar: {
    paddingTop: 62,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontFamily: F.b,
    fontSize: 34,
    lineHeight: 44,
    letterSpacing: 0.3,
    marginTop: 6,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  hd: {
    marginHorizontal: 32,
    marginBottom: 6,
    fontSize: 12,
    fontFamily: F.s,
    letterSpacing: 0.5,
  },
  footerNote: {
    marginHorizontal: 32,
    marginTop: -14,
    marginBottom: 20,
    fontSize: 12,
    fontFamily: F.r,
    lineHeight: 18,
  },
  grp: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  label: {
    fontFamily: F.r,
    fontSize: 17,
  },
  val: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sw: {
    marginLeft: 'auto',
    width: 51,
    height: 31,
    borderRadius: 16,
  },
  knob: {
    position: 'absolute',
    top: 2,
    width: 27,
    height: 27,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  modalBox: {
    borderRadius: 14,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontFamily: F.b,
    fontSize: 20,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: F.m,
    marginBottom: 4,
  },
  textInput: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: F.r,
    marginBottom: 10,
  },
  modalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
