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
  'bugsnag',
  'facebook-fbsdk',
  'react-native-fbsdk-next',
  'applovin',
  'unity-ads',
  'ironsource',
];

export function auditDependencies(packageJsonPath) {
  const pkgContent = fs.readFileSync(packageJsonPath, 'utf8');
  const pkg = JSON.parse(pkgContent);

  const deps = Object.keys(pkg.dependencies || {});
  const devDeps = Object.keys(pkg.devDependencies || {});
  const allDeps = [...deps, ...devDeps];

  const foundViolations = [];

  for (const dep of allDeps) {
    const lower = dep.toLowerCase();
    for (const denied of DENY_LIST) {
      if (lower === denied || lower.includes(denied)) {
        foundViolations.push({ dependency: dep, matchedRule: denied });
      }
    }
  }

  return {
    passed: foundViolations.length === 0,
    violations: foundViolations,
    totalAudited: allDeps.length,
  };
}

if (process.argv[1] && process.argv[1].endsWith('audit-dependencies.mjs')) {
  const packagePath = path.resolve(process.cwd(), 'package.json');
  console.log(`Running PRV-5 privacy audit on ${packagePath}...`);
  const result = auditDependencies(packagePath);

  if (result.passed) {
    console.log(`✅ PRV-5 Audit Passed: 0 tracking or ad SDKs found across ${result.totalAudited} dependencies.`);
    process.exit(0);
  } else {
    console.error(`❌ PRV-5 Audit Failed: Found prohibited tracking/ad SDKs:`, result.violations);
    process.exit(1);
  }
}
