'use client';

import { resolveBankLogo } from '@bank-logos';
import { Landmark } from '@/app/components/icons';

import { LogoAvatar } from './LogoAvatar';

type Props = {
  bankName?: string | null;
  size?: number;
  className?: string;
  rounded?: boolean;
};

export function BankLogoAvatar({ bankName, size = 32, className, rounded = true }: Props) {
  const resolved = resolveBankLogo(bankName);
  const src = resolved.key !== 'other' ? resolved.src : null;

  const borderRadius = rounded ? '50%' : 0;

  return (
    <LogoAvatar
      src={src}
      alt={bankName || resolved.displayName || 'Bank'}
      size={size}
      imgClassName={className}
      imgStyle={{ borderRadius, backgroundColor: 'var(--muted)', objectFit: 'contain' }}
      className={className}
      fallbackStyle={{
        borderRadius,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--muted-foreground)',
      }}
      fallback={
        <Landmark
          data-testid="bank-logo-fallback-icon"
          size={Math.max(14, Math.round(size * 0.9))}
        />
      }
    />
  );
}
