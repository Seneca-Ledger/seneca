'use client';

import { Button } from '@/app/components/ui/button';
import { useIntlayer } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import { useStatementsQueue } from './statements-queue-context';

/**
 * Upload entry point in the statements page header: opens the scan drawer
 * straight away. The drawer's own tabs cover the manual expense.
 */
export function StatementsUploadButton(): React.JSX.Element {
  const t = useIntlayer('statementsPage');
  const { onScan } = useStatementsQueue();

  return (
    <Button data-tour-id="statements-upload-trigger" onClick={onScan}>
      {resolveLabel(getNestedValue(t, ['uploadStatement']), 'Upload statement')}
    </Button>
  );
}
