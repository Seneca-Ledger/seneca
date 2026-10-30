'use client';

import { Button } from '@mui/material';
import NextLink from 'next/link';
import { useViewPreference } from '@/app/components/transactions/hooks/useViewPreference';
import { useIntlayer } from '@/app/i18n';
import { newRuleHref } from './rule-seed';
import { fill } from './rule-text';
import { useRuleSuggestions } from './useRules';

type Dismissed = { dismissedSuggestions: string[] };

/** The payee ids this person waved away; anything else saved under the scope is ignored. */
function readDismissed(saved: Readonly<Record<string, unknown>>): Dismissed {
  const ids = saved.dismissedSuggestions;
  return {
    dismissedSuggestions: Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

/**
 * Rules worth adding, above the list: a payee filed under the same category by
 * hand again and again. "Make a rule" opens the editor with it filled in.
 */
export function RuleSuggestions({ categoryName }: { categoryName: (id: string) => string | null }) {
  const t = useIntlayer('categorizationRules');
  const { state, save } = useViewPreference('rules', readDismissed);
  // Asked once the dismissed list is known, so a dismissed one never flashes.
  const suggestions = useRuleSuggestions(state !== undefined);
  const dismissed = state?.dismissedSuggestions ?? [];
  const shown = (suggestions.data ?? []).filter(item => !dismissed.includes(item.payeeId));
  if (shown.length === 0) {
    return null;
  }

  return (
    <section className="seneca-rule-suggestions" aria-labelledby="rule-suggestions-title">
      <h2 id="rule-suggestions-title" className="seneca-rule-suggestions__title">
        {t.suggestions.title}
      </h2>
      <ul className="seneca-rule-suggestions__list">
        {shown.map(item => {
          const [condition] = item.conditions;
          return (
            <li key={item.payeeId} className="seneca-rule-suggestions__item">
              <span className="seneca-rule-suggestions__text">
                {fill(t.suggestions.line.value, {
                  payee: item.payeeName,
                  category: categoryName(item.categoryId) ?? '',
                  count: item.decidedCount,
                })}
              </span>
              <span className="seneca-rule-suggestions__actions">
                <Button
                  component={NextLink}
                  size="small"
                  variant="outlined"
                  href={newRuleHref({
                    payee: String(condition?.value ?? item.payeeName),
                    match: condition?.operator === 'equals' ? 'equals' : 'contains',
                    categoryId: item.categoryId,
                  })}
                >
                  {t.suggestions.make}
                </Button>
                <Button
                  size="small"
                  variant="text"
                  sx={{ color: 'var(--text-muted)' }}
                  onClick={() => save({ dismissedSuggestions: [...dismissed, item.payeeId] })}
                >
                  {t.suggestions.dismiss}
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
