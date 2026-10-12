'use client';

import { isGmailStatement } from '@/app/(main)/statements/components/StatementsListView.utils';
import type { StatementParsingDetails } from '@/app/lib/contracts';
import { isManualExpenseStatement } from '@/app/lib/statement-status';
import { useStatementPreview } from '../../hooks/useStatementPreview';

interface StatementForPreview {
  id: string;
  source?: string;
  fileName: string;
  subject?: string;
  sender?: string;
  parsingDetails?: StatementParsingDetails | null;
}

function resolveAllowAttach(statement: StatementForPreview): boolean {
  const isReceipt = statement.source === 'gmail' || statement.source === 'scan';
  const isManual =
    !isReceipt &&
    isManualExpenseStatement(statement as Parameters<typeof isManualExpenseStatement>[0]);
  const attachCount = Number(statement.parsingDetails?.importPreview?.attachments ?? 0);
  const isEmptyManual =
    attachCount === 0 || statement.fileName?.toLowerCase().startsWith('manual-expense-');
  return isManual && isEmptyManual;
}

interface UsePreviewActionsResult {
  preview: ReturnType<typeof useStatementPreview>['preview'];
  closePreview: () => void;
  onIconClick: (statement: StatementForPreview) => void;
}

export function usePreviewActions(): UsePreviewActionsResult {
  const { preview, openPreview, closePreview } = useStatementPreview();

  const onIconClick = (statement: StatementForPreview): void => {
    const isReceipt = statement.source === 'gmail' || statement.source === 'scan';
    if (isReceipt) {
      openPreview({
        fileId: statement.id,
        fileName: statement.fileName || 'receipt.pdf',
        source: isGmailStatement(statement as Parameters<typeof isGmailStatement>[0])
          ? 'gmail'
          : 'receipt',
        allowAttachFile: false,
      });
      return;
    }
    openPreview({
      fileId: statement.id,
      fileName: statement.fileName,
      source: 'statement',
      allowAttachFile: resolveAllowAttach(statement),
    });
  };

  return { preview, closePreview, onIconClick };
}
