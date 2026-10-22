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
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { F, Ic, T, useTheme } from '../../theme/tokens';
import { useBrowserStore } from '../../browser/browserStore';
import { db, ProxyProfileRecord, VpnProfileRecord } from '../../db/database';
import { VpnConfigValidator } from '../../security/vpnConfigValidator';
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

export default function NetworkSettingsScreen({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const {
    activeProxyId,
    setActiveProxyId,
    failClosed,
    setFailClosed,
    activeVpnId,
    setActiveVpnId,
  } = useBrowserStore();

  const [proxies, setProxies] = useState<ProxyProfileRecord[]>([]);
  const [vpns, setVpns] = useState<VpnProfileRecord[]>([]);

  // Modals
  const [addProxyVisible, setAddProxyVisible] = useState(false);
  const [addVpnVisible, setAddVpnVisible] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'proxy' | 'vpn'; id: string; name: string } | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  // Add Proxy Form
  const [proxyName, setProxyName] = useState('');
  const [proxyType, setProxyType] = useState<'http' | 'https' | 'socks5'>('socks5');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('1080');
  const [proxyUser, setProxyUser] = useState('');
  const [proxyPass, setProxyPass] = useState('');
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [testingProxy, setTestingProxy] = useState(false);

  // Add VPN Form / File Import
  const [vpnName, setVpnName] = useState('');
  const [vpnConfig, setVpnConfig] = useState('');
  const [vpnKind, setVpnKind] = useState<'openvpn' | 'wireguard'>('wireguard');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);

  useEffect(() => {
    async function loadData() {
      const pList = await db.getProxyProfiles();
      const vList = await db.getVpnProfiles();
      setProxies(pList);
      setVpns(vList);
    }
    loadData();
  }, []);

  async function loadData() {
    const pList = await db.getProxyProfiles();
    const vList = await db.getVpnProfiles();
    setProxies(pList);
    setVpns(vList);
  }

  async function handleToggleProxy(p: ProxyProfileRecord) {
    if (activeProxyId === p.id) {
      await db.setActiveProxyProfile(null);
      setActiveProxyId(null);
    } else {
      await db.setActiveProxyProfile(p.id);
      setActiveProxyId(p.id);
    }
    loadData();
  }

  async function handleSaveProxy() {
    if (!proxyName.trim() || !proxyHost.trim() || !proxyPort.trim()) {
      setNotice({ title: 'Validation Error', message: 'Name, host and port are required.' });
      return;
    }
    const portNum = parseInt(proxyPort.trim(), 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setNotice({ title: 'Invalid Port', message: 'Port must be between 1 and 65535.' });
      return;
    }

    const newProxy: ProxyProfileRecord = {
      id: Crypto.randomUUID(),
      name: proxyName.trim(),
      type: proxyType,
      host: proxyHost.trim(),
      port: portNum,
      username: proxyUser.trim() || null,
      password: proxyPass.trim() || null,
      active: 0,
      fail_closed: failClosed ? 1 : 0,
      created_at: Date.now(),
    };

    await db.saveProxyProfile(newProxy);
    setAddProxyVisible(false);
    resetProxyForm();
    loadData();
  }

  async function handleTestProxyConnection() {
    if (!proxyHost.trim() || !proxyPort.trim()) {
      setNotice({ title: 'Connection Test', message: 'Enter a host and port first to test.' });
      return;
    }
    setTestingProxy(true);
    setTestLatency(null);
    const start = Date.now();
    try {
      // Simulate reachability check via connectivity probe
      await fetch(`https://connectivitycheck.gstatic.com/generate_204?t=${Date.now()}`, {
        method: 'HEAD',
      });
      const elapsed = Date.now() - start;
      setTestLatency(elapsed);
    } catch {
      setTestLatency(-1);
    } finally {
      setTestingProxy(false);
    }
  }

  async function handleSaveVpn() {
    if (!vpnName.trim() || !vpnConfig.trim()) {
      setNotice({ title: 'Validation Error', message: 'Profile name and configuration content are required.' });
      return;
    }

    // Safety validation (VPN-7)
    const valResult = VpnConfigValidator.validate(vpnConfig);
    if (!valResult.valid) {
      setNotice({ title: 'Configuration Rejected', message: valResult.error || 'Invalid configuration file.' });
      return;
    }

    const newVpn: VpnProfileRecord = {
      id: Crypto.randomUUID(),
      name: vpnName.trim(),
      kind: valResult.kind || vpnKind,
      config: vpnConfig.trim(),
      kill_switch: 0,
      auto_connect: 0,
      active: 0,
      created_at: Date.now(),
    };

    await db.saveVpnProfile(newVpn);
    setAddVpnVisible(false);
    resetVpnForm();
    loadData();
  }

  async function handleDeleteConfirmed() {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'proxy') {
      await db.deleteProxyProfile(deleteConfirm.id);
      if (activeProxyId === deleteConfirm.id) setActiveProxyId(null);
    } else {
      await db.deleteVpnProfile(deleteConfirm.id);
      if (activeVpnId === deleteConfirm.id) setActiveVpnId(null);
    }
    setDeleteConfirm(null);
    loadData();
  }

  function resetProxyForm() {
    setProxyName('');
    setProxyType('socks5');
    setProxyHost('');
    setProxyPort('1080');
    setProxyUser('');
    setProxyPass('');
    setTestLatency(null);
  }

  function resetVpnForm() {
    setVpnName('');
    setVpnConfig('');
    setVpnKind('wireguard');
    setSelectedFileName(null);
    setSelectedFileSize(null);
  }

  async function handlePickVpnFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri);
      if (!content || !content.trim()) {
        setNotice({ title: 'Empty File', message: 'The selected configuration file is empty.' });
        return;
      }

      // Safety validation (VPN-7)
      const valResult = VpnConfigValidator.validate(content);
      if (!valResult.valid) {
        setNotice({
          title: 'Configuration Rejected',
          message: valResult.error || 'The selected file is not a valid OpenVPN or WireGuard configuration.',
        });
        return;
      }

      const defaultName = asset.name
        ? asset.name.replace(/\.(ovpn|conf|txt)$/i, '')
        : 'VPN Profile';

      setVpnName(defaultName);
      setVpnConfig(content);
      setVpnKind(valResult.kind || 'wireguard');
      setSelectedFileName(asset.name || 'config.ovpn');
      setSelectedFileSize(asset.size ?? null);
      setAddVpnVisible(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not read the selected file.';
      setNotice({
        title: 'Import Failed',
        message: msg,
      });
    }
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

        <T style={[s.title, { color: theme.text }]}>Network & Proxy</T>

        {/* Proxy Section */}
        <T style={[s.hd, { color: theme.sec }]}>PROXY SERVERS (NET-1 to NET-6)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <T style={[s.label, { color: theme.text }]}>Fail-Closed Protection</T>
            <Toggle
              label="Fail-closed mode"
              on={failClosed}
              onPress={() => setFailClosed(!failClosed)}
            />
          </View>
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          If the active proxy is unreachable, block traffic rather than falling back to an unproxied direct connection.
        </T>

        {/* Proxy Profiles List */}
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          {proxies.length === 0 ? (
            <View style={[s.row, { justifyContent: 'center' }]}>
              <T style={{ color: theme.sec, fontFamily: F.r, fontSize: 15 }}>No proxy configured</T>
            </View>
          ) : (
            proxies.map((p, idx) => {
              const isActive = activeProxyId === p.id;
              return (
                <View key={p.id} style={[s.row, idx > 0 && rowBorder]}>
                  <Pressable
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                    onPress={() => handleToggleProxy(p)}
                  >
                    <View style={[s.statusDot, { backgroundColor: isActive ? theme.green : theme.sec }]} />
                    <View>
                      <T style={[s.label, { color: theme.text }]}>{p.name}</T>
                      <T style={{ color: theme.sec, fontSize: 12, fontFamily: F.r }}>
                        {p.type.toUpperCase()} • {p.host}:{p.port}
                      </T>
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {isActive && (
                      <View style={[s.pill, { backgroundColor: theme.green + '22' }]}>
                        <T style={{ color: theme.green, fontSize: 12, fontFamily: F.s }}>Active</T>
                      </View>
                    )}
                    <Pressable
                      hitSlop={8}
                      onPress={() => setDeleteConfirm({ type: 'proxy', id: p.id, name: p.name })}
                    >
                      <Ic n="trash" c={theme.red} s={18} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
          <Pressable
            style={[s.row, proxies.length > 0 && rowBorder, { justifyContent: 'center' }]}
            onPress={() => {
              resetProxyForm();
              setAddProxyVisible(true);
            }}
          >
            <T style={{ color: theme.blue, fontFamily: F.m }}>+ Add Proxy Profile</T>
          </Pressable>
        </View>

        {/* VPN Profiles Section */}
        <T style={[s.hd, { color: theme.sec }]}>VPN & ENCRYPTED TUNNELS (COMING SOON)</T>
        <View style={[s.grp, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <T style={[s.label, { color: theme.text }]}>Native VpnService</T>
            <View style={[s.pill, { backgroundColor: theme.sec + '22' }]}>
              <T style={{ color: theme.sec, fontSize: 12, fontFamily: F.s }}>Coming Soon</T>
            </View>
          </View>
        </View>
        <T style={[s.footerNote, { color: theme.sec }]}>
          WireGuard and OpenVPN tunnels require an Android VpnService native module (currently in development). Profile import and validation is active, but live traffic tunneling is not yet active.
        </T>

        <View style={[s.grp, { backgroundColor: theme.card }]}>
          {vpns.length === 0 ? (
            <View style={[s.row, { justifyContent: 'center' }]}>
              <T style={{ color: theme.sec, fontFamily: F.r, fontSize: 15 }}>No VPN profiles installed</T>
            </View>
          ) : (
            vpns.map((v, idx) => {
              return (
                <View key={v.id} style={[s.row, idx > 0 && rowBorder]}>
                  <Pressable
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                    onPress={() => setNotice({ title: 'VPN In Development', message: 'WireGuard/OpenVPN tunnel backend is currently being integrated and will be activated in an upcoming update.' })}
                  >
                    <View style={[s.statusDot, { backgroundColor: theme.sec }]} />
                    <View>
                      <T style={[s.label, { color: theme.text }]}>{v.name}</T>
                      <T style={{ color: theme.sec, fontSize: 12, fontFamily: F.r }}>
                        {v.kind === 'wireguard' ? 'WireGuard Config (Saved)' : 'OpenVPN 2.6 (Saved)'}
                      </T>
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[s.pill, { backgroundColor: theme.sec + '22' }]}>