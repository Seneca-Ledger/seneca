import { useIntlayer, useLocale } from '@/app/i18n';
import type { CategoryUsageCount } from '@/app/lib/contracts';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import type { Category } from '../category-labels';

/** What disabling a used category touches, for its confirm dialog. */
export function CategoryDisableMessage({
  category,
  usage,
}: {
  category: Category;
  usage: CategoryUsageCount;
}) {
  const t = useIntlayer('categoriesPage');
  const { locale } = useLocale();
  const [usedInBefore, usedInAfter = ''] = t.manage.disableDialog.usedIn.value.split('{name}');
  return (
    <span className="seneca-categories__confirm">
      <span>
        {usedInBefore}
        <strong>{getCategoryDisplayName(category, locale)}</strong>
        {usedInAfter}
      </span>
      <span>
        {(usage.transactions === 1
          ? t.manage.disableDialog.transactionsOne
          : t.manage.disableDialog.transactionsMany
        ).value.replace('{count}', String(usage.transactions))}
      </span>
      <span>
        {(usage.statements === 1
          ? t.manage.disableDialog.statementsOne
          : t.manage.disableDialog.statementsMany
        ).value.replace('{count}', String(usage.statements))}
      </span>
      <span>{t.manage.disableDialog.warning}</span>
    </span>
  );
}
