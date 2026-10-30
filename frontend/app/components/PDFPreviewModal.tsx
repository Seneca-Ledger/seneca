'use client';

import { type ChangeEvent, type ComponentType, useEffect, useRef, useState } from 'react';
import { MoreVertical, X } from '@/app/components/icons';
import { SnapshotSkeleton } from '@/app/components/ui/snapshot-skeleton/SnapshotSkeleton';
import { useIntlayer } from '@/app/i18n';
import { apiBaseUrl } from '@/app/lib/api';
import { hasSessionCookie } from '@/app/lib/csrf';
import { getWorkspaceHeaders } from '@/app/lib/workspace-headers';
import { downloadFile } from './pdf-preview/download-file';
import { PreviewMenu } from './pdf-preview/PreviewMenu';
import { configureBundledPdfWorker } from './pdf-preview/pdf-worker';
import { TeachOverlay } from './pdf-teach/TeachOverlay';
import { TeachToolbar } from './pdf-teach/TeachToolbar';
import { useTeachMode } from './pdf-teach/useTeachSession';
import { ModalShell } from './ui/modal-shell';

type ReactPdfComponentProps = Record<string, unknown>;

type ReactPdfModule = {
  Document: ComponentType<ReactPdfComponentProps>;
  Page: ComponentType<ReactPdfComponentProps>;
  pdfjs: {
    version: string;
    GlobalWorkerOptions: {
      workerSrc: string;
    };
  };
};

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  source?: 'statement' | 'receipt';
  allowAttachFile?: boolean;
  onFileAttached?: () => void;
  onParsingStarted?: () => void;
  /** Marking mode: the user tags areas of a statement its parser could not read. */
  teach?: boolean;
}

const isJsdomEnvironment = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

export function getFileEndpoint(source: 'statement' | 'receipt', fileId: string): string {
  if (source === 'receipt') {
    return `${apiBaseUrl}/receipts/${fileId}/file`;
  }

  return `${apiBaseUrl}/statements/${fileId}/file`;
}

// Dynamic import kept outside the component: React Compiler cannot compile
// functions containing `import()` expressions.
const loadReactPdf = (): Promise<ReactPdfModule> => import('react-pdf') as Promise<ReactPdfModule>;

