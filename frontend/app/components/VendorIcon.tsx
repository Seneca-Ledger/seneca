'use client';

import { apiBaseUrl } from '@/app/lib/api';
import { resolveVendorIcon } from '@/app/vendor-icons';
import { LogoAvatar } from './LogoAvatar';

export type VendorIconProps = {
  vendorName: string;
  vendorDomain?: string | null;
  size?: number;
};

const initialsOf = (vendorName: string): string =>
  vendorName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0] ?? '')
    .join('')
    .toUpperCase() || '?';

/**
 * A vendor's brand mark: a bundled SVG when we ship one, otherwise a favicon
 * through the API's icon proxy, otherwise initials. The proxy answers 404 for a
 * domain with no icon, which is what makes the image fall through to initials.
 */
export function VendorIcon({ vendorName, vendorDomain, size = 24 }: VendorIconProps) {
  const icon = resolveVendorIcon(vendorName);

  if (icon) {
    return (
      <svg
        role="img"
        aria-label={vendorName}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className="seneca-vendor-icon"
      >
        <title>{vendorName}</title>
        <path d={icon.path} fill="currentColor" />
      </svg>
    );
  }

  return (
    <LogoAvatar
      src={vendorDomain ? `${apiBaseUrl}/vendor-icons/${encodeURIComponent(vendorDomain)}` : null}
      alt={vendorName}
      size={size}
      className="seneca-vendor-icon seneca-vendor-icon--initials"
      imgClassName="seneca-vendor-icon"
      fallback={initialsOf(vendorName)}
    />
  );
}
