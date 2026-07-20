import { LogBox } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

const IGNORED_WARNINGS = [
  'ProgressBarAndroid has been extracted',
  'SafeAreaView has been deprecated',
  'Clipboard has been extracted',
  'InteractionManager has been deprecated',
  'PushNotificationIOS has been extracted',
];

LogBox.ignoreLogs(IGNORED_WARNINGS);

const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const firstArg = args[0];
  if (typeof firstArg === 'string' && IGNORED_WARNINGS.some((warning) => firstArg.includes(warning))) {
    return;
  }
  originalWarn(...args);
};

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