export function PDFPreviewModal({
  isOpen,
  onClose,
  fileId,
  fileName,
  source = 'statement',
  allowAttachFile = false,
  onFileAttached,
  onParsingStarted,
  teach = false,
}: PdfPreviewModalProps) {
  const t = useIntlayer('pdfPreviewModal');
  const teachText = useIntlayer('pdfTeach');
  const { teaching, session, teachAgain } = useTeachMode(isOpen, teach, fileId);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [fileContentType, setFileContentType] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(920);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pdfModule, setPdfModule] = useState<ReactPdfModule | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [attachingFile, setAttachingFile] = useState(false);
  const [showParsePrompt, setShowParsePrompt] = useState(false);
  const [startingParsing, setStartingParsing] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);

  const DocumentComponent = pdfModule?.Document;
  const PageComponent = pdfModule?.Page;
  const isImagePreview = Boolean(fileContentType?.startsWith('image/'));
  const isStoreReceiptImagePreview = isImagePreview && source === 'receipt';
  const canTeachAgain =
    source === 'statement' && Boolean(pdfObjectUrl) && !isImagePreview && !teaching;

  useEffect(() => {
    if (!isOpen) {
      setPdfObjectUrl(null);
      setFileContentType(null);
      setNumPages(0);
      setLoading(false);
      setError(null);
      setMenuOpen(false);
      setShowParsePrompt(false);
      setAttachingFile(false);
      setStartingParsing(false);
      return;
    }

    let cancelled = false;
    let localObjectUrl: string | null = null;

    const fetchPdf = async () => {
      return await (async () => {
        setLoading(true);
        setError(null);

        const headers = getWorkspaceHeaders();
        if (!hasSessionCookie()) {
          setError(t.errors.authRequired.value);
          setLoading(false);
          return;
        }

        const fileEndpoint = getFileEndpoint(source, fileId);

        const response = await fetch(fileEndpoint, {
          method: 'GET',
          headers,
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`${t.errors.fileLoadError.value}: ${response.status}`);
        }

        const blob = await response.blob();
        const contentType = response.headers?.get?.('content-type') || blob.type || '';
        localObjectUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setFileContentType(contentType);
          setPdfObjectUrl(localObjectUrl);
          setLoading(false);
        }
      })().catch(async err => {
        console.error('Error loading PDF:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t.errors.fileLoadFailed.value);
          setLoading(false);
        }
      });
    };

    fetchPdf();

    return () => {
      cancelled = true;
      if (localObjectUrl) {
        URL.revokeObjectURL(localObjectUrl);
      }
    };
  }, [isOpen, fileId, source, reloadToken]);

  useEffect(() => {
    if (!isOpen || pdfModule || isJsdomEnvironment) {
      return;
    }

    let active = true;

    const loadPdfRenderer = async () => {
      await (async () => {
        const module = await loadReactPdf();
        configureBundledPdfWorker(module.pdfjs);
        if (active) {
          setPdfModule(module);
        }
      })().catch(async err => {
        console.error('Error loading PDF renderer:', err);
        if (active) {
          setError(t.errors.pdfRendererFailed.value);
        }
      });
    };

    loadPdfRenderer();

    return () => {
      active = false;
    };
  }, [isOpen, pdfModule]);

  useEffect(() => {
    if (!(isOpen && viewportRef.current)) {
      return;
    }

    const node = viewportRef.current;

    const updatePageWidth = () => {
      const width = Math.floor(node.clientWidth - 120);
      setPageWidth(Math.max(520, Math.min(1080, width)));
    };

    updatePageWidth();

    const observer = new ResizeObserver(updatePageWidth);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [menuOpen]);

  const handleDownload = () =>
    downloadFile(
      getFileEndpoint(source, fileId),
      fileName,
      { authRequired: t.errors.authRequired.value, failed: t.errors.downloadAlertFailed.value },
      alert,
    );

  const handleAttachClick = () => {
    attachInputRef.current?.click();
  };

  const handleAttachFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile) {
      return;
    }

    return await (async () => {
      const headers = getWorkspaceHeaders();
      if (!hasSessionCookie()) {
        setError(t.errors.authRequired.value);
        return;
      }

      setAttachingFile(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${apiBaseUrl}/statements/${fileId}/attach-file`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(t.errors.uploadFailed.value);
      }

      setError(null);
      onFileAttached?.();
      setShowParsePrompt(true);
      setReloadToken(prev => prev + 1);
    })()
      .catch(async err => {
        setError(err instanceof Error ? err.message : t.errors.uploadFailed.value);
      })
      .finally(async () => {
        setAttachingFile(false);
      });
  };

  const handleStartReplaceParsing = async () => {
    return await (async () => {
      const headers = getWorkspaceHeaders();
      if (!hasSessionCookie()) {
        setError(t.errors.authRequired.value);
        return;
      }

      setStartingParsing(true);
      const response = await fetch(`${apiBaseUrl}/statements/${fileId}/reprocess?mode=replace`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(t.errors.parsingFailed.value);
      }

      setShowParsePrompt(false);
      onParsingStarted?.();
    })()
      .catch(async err => {
        setError(err instanceof Error ? err.message : t.errors.parsingFailed.value);
      })
      .finally(async () => {
        setStartingParsing(false);
      });
  };

  const showAttachFallback = allowAttachFile && source === 'statement';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      showCloseButton={false}
      className="seneca-pdf-preview-modal__shell"
      contentSx={{ height: '100%', padding: 0 }}
    >
      <div className="seneca-pdf-preview-modal__body">
        <div className="seneca-pdf-preview-modal__header" ref={menuRef}>
          <h2 className="seneca-pdf-preview-modal__title">
            {teaching ? teachText.title : t.receiptTitle}
          </h2>

          <div className="seneca-pdf-preview-modal__header-actions">
            <button
              type="button"
              onClick={() => setMenuOpen(prev => !prev)}
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
            <PreviewMenu
              downloadLabel={t.download}
              onDownload={handleDownload}
              onClose={() => setMenuOpen(false)}
              teachLabel={teachText.teachAgain}
              onTeach={canTeachAgain ? teachAgain : undefined}
            />
          )}
        </div>

        <div className="seneca-pdf-preview-modal__content">
          {loading && (
            <div className="seneca-pdf-preview-modal__loading-overlay">
              <SnapshotSkeleton id="pdf-preview" loading fallback="panel" />
            </div>
          )}

          {error && (
            <div className="seneca-pdf-preview-modal__error-overlay">
              <div className="seneca-pdf-preview-modal__error-body">
                <div className="seneca-pdf-preview-modal__error-icon-wrapper">
                  <X size={24} style={{ color: 'var(--destructive)' }} strokeWidth={1.5} />
                </div>
                <h3 className="seneca-pdf-preview-modal__error-title">
                  {showAttachFallback ? t.fileNotAttached.value : t.loadError.value}
                </h3>
                <p className="seneca-pdf-preview-modal__error-message">
                  {showAttachFallback ? t.uploadFileHint.value : error}
                </p>

                {showAttachFallback ? (
                  <div className="seneca-pdf-preview-modal__error-actions">
                    <input
                      ref={attachInputRef}
                      type="file"
                      accept="application/pdf,image/*,.csv,.xlsx,.xls,.docx,.ofx,.qfx,.qif,.xml,.mt940,.sta,.940"
                      onChange={handleAttachFile}
                      className="seneca-pdf-preview-modal__hidden-input"
                    />
                    <button
                      type="button"
                      onClick={handleAttachClick}
                      disabled={attachingFile}
                      className="seneca-pdf-preview-modal__btn-primary"
                    >
                      {attachingFile ? t.uploading.value : t.uploadFile.value}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="seneca-pdf-preview-modal__btn-secondary"
                    >
                      {t.close.value}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="seneca-pdf-preview-modal__btn-primary"
                  >
                    {t.close.value}
                  </button>
                )}
              </div>
            </div>
          )}

          {showParsePrompt && (
            <div className="seneca-pdf-preview-modal__parse-prompt-overlay">
              <div className="seneca-pdf-preview-modal__parse-prompt-card">
                <h3 className="seneca-pdf-preview-modal__parse-prompt-title">
                  {t.startParsing.value}
                </h3>
                <p className="seneca-pdf-preview-modal__parse-prompt-desc">
                  {t.startParsingDescription.value}
                </p>
                <div className="seneca-pdf-preview-modal__parse-prompt-actions">
                  <button
                    type="button"
                    onClick={() => setShowParsePrompt(false)}
                    disabled={startingParsing}
                    className="seneca-pdf-preview-modal__btn-secondary"
                  >
                    {t.decline.value}
                  </button>
                  <button
                    type="button"
                    onClick={handleStartReplaceParsing}
                    disabled={startingParsing}
                    className="seneca-pdf-preview-modal__btn-accent"
                  >
                    {startingParsing ? t.startingParsing.value : t.startParsingButton.value}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!error && pdfObjectUrl && isImagePreview && (
            <div ref={viewportRef} className="seneca-pdf-preview-modal__viewport">
              <div className="seneca-pdf-preview-modal__page-wrapper">
                <img
                  src={pdfObjectUrl}
                  alt={fileName}
                  className={
                    isStoreReceiptImagePreview
                      ? 'seneca-pdf-preview-modal__image-preview seneca-pdf-preview-modal__image-preview--receipt'
                      : 'seneca-pdf-preview-modal__image-preview'
                  }
                />
              </div>
            </div>
          )}

          {!error && pdfObjectUrl && !isImagePreview && DocumentComponent && PageComponent && (
            <div ref={viewportRef} className="seneca-pdf-preview-modal__viewport">
              <div className="seneca-pdf-preview-modal__pdf-wrapper">
                <DocumentComponent
                  file={pdfObjectUrl}
                  loading={null}
                  onLoadSuccess={({ numPages: loadedPages }: { numPages: number }) =>
                    setNumPages(loadedPages)
                  }
                  onLoadError={() => setError(t.errors.displayFailed.value)}
                  style={{ width: '100%' }}
                >
                  {Array.from({ length: numPages }, (_, index) => (
                    <div
                      key={`page_${index + 1}`}
                      className="seneca-pdf-preview-modal__pdf-page-wrap"
                    >
                      <PageComponent
                        pageNumber={index + 1}
                        width={pageWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        className="seneca-pdf-preview-modal__pdf-page"
                        onLoadSuccess={({ originalWidth }: { originalWidth: number }) =>
                          session.setPageWidth(index + 1, originalWidth)
                        }
                      />
                      {teaching && (
                        <TeachOverlay page={index + 1} width={pageWidth} session={session} />
                      )}
                    </div>
                  ))}
                </DocumentComponent>
              </div>
            </div>
          )}
        </div>
        {teaching && <TeachToolbar session={session} onDone={onClose} />}
      </div>
    </ModalShell>
  );
}
