'use client';

import { useIntlayer } from '@/app/i18n';
import { getReceiptLogoUrl } from '../lib/brand-logo';
import { LogoAvatar } from './LogoAvatar';

type Props = {
  sender: string;
  vendorName?: string;
  size?: number;
};

const extractLocalPart = (sender: string): string => {
  if (!sender) {
    return '';
  }

  const emailMatch = sender.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch?.[0]) {
    return emailMatch[0].split('@')[0] ?? '';
  }

  if (sender.includes('@')) {
    return sender.split('@')[0] ?? '';
  }

  return sender;
};

const getInitials = (label: string): string => {
  const cleaned = label.replace(/[^a-z0-9\s]+/gi, ' ').trim();

  if (!cleaned) {
    return 'NA';
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }

  return cleaned.slice(0, 2).toUpperCase();
};

export function BrandLogoAvatar({ sender, vendorName, size = 32 }: Props) {
  const t = useIntlayer('imageAlt');
  const logoUrl = getReceiptLogoUrl(sender);
  const fallbackSource = vendorName ?? extractLocalPart(sender);
  const initials = getInitials(fallbackSource);

  return (
    <LogoAvatar
      src={logoUrl}
      alt={vendorName || t.brand.value}
      size={size}
      imgClassName="seneca-brand-logo-avatar__img"
      className="seneca-brand-logo-avatar"
      fallbackStyle={{ fontSize: size * 0.35 }}
      fallback={initials}
    />
  );
}
