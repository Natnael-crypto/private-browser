/**
 * Privacy Layer (PRV-1 to PRV-13)
 * Strips tracking parameters, enforces HTTPS-only, injects GPC & WebRTC leak shields.
 */

// Known tracking parameters to strip before navigation (PRV-8)
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',