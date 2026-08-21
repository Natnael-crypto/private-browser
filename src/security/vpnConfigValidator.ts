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