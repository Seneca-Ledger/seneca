'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, FileText } from '@/app/components/icons';
import { Spinner } from '@/app/components/ui/spinner';
import { apiBaseUrl } from '@/app/lib/api';
import { hasSessionCookie } from '@/app/lib/csrf';
import { getWorkspaceHeaders } from '@/app/lib/workspace-headers';

interface PdfThumbnailProps {
  fileId: string;
  fileName?: string;
  source?: 'statement' | 'gmail' | 'receipt';
  size?: number;
  width?: number;
  thumbnailWidth?: number;
  height?: number;
  className?: string;
  errorMessage?: string;
  preservePageAspect?: boolean;
  /** Desaturates the preview and drops the frame's shadow, for small inline
   * thumbnails (e.g. a list row) where a full-colour, framed crop would
   * outweigh the row's own content. */
  muted?: boolean;
}

const DEFAULT_THUMBNAIL_WIDTH = 200;
const MIN_THUMBNAIL_WIDTH = 80;
const MAX_THUMBNAIL_WIDTH = 1600;

const thumbnailCache = new Map<string, string>();

const SOURCE_THUMBNAIL_URLS: Record<string, (fileId: string, w: number) => string> = {
  gmail: (id, w) => `${apiBaseUrl}/integrations/gmail/receipts/${id}/thumbnail?width=${w}`,
  receipt: (id, w) => `${apiBaseUrl}/integrations/gmail/receipts/${id}/thumbnail?width=${w}`,
};

function buildThumbnailUrl(source: string, fileId: string, requestedWidth: number): string {
  const builder = SOURCE_THUMBNAIL_URLS[source];
  if (builder) {
    return builder(fileId, requestedWidth);
  }
  return `${apiBaseUrl}/statements/${fileId}/thumbnail?width=${requestedWidth}`;
}

function clampWidth(width: number | undefined): number {
  return Math.max(
    MIN_THUMBNAIL_WIDTH,
    Math.min(MAX_THUMBNAIL_WIDTH, Math.round(width ?? DEFAULT_THUMBNAIL_WIDTH)),
  );
}

interface FetchThumbnailParams {
  cacheKey: string;
  source: string;
  fileId: string;
  requestedWidth: number;
  isMounted: () => boolean;
  setThumbnailDataUrl: (v: string | null) => void;
  setError: (v: boolean) => void;
  setLoading: (v: boolean) => void;
}

async function fetchThumbnail(params: FetchThumbnailParams): Promise<void> {
  const {
    cacheKey,
    source,
    fileId,
    requestedWidth,
    isMounted,
    setThumbnailDataUrl,
    setError,
    setLoading,
  } = params;

  if (thumbnailCache.has(cacheKey)) {
    const cached = thumbnailCache.get(cacheKey);
    if (isMounted()) {
      if (cached) {
        setThumbnailDataUrl(cached);
      } else {
        setError(true);
      }
      setLoading(false);
    }
    return;
  }

  try {
    const headers = getWorkspaceHeaders();
    if (!hasSessionCookie()) {
      setError(true);
      setLoading(false);
      return;
    }

    const thumbnailUrl = buildThumbnailUrl(source, fileId, requestedWidth);
    const response = await fetch(thumbnailUrl, {
      method: 'GET',
      headers,
      credentials: 'include',
      cache: 'default',
    });

    if (!response.ok) {
      if (isMounted()) {
        setError(true);
        setLoading(false);
      }
      return;
    }

    const blob = await response.blob();
    const reader = new FileReader();
    reader.onloadend = (): void => {
      const base64data = reader.result as string;
      thumbnailCache.set(cacheKey, base64data);
      if (isMounted()) {
        setThumbnailDataUrl(base64data);
        setLoading(false);
      }
    };
    reader.readAsDataURL(blob);
  } catch {
    if (isMounted()) {
      setError(true);
      setLoading(false);
    }
  }
}

