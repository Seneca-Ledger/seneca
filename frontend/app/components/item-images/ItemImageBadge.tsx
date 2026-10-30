'use client';

import type React from 'react';
import { VendorIcon } from '@/app/components/VendorIcon';
import { resolveVendorIcon } from '@/app/vendor-icons';
import { itemImageSrc, useItemVisual } from './useItemImage';

interface ItemImageBadgeProps {
  transactionId: string;
  size: number;
  /** Who the row names: a brand we ship a mark for shows it when nothing else does. */
  name?: string;
  /** What the row shows with none of those: its category badge, or nothing. */
  children: React.ReactNode;
}

/**
 * What a transaction is, at a glance, where a list or a drawer only reads: the
 * picture someone picked for it; else the mark of the subscription it paid (the
 * same one Subscriptions shows); else the mark of a brand it names. Picking a
 * picture happens in Review and Pay/Receive.
 */
export function ItemImageBadge({ transactionId, size, name, children }: ItemImageBadgeProps) {
  const { data } = useItemVisual('transaction', transactionId);
  if (data?.image) {
    return (
      <img
        className="seneca-item-badge"
        src={itemImageSrc(data.image)}
        alt={data.image.label ?? ''}
        style={{ width: size, height: size }}
      />
    );
  }
  const vendor = data?.vendor;
  // A vendor with neither a site nor a mark of ours would only be initials: the category says more.
  const mark = vendor && (vendor.domain || resolveVendorIcon(vendor.name)) ? vendor : null;
  const named = !mark && name && resolveVendorIcon(name) ? { name, domain: null } : null;
  const shown = mark ?? named;
  if (!shown) {
    return <>{children}</>;
  }
  return (
    <span
      className="seneca-item-badge seneca-item-badge--vendor"
      style={{ width: size, height: size }}
    >
      <VendorIcon
        vendorName={shown.name}
        vendorDomain={shown.domain}
        size={Math.round(size * 0.6)}
      />
    </span>
  );
}
