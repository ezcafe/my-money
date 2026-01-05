/**
 * Nonce Utility
 * Generates and manages request nonces to prevent replay attacks
 */

/**
 * Generate a cryptographically secure random nonce
 * @returns Random nonce string
 */
export function generateNonce(): string {
  // Use crypto.getRandomValues for secure random generation
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  return Array.from(array, (val) => val.toString(16).padStart(8, '0')).join('');
}

/**
 * Store nonce with timestamp for validation
 * @param nonce - Nonce to store
 * @param ttl - Time to live in milliseconds (default: 5 minutes)
 */
export function storeNonce(nonce: string, ttl: number = 5 * 60 * 1000): void {
  const expiresAt = Date.now() + ttl;
  sessionStorage.setItem(`nonce_${nonce}`, String(expiresAt));
}

/**
 * Validate and consume a nonce
 * @param nonce - Nonce to validate
 * @returns True if nonce is valid and not expired
 */
export function validateAndConsumeNonce(nonce: string): boolean {
  const key = `nonce_${nonce}`;
  const stored = sessionStorage.getItem(key);

  if (!stored) {
    return false; // Nonce not found
  }

  const expiresAt = Number.parseInt(stored, 10);
  const now = Date.now();

  if (now > expiresAt) {
    sessionStorage.removeItem(key);
    return false; // Nonce expired
  }

  // Consume the nonce (remove it so it can't be reused)
  sessionStorage.removeItem(key);
  return true;
}

/**
 * Clean up expired nonces from storage
 */
export function cleanupExpiredNonces(): void {
  const now = Date.now();
  const keysToRemove: string[] = [];

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith('nonce_')) {
      const expiresAt = Number.parseInt(sessionStorage.getItem(key) ?? '0', 10);
      if (now > expiresAt) {
        keysToRemove.push(key);
      }
    }
  }

  for (const key of keysToRemove) {
    sessionStorage.removeItem(key);
  }
}

// Clean up expired nonces periodically
if (typeof window !== 'undefined') {
  setInterval(cleanupExpiredNonces, 60 * 1000); // Every minute
}

