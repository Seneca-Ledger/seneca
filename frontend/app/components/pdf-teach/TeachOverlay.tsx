'use client';

import { type PointerEvent, useRef, useState } from 'react';
import { X } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import {
  type Point,
  rectBetween,
  regionWarning,
  TAG_TONE,
  type TeachTag,
  wordsInRegion,
} from './teach-utils';
import type { TeachSession } from './useTeachSession';

interface TeachOverlayProps {
  page: number;
  /** Width the page is drawn at, in pixels. */
  width: number;
  session: TeachSession;
}

const box = (rect: { x0: number; y0: number; x1: number; y1: number }, scale: number) => ({
  left: rect.x0 * scale,
  top: rect.y0 * scale,
  width: (rect.x1 - rect.x0) * scale,
  height: (rect.y1 - rect.y0) * scale,
});

/**
 * The marking layer over one page: drag to draw an area with the tag in hand;
 * the words inside light up as the parser will take them, and each row the
 * preview read gets a dot at the page's edge (attention where the running
 * balance breaks).
 */
export function TeachOverlay({ page, width, session }: TeachOverlayProps) {
  const t = useIntlayer('pdfTeach');
  const label = (tag: TeachTag) => t.tags[tag].value;
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const pointsWide = session.pageWidths[page];
  if (!pointsWide) {
    return null;
  }
  const scale = width / pointsWide;

  const pointAt = (event: PointerEvent<HTMLDivElement>): Point => {
    const bounds = layerRef.current?.getBoundingClientRect();
    return {
      x: (event.clientX - (bounds?.left ?? 0)) / scale,
      y: (event.clientY - (bounds?.top ?? 0)) / scale,
    };
  };

  const finish = () => {
    if (start && end) {
      session.addRegion({ page, ...rectBetween(start, end) });
    }
    setStart(null);
    setEnd(null);
  };

  const regions = session.regions
    .map((region, index) => ({ region, index }))
    .filter(({ region }) => region.page === page);
  const rows = (session.preview?.rows ?? []).filter(row => row.page === page);

  return (
    <div
      ref={layerRef}
      // While an area is drawn the labels step aside: they would cover what is being marked.
      className={`seneca-pdf-teach__layer${start ? ' seneca-pdf-teach__layer--drawing' : ''}`}
      style={{ width }}
      data-testid={`teach-layer-${page}`}
      onPointerDown={event => {
        if (event.button !== 0 || (event.target as HTMLElement).closest('button')) {
          return;
        }
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setStart(pointAt(event));
        setEnd(pointAt(event));
      }}
      onPointerMove={event => {
        if (start) {
          setEnd(pointAt(event));
        }
      }}
      onPointerUp={finish}
      onPointerCancel={() => {
        setStart(null);
        setEnd(null);
      }}
    >
      {regions.map(({ region, index }) =>
        wordsInRegion(session.words ?? [], region).map(word => (
          <span
            key={`${index}-${word.x}-${word.y}`}
            className="seneca-pdf-teach__word"
            style={
              {
                ...box(
                  { x0: word.x, y0: word.y, x1: word.x + word.width, y1: word.y + word.height },
                  scale,
                ),
                '--teach-tone': TAG_TONE[region.tag],
              } as React.CSSProperties
            }
          />
        )),
      )}
      {regions.map(({ region, index }) => (
        <div
          key={index}
          className={`seneca-pdf-teach__region${regionWarning(region, session.words ?? []) ? ' seneca-pdf-teach__region--warning' : ''}`}
          style={
            { ...box(region, scale), '--teach-tone': TAG_TONE[region.tag] } as React.CSSProperties
          }
        >
          <span className="seneca-pdf-teach__region-label">
            {label(region.tag)}
            <button
              type="button"
              className="seneca-pdf-teach__region-remove"
              aria-label={`${t.removeRegion.value}: ${label(region.tag)}`}
              onClick={() => session.removeRegion(index)}
            >
              <X size={12} strokeWidth={2} />
            </button>
          </span>
        </div>
      ))}
      {start && end ? (
        <div
          className="seneca-pdf-teach__draft"
          style={
            {
              ...box(rectBetween(start, end), scale),
              '--teach-tone': TAG_TONE[session.activeTag],
            } as React.CSSProperties
          }
        />
      ) : null}
      {rows.map(row => (
        <span
          key={`${row.page}-${row.y}`}
          className={`seneca-pdf-teach__row-mark${row.broken ? ' seneca-pdf-teach__row-mark--broken' : ''}`}
          style={{ top: row.y * scale }}
        />
      ))}
    </div>
  );
}