function useImageAspectRatio(
  thumbnailDataUrl: string | null,
  preservePageAspect: boolean,
  setImageAspectRatio: (v: number | null) => void,
): void {
  useEffect(() => {
    if (!(thumbnailDataUrl && preservePageAspect)) {
      setImageAspectRatio(null);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = (): void => {
      if (cancelled || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        return;
      }
      setImageAspectRatio(image.naturalWidth / image.naturalHeight);
    };
    image.onerror = (): void => {
      if (!cancelled) {
        setImageAspectRatio(null);
      }
    };
    image.src = thumbnailDataUrl;
    return (): void => {
      cancelled = true;
    };
  }, [thumbnailDataUrl, preservePageAspect, setImageAspectRatio]);
}

function useThumbnailFetch(
  fileId: string,
  source: string,
  requestedWidth: number,
  setThumbnailDataUrl: (v: string | null) => void,
  setError: (v: boolean) => void,
  setLoading: (v: boolean) => void,
): void {
  useEffect(() => {
    let mounted = true;
    const cacheKey = `${source}:${fileId}:${requestedWidth}`;
    void fetchThumbnail({
      cacheKey,
      source,
      fileId,
      requestedWidth,
      isMounted: () => mounted,
      setThumbnailDataUrl,
      setError,
      setLoading,
    });
    return (): void => {
      mounted = false;
    };
  }, [fileId, source, requestedWidth, setThumbnailDataUrl, setError, setLoading]);
}

interface PdfErrorViewProps {
  frameWidth: number;
  frameHeight: number;
  fallbackIconSize: number;
  errorMessage?: string;
}

function PdfErrorView(props: PdfErrorViewProps): React.ReactElement {
  const { frameWidth, frameHeight, fallbackIconSize, errorMessage } = props;

  if (errorMessage) {
    return (
      <div
        style={{
          width: frameWidth,
          height: frameHeight,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          border: '1px solid var(--border-color)',
          borderRadius: 0,
          backgroundColor: 'var(--card-bg)',
          padding: 16,
          textAlign: 'center',
        }}
      >
        <AlertCircle
          data-testid="pdf-thumbnail-error-icon"
          size={24}
          style={{ color: 'var(--muted-foreground)' }}
        />
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)', margin: 0 }}>{errorMessage}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: frameWidth,
        height: frameHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FileText
        data-testid="pdf-thumbnail-fallback-icon"
        size={fallbackIconSize}
        style={{ color: 'var(--muted-foreground)' }}
      />
    </div>
  );
}

export function PDFThumbnail(props: PdfThumbnailProps): React.ReactElement {
  const {
    fileId,
    fileName,
    source = 'statement',
    size = 40,
    width,
    thumbnailWidth,
    height,
    className = '',
    errorMessage,
    preservePageAspect = false,
    muted = false,
  } = props;
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

  const requestedWidth = clampWidth(thumbnailWidth ?? width);
  const frameWidth = width ?? size;
  const maxFrameHeight = height ?? size;
  const resolvedFrameHeight =
    preservePageAspect && imageAspectRatio
      ? Math.min(maxFrameHeight, Math.round(frameWidth / imageAspectRatio))
      : maxFrameHeight;

  useImageAspectRatio(thumbnailDataUrl, preservePageAspect, setImageAspectRatio);
  useThumbnailFetch(fileId, source, requestedWidth, setThumbnailDataUrl, setError, setLoading);

  if (error) {
    return (
      <PdfErrorView
        frameWidth={frameWidth}
        frameHeight={maxFrameHeight}
        fallbackIconSize={Math.max(14, Math.round(size * 0.8))}
        errorMessage={errorMessage}
      />
    );
  }

  return (
    <div
      data-testid="pdf-thumbnail-frame"
      style={{
        position: 'relative',
        boxShadow: muted ? undefined : '0 1px 2px 0 rgba(0,0,0,0.05)',
        borderRadius: 0,
        overflow: 'hidden',
        width: frameWidth,
        height: resolvedFrameHeight,
      }}
    >
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spinner size={16} sx={{ color: 'var(--text-secondary)' }} />
        </div>
      )}
      {thumbnailDataUrl && (
        <img
          src={thumbnailDataUrl}
          alt={fileName || 'PDF thumbnail'}
          className={className}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            imageRendering: 'auto',
            transition: 'opacity 0.2s',
            filter: muted ? 'grayscale(0.55) opacity(0.85)' : undefined,
          }}
        />
      )}
    </div>
  );
}
