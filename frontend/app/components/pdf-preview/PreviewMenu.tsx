'use client';

import { Download, GraduationCap } from '@/app/components/icons';

/**
 * The preview's ⋮ menu: download the file, and for a statement's PDF, teach
 * the parser its layout again (the marking mode).
 */
export function PreviewMenu({
  downloadLabel,
  onDownload,
  teachLabel,
  onTeach,
  onClose,
}: {
  downloadLabel: React.ReactNode;
  onDownload: () => void;
  /** Called after any item: the menu closes. */
  onClose: () => void;
  teachLabel: React.ReactNode;
  /** Absent where the file cannot be taught (a receipt, an image, already marking). */
  onTeach?: () => void;
}): React.JSX.Element {
  const run = (action: () => void) => () => {
    onClose();
    action();
  };
  return (
    <div className="seneca-pdf-preview-modal__dropdown-menu">
      <button
        type="button"
        onClick={run(onDownload)}
        className="seneca-pdf-preview-modal__dropdown-item"
      >
        <Download className="seneca-pdf-preview-modal__dropdown-icon" strokeWidth={2.3} />
        <span className="seneca-pdf-preview-modal__dropdown-label">{downloadLabel}</span>
      </button>
      {onTeach ? (
        <button
          type="button"
          onClick={run(onTeach)}
          className="seneca-pdf-preview-modal__dropdown-item"
          data-testid="preview-teach-again"
        >
          <GraduationCap className="seneca-pdf-preview-modal__dropdown-icon" strokeWidth={2.3} />
          <span className="seneca-pdf-preview-modal__dropdown-label">{teachLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
