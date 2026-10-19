import { timingSafeEqual } from 'crypto';

/**
 * Constant-time comparison for shared secrets, webhook tokens and HMAC
 * signatures. A plain `!==` returns as soon as two bytes differ, so the time it
 * takes leaks how much of a guess was correct — enough, over many requests, to
 * recover the value one byte at a time.
 *
 * Lengths are compared first because `timingSafeEqual` throws on a mismatch;
 * that much is unavoidably observable and is not the part worth hiding.
 */
export function secretsMatch(provided: string | undefined | null, expected: string): boolean {
  if (!(provided && expected)) {
    return false;
  }

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
