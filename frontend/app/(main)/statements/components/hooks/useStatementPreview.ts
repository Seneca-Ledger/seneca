import { useState } from 'react';
import type { StatementParsingDetails } from '@/app/lib/contracts';

type PreviewSource = 'statement' | 'receipt';

export interface StatementPreviewState {
  isOpen: boolean;
  fileId: string | null;
  fileName: string;
  source: PreviewSource;
  allowAttachFile: boolean;
  /** Marking mode: teach the parser a layout it could not read. */
  teach: boolean;
}

export interface PreviewParams {
  fileId: string;
  fileName: string;
  source: PreviewSource;
  allowAttachFile?: boolean;
  teach?: boolean;
}

export interface UseStatementPreviewResult {
  preview: StatementPreviewState;
  openPreview: (params: PreviewParams) => void;
  closePreview: () => void;
}

const INITIAL_STATE: StatementPreviewState = {
  isOpen: false,
  fileId: null,
  fileName: '',
  source: 'statement',
  allowAttachFile: false,
  teach: false,
};

export interface PreviewableStatement {
  id: string;
  source?: string;
  fileName: string;
  parsingDetails?: StatementParsingDetails | null;
}

/**
 * What a row's file opens as: a scan as its receipt; a manual expense without
 * a file offers to attach one; `teach` opens the marking mode.
 */
export function previewOf(statement: PreviewableStatement, mode?: 'teach'): PreviewParams {
  if (statement.source === 'scan') {
    return {
      fileId: statement.id,
      fileName: statement.fileName || 'receipt.pdf',
      source: 'receipt',
      allowAttachFile: false,
    };
  }
  const isManual = statement.fileName.toLowerCase().startsWith('manual-expense-');
  const attachCount = Number(statement.parsingDetails?.importPreview?.attachments ?? 0);
  return {
    fileId: statement.id,
    fileName: statement.fileName,
    source: 'statement',
    allowAttachFile: isManual && attachCount === 0,
    teach: mode === 'teach',
  };
}

export function useStatementPreview(): UseStatementPreviewResult {
  const [preview, setPreview] = useState<StatementPreviewState>(INITIAL_STATE);

  const openPreview = (params: PreviewParams) => {
    setPreview({
      isOpen: true,
      fileId: params.fileId,
      fileName: params.fileName,
      source: params.source,
      allowAttachFile: params.allowAttachFile ?? false,
      teach: params.teach ?? false,
    });
  };

  const closePreview = () => {
    setPreview(prev => ({ ...prev, isOpen: false, allowAttachFile: false }));
  };

  return { preview, openPreview, closePreview };
}
