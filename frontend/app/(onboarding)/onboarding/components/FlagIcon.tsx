'use client';

import { flagFor } from '@/app/(main)/workspaces/components/tax-jurisdiction.helpers';

/** A 3:2 flag, or nothing for a country the flag set does not carry. */
export function FlagIcon({ code, size = 20 }: { code: string; size?: number }) {
  const Flag = flagFor(code);
  if (!Flag) {
    return null;
  }
  return (
    <Flag
      aria-hidden
      style={{ width: size, height: (size * 2) / 3, borderRadius: 2, flexShrink: 0 }}
    />
  );
}
