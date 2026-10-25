'use client';

import type { RefObject } from 'react';
import { Download, MoreVertical, X } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';

type HeaderProps = {
  menuOpen: boolean;
  onToggleMenu: () => void;
  onClose: () => void;
  onDownload: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
};

export function PDFPreviewHeader({
  menuOpen,
  onToggleMenu,
  onClose,
  onDownload,
  containerRef,
}: HeaderProps): React.JSX.Element {
  const t = useIntlayer('pdfPreviewModal');
  return (
    <div className="seneca-pdf-preview-modal__header" ref={containerRef}>
      <h2 className="seneca-pdf-preview-modal__title">{t.receiptTitle}</h2>
      <div className="seneca-pdf-preview-modal__header-actions">
        <button
          type="button"
          onClick={onToggleMenu}
          className="seneca-pdf-preview-modal__menu-btn"
          aria-label={t.openFileMenu.value}
        >
          <MoreVertical size={24} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="seneca-pdf-preview-modal__close-btn"
          aria-label={t.closePreview.value}
        >
          <X size={33} strokeWidth={2.4} />
        </button>
      </div>
      {menuOpen && (
        <div className="seneca-pdf-preview-modal__dropdown-menu">
          <button
            type="button"
            onClick={onDownload}
            className="seneca-pdf-preview-modal__dropdown-item"
          >
            <Download className="seneca-pdf-preview-modal__dropdown-icon" strokeWidth={2.3} />
            <span className="seneca-pdf-preview-modal__dropdown-label">{t.download}</span>
          </button>
        </div>
      )}
    </div>
  );
}
