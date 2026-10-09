'use client';

import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import { ImportWizardDialog } from './ImportWizardDialog';
import type { ImportRunResult } from './import-wizard-api';
import { fillTemplate } from './import-wizard-utils';
import { useImportSuggestion } from './useImportSuggestion';

export interface ImportSuggestionBannerProps {
  rows: string[][];
  enabled: boolean;
  /** Called after a successful import so the host can close its own dialog. */
  onImported?: (result: ImportRunResult) => void;
}

/**
 * Shown inside the custom-tables import dialog when the sheet looks like
 * payables, subscriptions, invoices, budgets or transactions: one click hands
 * the same rows to the entity import instead of a table.
 */
export function ImportSuggestionBanner(
  props: ImportSuggestionBannerProps,
): React.JSX.Element | null {
  const t = useIntlayer('importWizard');
  const suggestion = useImportSuggestion(props.rows, props.enabled);
  const [open, setOpen] = useState(false);

  if (!suggestion || suggestion.target === 'table') {
    return null;
  }
  const targetLabel = t.targets[suggestion.target].value;
  return (
    <>
      <p className="lumio-ct__hint lumio-iw__banner" data-testid="import-suggestion-banner">
        <span>{fillTemplate(t.banner.text.value, { target: targetLabel })}</span>{' '}
        <button type="button" className="lumio-iw__banner-action" onClick={() => setOpen(true)}>
          {fillTemplate(t.banner.action.value, { target: targetLabel })}
        </button>
      </p>
      {open && (
        <ImportWizardDialog
          isOpen
          onClose={() => setOpen(false)}
          rows={props.rows}
          fixedTarget={suggestion.target}
          onImported={props.onImported}
        />
      )}
    </>
  );
}
