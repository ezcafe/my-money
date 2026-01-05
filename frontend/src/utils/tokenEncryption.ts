/**
 * Token Encryption Utility
 * Encrypts tokens before storing in localStorage to mitigate XSS risks
 * Uses Web Crypto API for encryption
 *
 * Note: This is a mitigation, not a complete solution. For production,
 * consider using httpOnly cookies (requires backend changes).
 */

/**
 * Generate a key for encryption/decryption
 * Uses a deterministic key derived from a constant seed
 * In production, consider using a more secure key derivation method
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  // Use a constant seed - in production, this could be derived from user-specific data
  const seed = 'my-money-app-encryption-seed';
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);

  // Import key for AES-GCM encryption
  return crypto.subtle.importKey(
    'raw',
    data,
    {name: 'PBKDF2'},
    false,
    ['deriveKey'],
  ).then((baseKey) => {
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('my-money-salt'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      {name: 'AES-GCM', length: 256},
      false,
      ['encrypt', 'decrypt'],
    );
  });
}

/**
 * Encrypt a token before storing in localStorage
 * @param token - Token string to encrypt
 * @returns Encrypted token as base64 string
 */
export async function encryptToken(token: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(token);

    // Generate a random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the token
    const encrypted = await crypto.subtle.encrypt(
      {name: 'AES-GCM', iv},
      key,
      data,
    );

    // Combine IV and encrypted data, then encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Token encryption failed:', error);
    // Fallback to plain storage if encryption fails
    return token;
  }
}

/**
 * Decrypt a token from localStorage
 * @param encryptedToken - Encrypted token as base64 string
 * @returns Decrypted token string
 */
export async function decryptToken(encryptedToken: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const decoder = new TextDecoder();

    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedToken), (c) => c.charCodeAt(0));

    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Decrypt the token
    const decrypted = await crypto.subtle.decrypt(
      {name: 'AES-GCM', iv},
      key,
      encrypted,
    );

    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Token decryption failed:', error);
    // If decryption fails, assume it's plain text (for backward compatibility)
    return encryptedToken;
  }
}

/**
 * Check if a token is encrypted (heuristic check)
 * @param token - Token string to check
 * @returns True if token appears to be encrypted
 */
function isEncrypted(token: string): boolean {
  // Encrypted tokens are base64 encoded and longer
  // This is a heuristic - encrypted tokens will be base64 strings
  try {
    // Try to decode as base64
    atob(token);
    // If it's valid base64 and longer than typical JWT, likely encrypted
    return token.length > 200;
  } catch {
    return false;
  }
}

/**
 * Store encrypted token in localStorage
 * @param key - Storage key
 * @param token - Token to store
 */
export async function storeEncryptedToken(key: string, token: string): Promise<void> {
  try {
    const encrypted = await encryptToken(token);
    localStorage.setItem(key, encrypted);
  } catch (error) {
    console.error('Failed to store encrypted token:', error);
    // Fallback to plain storage
    localStorage.setItem(key, token);
  }
}

/**
 * Retrieve and decrypt token from localStorage
 * @param key - Storage key
 * @returns Decrypted token or null if not found
 */
export async function getEncryptedToken(key: string): Promise<string | null> {
  const stored = localStorage.getItem(key);
  if (!stored) {
    return null;
  }

  // Check if it's encrypted
  if (isEncrypted(stored)) {
    try {
      return await decryptToken(stored);
    } catch (error) {
      console.error('Failed to decrypt token:', error);
      // If decryption fails, return null to force re-authentication
      return null;
    }
  }

  // Plain text token (backward compatibility)
  return stored;
}

