import fs from 'node:fs';
import path from 'node:path';

// PRV-5: CI Deny-list audit for analytics, trackers, and ad SDKs
const DENY_LIST = [
  'firebase',
  'google-analytics',
  '@react-native-firebase/analytics',
  'react-native-admob',
  'react-native-google-mobile-ads',
  'appsflyer',
  'react-native-appsflyer',
  'branch',
  'react-native-branch',
  'adjust',
  'react-native-adjust',
  'mixpanel',
  'mixpanel-react-native',
  'amplitude',
  '@amplitude/react-native',
  'segment',
  '@segment/analytics-react-native',
  'sentry',
  '@sentry/react-native',