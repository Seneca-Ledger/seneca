'use client';

import type { ReactNode } from 'react';
import { useIntlayer } from '@/app/i18n';
import type { CategorizationRuleTestResult } from '@/app/lib/contracts';
import { fill } from './rule-text';

const PREVIEW_EXAMPLES = 5;

interface RulePreviewProps {
  /** Why there is nothing to preview yet, if there is a reason. */
  problem: ReactNode;
  preview: CategorizationRuleTestResult | undefined;
  /** The rule sets a category, so rows nobody filed by hand would be refiled. */
  setsCategory: boolean;
}

/** The rule dialog's live answer to "what would this rule match today?". */
export function RulePreview({ problem, preview, setsCategory }: RulePreviewProps) {
  const t = useIntlayer('categorizationRules');
  return (
    <section className="seneca-rule-dialog__preview" aria-live="polite">
      <span className="seneca-rule-dialog__label">{t.dialog.previewTitle}</span>
      {problem ? (
        <span className="seneca-rule-dialog__hint">{problem}</span>
      ) : preview ? (
        <>
          <span>
            {preview.matchedTransactions > 0
              ? fill(t.dialog.previewMatches.value, { count: preview.matchedTransactions })
              : t.dialog.previewNone}
          </span>
          {setsCategory && preview.overridable > 0 ? (
            <span className="seneca-rule-dialog__hint">
              {fill(t.dialog.previewOverridable.value, { count: preview.overridable })}
            </span>
          ) : null}
          {preview.matches.length > 0 && (
            <ul className="seneca-rule-dialog__examples">
              {preview.matches.slice(0, PREVIEW_EXAMPLES).map(match => (
                <li key={match.id}>
                  <span>{match.counterparty || match.purpose}</span>
                  <span className="seneca-rule-dialog__example-meta">
                    {match.date} · {match.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {preview.truncated ? (
            <span className="seneca-rule-dialog__hint">{t.dialog.previewTruncated}</span>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
