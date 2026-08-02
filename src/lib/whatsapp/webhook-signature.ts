import crypto from 'node:crypto'

// Placeholder values — a user who hasn't configured their App Secret yet
// (META_APP_SECRET=your-meta-app-secret) should have the signature check
// bypassed with a warning, not a hard rejection, so they can test the
// webhook without immediately needing the secret.
const PLACEHOLDER_PATTERNS = [
  'your-meta-app-secret',
  'your_meta_app_secret',
  'placeholder',
  'changeme',
  '<your-meta-app-secret>',
]

/**
 * Verify the HMAC-SHA256 signature Meta attaches to webhook POSTs.
 *
 * Meta signs the raw request body with your App Secret and sends the
 * result in the `x-hub-signature-256: sha256=<hex>` header. Without
 * verification, anyone who knows our webhook URL can POST fabricated
 * status updates and drift broadcast counts arbitrarily.
 *
 * Reference:
 *   https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verify-payloads
 *
 * Contract:
 *   - If `META_APP_SECRET` is missing or is still a placeholder, we log a
 *     warning and allow the request through. This lets users test webhook
 *     delivery without having to configure App Secret immediately. In
 *     production, you should always set a real App Secret.
 *   - If `META_APP_SECRET` is set to a real value, strict HMAC verification
 *     is enforced and mismatched requests are rejected.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.META_APP_SECRET

  if (!secret || PLACEHOLDER_PATTERNS.includes(secret.trim().toLowerCase())) {
    console.warn(
      '[webhook] META_APP_SECRET is not configured or is still a placeholder — ' +
        'signature verification is DISABLED. ' +
        'Set META_APP_SECRET (Meta → App Settings → Basic → App Secret) ' +
        'to enable strict verification in production.',
    )
    // Allow through without signature check
    return true
  }

  if (!signatureHeader) return false
  if (!signatureHeader.startsWith('sha256=')) return false

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  // Bail if lengths differ — timingSafeEqual throws otherwise.
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
