'use client';

import { useTheme } from 'next-themes';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DocumentTypeIcon } from '@/app/components/DocumentTypeIcon';
import { PDFThumbnail } from '@/app/components/PDFThumbnail';
import { tokens } from '@/lib/theme-tokens';

/** The thumbnail in a list row, border included; the row's receipt column is as wide. */
const THUMBNAIL_SIZE = 40;
const PREVIEW_WIDTH = 430;
const PREVIEW_HEIGHT = 620;
const PREVIEW_IMAGE_WIDTH = (PREVIEW_WIDTH - 16) * 2;

type Props = {
  fileId: string;
  fileName: string;
  /** A receipt passes 'pdf': its thumbnail endpoint renders any receipt file. */
  fileType: string;
  source: 'statement' | 'gmail' | 'receipt';
  /** Click on the thumbnail: the full preview, not the row's own action. */
  onOpen: () => void;
  testId?: string;
};

const isPdfType = (fileType: string): boolean => fileType.trim().toLowerCase().includes('pdf');

/**
 * A list row's document: a small first-page thumbnail that shows the page at
 * full height beside the row while the pointer rests on it. Shared by the
 * Documents list and Review so a row's file looks and behaves the same in both.
 */
export function DocumentThumbnailPreview({
  fileId,
  fileName,
  fileType,
  source,
  onOpen,
  testId,
}: Props): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const hasHoverPreview = isPdfType(fileType || fileName);

  const close = useCallback(() => {
    setVisible(false);
    setPosition(null);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger?.isConnected || typeof window === 'undefined') {
      close();
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 12;

    const maxTop = Math.max(16, viewportHeight - PREVIEW_HEIGHT - 16);
    const centeredTop = triggerRect.top + triggerRect.height / 2 - PREVIEW_HEIGHT / 2;
    const top = Math.min(Math.max(16, centeredTop), maxTop);

    const rightSideLeft = triggerRect.right + gap;
    const fitsOnRight = rightSideLeft + PREVIEW_WIDTH <= viewportWidth - 12;
    const left = fitsOnRight ? rightSideLeft : Math.max(12, triggerRect.left - PREVIEW_WIDTH - gap);

    setPosition({ top, left });
  }, [close]);

  useEffect(() => {
    if (!visible) return;

    updatePosition();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    window.addEventListener('scroll', close, true);
    window.addEventListener('wheel', close, { capture: true, passive: true });
    window.addEventListener('touchmove', close, { capture: true, passive: true });
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('wheel', close, true);
      window.removeEventListener('touchmove', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, visible, updatePosition]);

  return (
    <div style={{ position: 'relative', pointerEvents: 'auto' }}>
      <button
        type="button"
        ref={triggerRef}
        data-testid={testId}
        style={{
          width: THUMBNAIL_SIZE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'opacity 0.15s',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
        onClick={event => {
          event.stopPropagation();
          onOpen();
        }}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={close}
        aria-label={fileName}
      >
        {/* Big enough to tell one document from another, in full colour. */}
        <span
          style={{
            display: 'flex',
            overflow: 'hidden',
            borderRadius: 6,
            border: `1px solid ${c.ink150}`,
            color: c.ink400,
          }}
        >
          <DocumentTypeIcon
            fileType={fileType}
            fileName={fileName}
            fileId={fileId}
            source={source}
            size={THUMBNAIL_SIZE - 2}
          />
        </span>
      </button>

      {hasHoverPreview && visible && position
        ? createPortal(
            <div
              data-testid="statement-hover-preview"
              style={{
                pointerEvents: 'none',
                position: 'fixed',
                zIndex: 140,
                borderRadius: tokens.radius.lg,
                border: `1px solid ${c.ink150}`,
                background: 'var(--card-bg)',
                padding: 8,
                boxShadow: tokens.shadow.lg,
                top: position.top,
                left: position.left,
                width: PREVIEW_WIDTH,
                maxWidth: 'min(430px, calc(100vw - 24px))',
              }}
            >
              <PDFThumbnail
                fileId={fileId}
                fileName={fileName}
                source={source}
                width={PREVIEW_WIDTH - 16}
                thumbnailWidth={PREVIEW_IMAGE_WIDTH}
                height={PREVIEW_HEIGHT}
                preservePageAspect
                errorMessage="Unable to load document"
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
