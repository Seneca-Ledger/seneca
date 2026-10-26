/**
 * A person without an uploaded photo is shown as the first letter of their
 * name on a calm sage tint. The tint is picked from the person's e-mail, so it
 * looks random across people yet stays the same for one person everywhere.
 */

// Sage family, mixed into the card so each reads in both themes under --foreground text.
const TONES = [
  'color-mix(in srgb, var(--cat-tone-1) 32%, var(--card-bg))',
  'color-mix(in srgb, var(--cat-tone-1) 52%, var(--card-bg))',
  'color-mix(in srgb, var(--primary) 40%, var(--card-bg))',
  'color-mix(in srgb, var(--cat-tone-other) 45%, var(--card-bg))',
  'color-mix(in srgb, color-mix(in srgb, var(--cat-tone-1) 60%, var(--cat-tone-4)) 40%, var(--card-bg))',
  'color-mix(in srgb, color-mix(in srgb, var(--cat-tone-1) 70%, var(--cat-tone-3)) 45%, var(--card-bg))',
];

export function avatarInitial(name?: string | null): string {
  return name?.trim().charAt(0).toLocaleUpperCase() || '?';
}

export function avatarTone(seed?: string | null): string {
  let hash = 0;
  for (const char of seed ?? '') {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return TONES[Math.abs(hash) % TONES.length];
}
