/**
 * VPN Configuration Validator (VPN-7)
 * Strictly verifies .ovpn and WireGuard configs to prevent arbitrary command execution,
 * dangerous script directives, or malformed configs.
 */

// Dangerous directives in OpenVPN that can execute local commands or expose sockets
const FORBIDDEN_OPENVPN_DIRECTIVES = [
  'up',
  'down',
  'route-up',
  'route-pre-down',
  'ipchange',
  'client-connect',
  'client-disconnect',
  'auth-user-pass-verify',
  'tls-verify',
  'management',
  'plugin',
  'script-security',
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  kind?: 'openvpn' | 'wireguard';
  detectedRemote?: string;
}

export class VpnConfigValidator {
  /**
   * Validate an OpenVPN configuration (.ovpn)
   */
  public static validateOpenVpn(rawConfig: string): ValidationResult {
    if (!rawConfig || typeof rawConfig !== 'string') {
      return { valid: false, error: 'Configuration content is empty.' };
    }

    const lines = rawConfig.split(/\r?\n/);
    let hasClientOrRemote = false;
    let remoteHost = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith(';')) {
        continue;
      }

      const parts = line.split(/\s+/);
      const directive = parts[0].toLowerCase();

      // Check for forbidden directives that could execute local code
      if (FORBIDDEN_OPENVPN_DIRECTIVES.includes(directive)) {
        return {
          valid: false,
          error: `Security violation: Directive "${directive}" is forbidden because it can execute arbitrary scripts.`,
        };
      }

      if (directive === 'client' || directive === 'remote') {
        hasClientOrRemote = true;
        if (directive === 'remote' && parts[1]) {
          remoteHost = parts[1] + (parts[2] ? `:${parts[2]}` : '');