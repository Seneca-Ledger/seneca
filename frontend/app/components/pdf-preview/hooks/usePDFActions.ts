import { type ChangeEvent, type RefObject, useRef, useState } from 'react';
import { hasSessionCookie } from '@/app/lib/csrf';
import { getWorkspaceHeaders } from '@/app/lib/workspace-headers';
import { apiBaseUrl, getFileEndpoint } from '../helpers/pdf-endpoints';

type DownloadParams = {
  source: string;
  fileId: string;
  fileName: string;
  authRequired: string;
  downloadFailed: string;
  downloadAlertFailed: string;
};
async function downloadPdfFile({
  source,
  fileId,
  fileName,
  authRequired,
  downloadFailed,
  downloadAlertFailed,
}: DownloadParams): Promise<void> {
  const headers = getWorkspaceHeaders();
  if (!hasSessionCookie()) {
    alert(authRequired);
    return;
  }
  try {
    const res = await fetch(getFileEndpoint(source as 'statement' | 'gmail' | 'receipt', fileId), {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) throw new Error(downloadFailed);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch {
    alert(downloadAlertFailed);
  }
}

type AttachParams = {
  fileId: string;
  formData: FormData;
  authRequired: string;
  uploadFailed: string;
};
async function attachPdfFile({
  fileId,
  formData,
  authRequired,
  uploadFailed,
}: AttachParams): Promise<void> {
  const headers = getWorkspaceHeaders();
  if (!hasSessionCookie()) throw new Error(authRequired);
  const res = await fetch(`${apiBaseUrl}/statements/${fileId}/attach-file`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) throw new Error(uploadFailed);
}

type ParseParams = { fileId: string; authRequired: string; parsingFailed: string };
async function startReplaceParsing({
  fileId,
  authRequired,
  parsingFailed,
}: ParseParams): Promise<void> {
  const headers = getWorkspaceHeaders();
  if (!hasSessionCookie()) throw new Error(authRequired);
  const res = await fetch(`${apiBaseUrl}/statements/${fileId}/reprocess?mode=replace`, {
    method: 'POST',
    headers,
    credentials: 'include',
  });
  if (!res.ok) throw new Error(parsingFailed);
}

export type PDFActionsMessages = {
  authRequired: string;
  downloadFailed: string;
  downloadAlertFailed: string;
  uploadFailed: string;
  parsingFailed: string;
};
type ActionsParams = {
  fileId: string;
  source: string;
  fileName: string;
  onFileAttached?: () => void;
  onParsingStarted?: () => void;
  setReloadToken: (fn: (p: number) => number) => void;
  msgs: PDFActionsMessages;
};
export type PDFActionsResult = {
  attachingFile: boolean;
  showParsePrompt: boolean;
  startingParsing: boolean;
  actionError: string | null;
  attachInputRef: RefObject<HTMLInputElement | null>;
  handleDownload: () => void;
  handleAttachClick: () => void;
  handleAttachFile: (e: ChangeEvent<HTMLInputElement>) => void;
  handleStartReplaceParsing: () => void;
  setShowParsePrompt: (v: boolean) => void;
};

export function usePDFActions({
  fileId,
  source,
  fileName,
  onFileAttached,
  onParsingStarted,
  setReloadToken,
  msgs,
}: ActionsParams): PDFActionsResult {
  const [attachingFile, setAttachingFile] = useState(false);
  const [showParsePrompt, setShowParsePrompt] = useState(false);
  const [startingParsing, setStartingParsing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);

  const handleDownload = (): void => {
    void downloadPdfFile({ source, fileId, fileName, ...msgs });
  };
  const handleAttachClick = (): void => {
    attachInputRef.current?.click();
  };

  const handleAttachFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = e.target.files?.[0];
    e.target.value = '';
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('file', selectedFile);
    setAttachingFile(true);
    void attachPdfFile({
      fileId,
      formData,
      authRequired: msgs.authRequired,
      uploadFailed: msgs.uploadFailed,
    })
      .then(() => {
        setActionError(null);
        onFileAttached?.();
        setShowParsePrompt(true);
        setReloadToken(p => p + 1);
      })
      .catch((err: unknown) => {
        setActionError(err instanceof Error ? err.message : msgs.uploadFailed);
      })
      .finally(() => {
        setAttachingFile(false);
      });
  };

  const handleStartReplaceParsing = (): void => {
    setStartingParsing(true);
    void startReplaceParsing({
      fileId,
      authRequired: msgs.authRequired,
      parsingFailed: msgs.parsingFailed,
    })
      .then(() => {
        setShowParsePrompt(false);
        onParsingStarted?.();
      })
      .catch((err: unknown) => {
        setActionError(err instanceof Error ? err.message : msgs.parsingFailed);
      })
      .finally(() => {
        setStartingParsing(false);
      });
  };

  return {
    attachingFile,
    showParsePrompt,
    startingParsing,
    actionError,
    attachInputRef,
    handleDownload,
    handleAttachClick,
    handleAttachFile,
    handleStartReplaceParsing,
    setShowParsePrompt,
  };
}
