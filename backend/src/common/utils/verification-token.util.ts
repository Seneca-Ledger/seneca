import { createHmac, randomBytes } from 'crypto';

/**
 * Single-use tokens for out-of-band confirmation flows (password reset, email
 * change).
 *
 * The plaintext exists exactly once, in the message sent to the user; the
 * database only ever holds the HMAC. Whoever can read those rows must not be
 * able to use what they find there.
 */
export function createVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashVerificationToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}
