'use client';

import type { ReactNode } from 'react';
import { formatDate } from '@/app/components/transactions/helpers/transactionFormatters';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { CategorizationRuleTestResult } from '@/app/lib/contracts';
import { formatMoney } from '@/app/lib/format-money';
import { fill } from './rule-text';

type Match = CategorizationRuleTestResult['matches'][number];

interface RuleMatchesTableProps {
  /** Why there is nothing to look up yet, if there is a reason. */
  problem: ReactNode;
  preview: CategorizationRuleTestResult | undefined;
  /** The rule sets a category, so rows nobody filed by hand would be refiled. */
  setsCategory: boolean;
  categoryName: (id: string) => string | null;
}

/** Money out with a typographic minus, money in as it is: the amount column of a match. */
function signedAmount(match: Match, locale: string): string {
  const value = Math.abs(Number(match.amount ?? 0));
  const money = formatMoney(value, match.currency, locale);
  return match.direction === 'expense' ? `−${money}` : money;
}

/**
 * The editor's answer to "what would this rule match today?": the counts, a
 * warning when a rule above takes every match, and the rows themselves.
 */
export function RuleMatchesTable({
  problem,
  preview,
  setsCategory,
  categoryName,
}: RuleMatchesTableProps) {
  const t = useIntlayer('categorizationRules');
  const { locale } = useLocale();

  if (problem || !preview) {
    return (
      <section className="seneca-rule-matches" aria-live="polite">
        <h2 className="seneca-rule-matches__title">{t.dialog.previewTitle}</h2>
        {problem ? <p className="seneca-rule-matches__hint">{problem}</p> : null}
      </section>
    );
  }

  const neverWins =
    preview.matchedTransactions > 0 && preview.shadowed === preview.matchedTransactions;
  return (
    <section className="seneca-rule-matches" aria-live="polite">
      <h2 className="seneca-rule-matches__title">{t.dialog.previewTitle}</h2>
      <p className="seneca-rule-matches__summary">
        {preview.matchedTransactions > 0
          ? fill(t.dialog.previewMatches.value, { count: preview.matchedTransactions })
          : t.dialog.previewNone}
      </p>
      {setsCategory && preview.overridable > 0 ? (
        <p className="seneca-rule-matches__hint">
          {fill(t.dialog.previewOverridable.value, { count: preview.overridable })}
        </p>
      ) : null}
      {neverWins ? (
        <p className="seneca-rule-matches__warning" role="status">
          {t.editor.neverWins}
        </p>
      ) : preview.shadowed > 0 ? (
        <p className="seneca-rule-matches__hint">
          {fill(t.editor.someShadowed.value, { count: preview.shadowed })}
        </p>
      ) : null}
      {preview.matches.length > 0 && (
        <div className="seneca-rule-matches__scroll">
          <table className="seneca-rule-matches__table">
            <thead>
              <tr>
                <th scope="col">{t.editor.colDate}</th>
                <th scope="col">{t.field.counterparty_name}</th>
                <th scope="col">{t.field.payment_purpose}</th>
                <th scope="col" className="seneca-rule-matches__num">
                  {t.field.amount}
                </th>
                <th scope="col">{t.editor.colCategory}</th>
              </tr>
            </thead>
            <tbody>
              {preview.matches.map(match => (
                <tr
                  key={match.id}
                  className={match.wonBy ? 'seneca-rule-matches__row--taken' : undefined}
                >
                  <td className="seneca-rule-matches__date">
                    {match.date ? formatDate(match.date, locale) : ''}
                  </td>
                  <td className="seneca-rule-matches__payee">{match.counterparty}</td>
                  <td className="seneca-rule-matches__purpose">{match.purpose}</td>
                  <td className="seneca-rule-matches__num">{signedAmount(match, locale)}</td>
                  <td>
                    {match.categoryId ? (categoryName(match.categoryId) ?? '') : ''}
                    {match.wonBy ? (
                      <span className="seneca-rule-matches__taken">
                        {fill(t.editor.wonBy.value, { name: match.wonBy.name })}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {preview.matchedTransactions > preview.matches.length ? (
        <p className="seneca-rule-matches__hint">
          {fill(t.editor.showingFirst.value, { count: preview.matches.length })}
        </p>
      ) : null}
      {preview.truncated ? (
        <p className="seneca-rule-matches__hint">{t.dialog.previewTruncated}</p>
      ) : null}
    </section>
  );
}
