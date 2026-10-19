import * as bcrypt from 'bcrypt';

/**
 * bcrypt work factor. 12 is the current OWASP recommendation; the codebase used
 * a hardcoded 10 in five places. Overridable so a deployment on slower hardware
 * can tune it without a code change — bcrypt stores the cost inside the hash,
 * so existing hashes keep verifying and are upgraded the next time the user
 * sets a password.
 */
const DEFAULT_ROUNDS = 12;

export function passwordHashRounds(): number {
  const configured = Number.parseInt(process.env.BCRYPT_ROUNDS || '', 10);
  return Number.isInteger(configured) && configured >= 10 && configured <= 15
    ? configured
    : DEFAULT_ROUNDS;
}

export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, passwordHashRounds());
}
