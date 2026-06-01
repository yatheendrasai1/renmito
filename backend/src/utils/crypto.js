const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey() {
  const raw = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  // Derive a 32-byte key from whatever secret is available
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypts a plaintext string.
 * Returns a hex string: iv(12 bytes) + tag(16 bytes) + ciphertext
 */
function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('hex');
}

/**
 * Decrypts a hex string produced by encrypt().
 * Returns the original plaintext.
 */
function decrypt(hex) {
  const buf = Buffer.from(hex, 'hex');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
