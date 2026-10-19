import { type ComponentType, useEffect, useState } from 'react';
import { configureBundledPdfWorker } from '../pdf-worker';

type ReactPdfModule = {
  Document: ComponentType<Record<string, unknown>>;
  Page: ComponentType<Record<string, unknown>>;
  pdfjs: { version: string; GlobalWorkerOptions: { workerSrc: string } };
};

export type { ReactPdfModule };

const isJsdomEnvironment = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

async function loadReactPdf(): Promise<ReactPdfModule> {
  const module = (await import('react-pdf')) as ReactPdfModule;
  configureBundledPdfWorker(module.pdfjs);
  return module;
}

type RendererParams = { isOpen: boolean; pdfRendererFailed: string };
type RendererResult = {
  DocumentComponent: ComponentType<Record<string, unknown>> | undefined;
  PageComponent: ComponentType<Record<string, unknown>> | undefined;
  rendererError: string | null;
};

export function usePDFRenderer({ isOpen, pdfRendererFailed }: RendererParams): RendererResult {
  const [pdfModule, setPdfModule] = useState<ReactPdfModule | null>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || pdfModule || isJsdomEnvironment) return;
    let active = true;
    void loadReactPdf()
      .then(m => {
        if (active) setPdfModule(m);
      })
      .catch(() => {
        if (active) setRendererError(pdfRendererFailed);
      });
    return (): void => {
      active = false;
    };
  }, [isOpen, pdfModule, pdfRendererFailed]);

  return { DocumentComponent: pdfModule?.Document, PageComponent: pdfModule?.Page, rendererError };
}
