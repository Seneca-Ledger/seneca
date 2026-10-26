'use client';

import { useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Plus } from '@/app/components/icons';
import { ImportFromFileButton } from '@/app/components/import-wizard/ImportFromFileButton';
import { Button } from '@/app/components/ui/button';
import { ReadOnlyHint } from '@/app/components/versions/ReadOnlyHint';
import { useIntlayer } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import { StatementsToolbarButton } from './StatementsToolbarButton';
import { useStatementsQueue } from './statements-queue-context';

/**
 * Upload entry point in the statements page header: opens the scan drawer
 * straight away. The drawer's own tabs cover the manual expense. Hidden on a
 * phone, where the bottom bar's "+" offers the same. Beside it, a bank export
 * (CSV, XLSX) goes through the import wizard and becomes one statement.
 */
export function StatementsUploadButton(): React.JSX.Element {
  const t = useIntlayer('statementsPage');
  const { onScan } = useStatementsQueue();
  const queryClient = useQueryClient();

  return (
    <>
      <ImportFromFileButton
        target="transactions"
        onImported={() => void queryClient.invalidateQueries({ queryKey: ['statements'] })}
        renderTrigger={(open, label) => (
          <ReadOnlyHint>
            <StatementsToolbarButton onClick={open}>
              <FileSpreadsheet size={14} aria-hidden />
              {label}
            </StatementsToolbarButton>
          </ReadOnlyHint>
        )}
      />
      <ReadOnlyHint>
        <Button
          data-tour-id="statements-upload-trigger"
          className="seneca-bottom-bar-source"
          onClick={onScan}
        >
          <Plus size={18} aria-hidden />
          {resolveLabel(getNestedValue(t, ['uploadStatement']))}
        </Button>
      </ReadOnlyHint>
    </>
  );
}
