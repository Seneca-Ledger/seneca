'use client';

import MuiTooltip from '@mui/material/Tooltip';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { VendorIcon } from '@/app/components/VendorIcon';
import { useIntlayer } from '@/app/i18n';
import { KIND_ICONS } from './item-kind-icons';
import { ImagePlus } from './item-line-icons';
import { type ItemSubject, itemImageSrc, useItemVisual } from './useItemImage';

const ItemImagePicker = dynamic(() => import('./ItemImagePicker').then(m => m.ItemImagePicker), {
  ssr: false,
});

interface ItemThumbProps {
  subject: ItemSubject;
  id: string;
  /** What the row says it was: "Sold Mac mini M4". */
  name: string;
  size?: number;
}

/**
 * The square on the left of a row that has no document: the picture of what
 * was bought or sold once someone picked one; until then the mark of the
 * subscription it paid, a line icon for the kind of thing the note names, or
 * its first letter. Clicking it opens the
 * picture search; nothing is looked up before that.
 */
export function ItemThumb({ subject, id, name, size = 40 }: ItemThumbProps) {
  const t = useIntlayer('itemImages');
  const { data: visual } = useItemVisual(subject, id);
  const image = visual?.image ?? null;
  const vendor = visual?.vendor?.domain ? visual.vendor : null;
  const [open, setOpen] = useState(false);
  const Icon = visual?.kind ? (KIND_ICONS[visual.kind] ?? null) : null;
  const initial = name.trim().charAt(0).toUpperCase();
  const src = image ? itemImageSrc(image) : null;

  return (
    <>
      <MuiTooltip
        placement="right"
        enterDelay={250}
        title={
          src ? (
            <span className="seneca-item-thumb__preview">
              <img src={src} alt="" />
              {image?.label && <span>{image.label}</span>}
            </span>
          ) : (
            t.findPicture.value
          )
        }
        slotProps={src ? { tooltip: { className: 'seneca-item-thumb__tooltip' } } : undefined}
      >
        <button
          type="button"
          className="seneca-item-thumb"
          data-has-image={src ? 'true' : undefined}
          style={{ width: size, height: size }}
          aria-label={src ? `${image?.label ?? name} · ${t.title.value}` : t.findPicture.value}
          data-testid={`item-thumb-${id}`}
          onClick={event => {
            // The row has its own click (open the document or the bill).
            event.stopPropagation();
            setOpen(true);
          }}
        >
          {src ? (
            <img className="seneca-item-thumb__img" src={src} alt="" />
          ) : (
            <span className="seneca-item-thumb__tile" aria-hidden="true">
              {vendor ? (
                // The subscription it paid: the same mark Subscriptions shows.
                <VendorIcon
                  vendorName={vendor.name}
                  vendorDomain={vendor.domain}
                  size={Math.round(size * 0.6)}
                />
              ) : Icon ? (
                <Icon size={Math.round(size * 0.5)} />
              ) : (
                initial
              )}
            </span>
          )}
          {!src && (
            <span className="seneca-item-thumb__add" aria-hidden="true">
              <ImagePlus size={Math.round(size * 0.45)} />
            </span>
          )}
        </button>
      </MuiTooltip>
      {open && (
        // React bubbles a click inside the dialog's portal up to the row, which
        // would open the bill; it stops here.
        // biome-ignore lint/a11y/noStaticElementInteractions: only stops the row's click
        // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard reaches the dialog's own buttons
        <span style={{ display: 'contents' }} onClick={event => event.stopPropagation()}>
          <ItemImagePicker
            subject={subject}
            id={id}
            name={name}
            hasImage={Boolean(src)}
            onClose={() => setOpen(false)}
          />
        </span>
      )}
    </>
  );
}
