import crypto from 'crypto';

const DEFAULT_HEX_KEY =
  process.env.UPI_ENCRYPTION_KEY_HEX ||
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

function getKeyBuffer(): Buffer {
  const buf = Buffer.from(DEFAULT_HEX_KEY, 'hex');
  if (buf.length === 32) return buf;
  return crypto.createHash('sha256').update(DEFAULT_HEX_KEY).digest();
}

/**
 * Masks a UPI ID for safe display in Student/Support/Admin tables (e.g. "sa***h@okaxis").
 * Never exposes full raw UPI handles in logs or standard list endpoints (Section 5).
 */
export function maskUpiId(rawUpiId: string): string {
  const trimmed = rawUpiId.trim().toLowerCase();
  const [handle, bank] = trimmed.split('@');
  if (!handle || !bank) return '***@upi';
  if (handle.length <= 2) return `${handle[0]}***@${bank}`;
  return `${handle.slice(0, 2)}***${handle.slice(-1)}@${bank}`;
}

/**
 * Encrypts a UPI ID at rest using AES-256-GCM (`iv:authTag:ciphertext`).
 */
export function encryptUpiId(rawUpiId: string): string {
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(rawUpiId.trim().toLowerCase(), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a stored UPI ID only when an authorized Finance Admin executes payout settlement.
 */
export function decryptUpiId(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) return '***@upi';
  const [ivHex, tagHex, dataHex] = parts;
  const key = getKeyBuffer();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
