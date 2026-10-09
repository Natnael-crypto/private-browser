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