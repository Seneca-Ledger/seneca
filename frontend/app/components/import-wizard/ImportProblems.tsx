'use client';

import { useIntlayer } from '@/app/i18n';
import type { ImportRunResult } from './import-wizard-api';
import { fillTemplate, problemRows } from './import-wizard-utils';

const MAX_PROBLEM_ROWS = 8;

/** The first rows a dry run or an import skipped or refused, each with its reason. */
export function ImportProblems({
  source,
  fieldLabel,
}: {
  source: ImportRunResult | null;
  fieldLabel: (key: string) => string;
}): React.JSX.Element | null {
  const t = useIntlayer('importWizard');
  const problems = source ? problemRows(source.rows) : [];
  if (!problems.length) {
    return null;
  }
  const reasonText = (reason: string | undefined) => {
    if (reason === 'duplicate' || reason === 'unchanged') {
      return t.reasons[reason].value;
    }
    return fillTemplate(t.reasons.invalid.value, { field: fieldLabel(reason ?? '') });
  };
  return (
    <div className="seneca-iw__problems">
      <p className="seneca-iw__label">{t.issuesTitle}</p>
      <ul>
        {problems.slice(0, MAX_PROBLEM_ROWS).map(row => (
          <li key={row.index}>
            <span className="seneca-iw__row-no">
              {fillTemplate(t.rowLabel.value, { row: row.index + 1 })}
            </span>
            <span>{reasonText(row.reason)}</span>
          </li>
        ))}
        {problems.length > MAX_PROBLEM_ROWS && <li>…</li>}
      </ul>
    </div>
  );
}
