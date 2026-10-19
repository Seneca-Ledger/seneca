import { useEffect, useState } from 'react';
import { hasSessionCookie } from '@/app/lib/csrf';
import { getWorkspaceHeaders } from '@/app/lib/workspace-headers';
import { getFileEndpoint } from '../helpers/pdf-endpoints';

export type PDFLoaderState = {
  pdfObjectUrl: string | null;
  fileContentType: string | null;
  loading: boolean;
  error: string | null;
  setError: (e: string | null) => void;
};

type LoadParams = { source: string; fileId: string; authRequired: string; fileLoadError: string };
type LoadResult = { objectUrl: string; contentType: string };

const resolveContentType = (res: Response, blob: Blob): string =>
  res.headers?.get?.('content-type') || blob.type || '';

async function loadPdfFile({
  source,
  fileId,
  authRequired,
  fileLoadError,
}: LoadParams): Promise<LoadResult> {
  const headers = getWorkspaceHeaders();
  if (!hasSessionCookie()) throw new Error(authRequired);
  const endpoint = getFileEndpoint(source as 'statement' | 'gmail' | 'receipt', fileId);
  const res = await fetch(endpoint, { method: 'GET', headers, credentials: 'include' });
  if (!res.ok) throw new Error(`${fileLoadError}: ${res.status}`);
  const blob = await res.blob();
  return { objectUrl: URL.createObjectURL(blob), contentType: resolveContentType(res, blob) };
}

export type PDFLoaderParams = {
  isOpen: boolean;
  fileId: string;
  source: string;
  reloadToken: number;
  authRequired: string;
  fileLoadError: string;
  fileLoadFailed: string;
};

export function usePDFLoader({
  isOpen,
  fileId,
  source,
  reloadToken,
  authRequired,
  fileLoadError,
  fileLoadFailed,
}: PDFLoaderParams): PDFLoaderState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [fileContentType, setFileContentType] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPdfObjectUrl(null);
      setFileContentType(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    void loadPdfFile({ source, fileId, authRequired, fileLoadError })
      .then(({ objectUrl, contentType }) => {
        createdUrl = objectUrl;
        if (!cancelled) {
          setPdfObjectUrl(objectUrl);
          setFileContentType(contentType);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : fileLoadFailed);
          setLoading(false);
        }
      });
    return (): void => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [isOpen, fileId, source, reloadToken, authRequired, fileLoadError, fileLoadFailed]);

  return { loading, error, pdfObjectUrl, fileContentType, setError };
}
