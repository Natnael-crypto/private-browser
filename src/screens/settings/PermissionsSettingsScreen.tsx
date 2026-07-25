import React, { useState, useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { F, Ic, T, useTheme } from '../../theme/tokens';
import { useBrowserStore } from '../../browser/browserStore';
import { db, SitePermissionRecord } from '../../db/database';
import { ConfirmDialogModal, NoticeDialogModal } from '../../components/AppModal';

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

export default function PermissionsSettingsScreen({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const {
    defaultDenyPermissions,
    setDefaultDenyPermissions,
    blockClipboardRead,
    setBlockClipboardRead,
    warnRiskyDownloads,
    setWarnRiskyDownloads,
    blockDriveByNav,
    setBlockDriveByNav,
    confirmAppRedirects,
    setConfirmAppRedirects,
  } = useBrowserStore();

  const [permissions, setPermissions] = useState<SitePermissionRecord[]>([]);
  const [revokeAllConfirm, setRevokeAllConfirm] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    async function loadPermissions() {
      const list = await db.getSitePermissions();
      setPermissions(list);
    }
    loadPermissions();
  }, []);

  async function loadPermissions() {
    const list = await db.getSitePermissions();
    setPermissions(list);
  }

  async function handleRevokeOne(item: SitePermissionRecord) {
    await db.revokeSitePermission(item.host, item.permission);
    loadPermissions();
  }

  async function handleRevokeAll() {
    await db.revokeAllSitePermissions();
    setRevokeAllConfirm(false);
    loadPermissions();
    setNotice({
      title: 'Permissions Revoked',
      message: 'All stored camera, microphone, geolocation, and clipboard site permissions have been cleared.',
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

        <T style={[s.title, { color: theme.text }]}>Permissions & Safety</T>

        {/* Global Policy */}
        <T style={[s.hd, { color: theme.sec }]}>GLOBAL ACCESS POLICIES (PRM-1, PRM-3)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <T style={[s.label, { color: theme.text }]}>Default Deny Permissions</T>
            <Toggle
              label="Default deny permissions"
              on={defaultDenyPermissions}
              onPress={() => setDefaultDenyPermissions(!defaultDenyPermissions)}
            />
          </View>
          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Block Clipboard Reading</T>
            <Toggle
              label="Block clipboard reading"
              on={blockClipboardRead}
              onPress={() => setBlockClipboardRead(!blockClipboardRead)}
            />
          </View>
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          Requires explicit authorization before any website can read clipboard content or access hardware sensors.
        </T>

        {/* Safe Browsing Controls */}
        <T style={[s.hd, { color: theme.sec }]}>SAFE BROWSING & REDIRECTS (PRM-4 to PRM-6)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <T style={[s.label, { color: theme.text }]}>Warn on Risky Downloads</T>
            <Toggle
              label="Warn on risky downloads"
              on={warnRiskyDownloads}
              onPress={() => setWarnRiskyDownloads(!warnRiskyDownloads)}
            />
          </View>
          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Block Drive-By Navigations</T>
            <Toggle
              label="Block drive-by navigations"
              on={blockDriveByNav}
              onPress={() => setBlockDriveByNav(!blockDriveByNav)}
            />
          </View>
          <View style={[s.row, rowBorder]}>
            <T style={[s.label, { color: theme.text }]}>Confirm App Redirects</T>
            <Toggle
              label="Confirm app redirects"
              on={confirmAppRedirects}
              onPress={() => setConfirmAppRedirects(!confirmAppRedirects)}
            />
          </View>
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          Detects executable downloads (.apk, .exe, .dmg), blocks multi-tap invisible clickjacking traps, and prompts before launching external apps.
        </T>

        {/* Site Permissions Manager (PRM-2) */}
        <T style={[s.hd, { color: theme.sec }]}>SITE PERMISSIONS MANAGER (PRM-2)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          {permissions.length === 0 ? (
            <View style={[s.row, { justifyContent: 'center' }]}>
              <T style={{ color: theme.sec, fontFamily: F.r, fontSize: 15 }}>No site permissions granted</T>
            </View>
          ) : (
            permissions.map((p, idx) => (
              <View key={`${p.host}-${p.permission}`} style={[s.row, idx > 0 && rowBorder]}>
                <View style={{ flex: 1 }}>
                  <T style={[s.label, { color: theme.text }]}>{p.host}</T>
                  <T style={{ color: theme.sec, fontSize: 12, fontFamily: F.r }}>
                    {p.permission.toUpperCase()} • {p.decision.toUpperCase()}
                  </T>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => handleRevokeOne(p)}
                  style={{ padding: 6 }}
                >
                  <T style={{ color: theme.red, fontSize: 14, fontFamily: F.m }}>Revoke</T>
                </Pressable>
              </View>
            ))
          )}

          {permissions.length > 0 && (
            <Pressable
              style={[s.row, rowBorder, { justifyContent: 'center' }]}
              onPress={() => setRevokeAllConfirm(true)}
            >
              <T style={{ color: theme.red, fontFamily: F.m }}>Revoke All Permissions</T>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Revoke All Confirmation Modal */}
      <ConfirmDialogModal
        visible={revokeAllConfirm}
        title="Revoke All Permissions"
        message="This will clear all camera, microphone, and location permissions granted to websites."
        confirmText="Revoke All"
        confirmStyle="destructive"
        onConfirm={handleRevokeAll}
        onClose={() => setRevokeAllConfirm(false)}
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
});
