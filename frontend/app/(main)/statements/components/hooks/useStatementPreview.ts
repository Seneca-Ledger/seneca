import { useState } from 'react';

type PreviewSource = 'statement' | 'receipt';

export interface StatementPreviewState {
  isOpen: boolean;
  fileId: string | null;
  fileName: string;
  source: PreviewSource;
  allowAttachFile: boolean;
}

export interface UseStatementPreviewResult {
  preview: StatementPreviewState;
  openPreview: (params: {
    fileId: string;
    fileName: string;
    source: PreviewSource;
    allowAttachFile?: boolean;
  }) => void;
  closePreview: () => void;
}

const INITIAL_STATE: StatementPreviewState = {
  isOpen: false,
  fileId: null,
  fileName: '',
  source: 'statement',
  allowAttachFile: false,
};

export function useStatementPreview(): UseStatementPreviewResult {
  const [preview, setPreview] = useState<StatementPreviewState>(INITIAL_STATE);

  const openPreview = (params: {
    fileId: string;
    fileName: string;
    source: PreviewSource;
    allowAttachFile?: boolean;
  }) => {
    setPreview({
      isOpen: true,
      fileId: params.fileId,
      fileName: params.fileName,
      source: params.source,
      allowAttachFile: params.allowAttachFile ?? false,
    });
  };

  const closePreview = () => {
    setPreview(prev => ({ ...prev, isOpen: false, allowAttachFile: false }));
  };

  return { preview, openPreview, closePreview };
}
