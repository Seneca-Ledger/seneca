'use client';

import { Box, Button, Switch } from '@mui/material';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { formatDate } from '@/app/components/transactions/helpers/transactionFormatters';
import { useWorkspaceMembers } from '@/app/components/transactions/hooks/useWorkspaceMembers';
import { OWNER_SHARED } from '@/app/components/transactions/OwnerFilterDropdown';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { ArrowsLineIcon } from '@/app/components/ui/empty-state-icons';
import { LoadError } from '@/app/components/ui/load-error';
import { PageTitle } from '@/app/components/ui/page-title';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer, useLocale } from '@/app/i18n';
import { useCategoryName } from '@/app/lib/use-category-name';
import { RuleFormDialog } from './RuleFormDialog';
import { describeConditions, describeResult, fill } from './rule-text';
import type { Rule, RuleSeed } from './types';
import { useDeleteRule, useRulesList, useRuleTargets, useToggleRule } from './useRules';
import { useRuleWords } from './useRuleWords';

function seedOf(rule: Rule): RuleSeed {
  return {
    id: rule.id,
    name: rule.name,
    conditions: [...rule.conditions],
    result: {
      categoryId: rule.result.categoryId,
      walletId: rule.result.walletId,
      ...(rule.result.ownerMemberId === undefined
        ? {}
        : { ownerMemberId: rule.result.ownerMemberId }),
    },
    priority: rule.priority,
  };
}

/**
 * The workspace's categorization rules: what each one matches, what it sets,
 * how often it fired. `?focus=<id>` opens one, for the link from a row the
 * rule filed.
 */
export function RulesView() {
  const t = useIntlayer('categorizationRules');
  const { locale } = useLocale();
  const words = useRuleWords();
  const categoryName = useCategoryName();
  const members = useWorkspaceMembers();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('category.edit');
  const canDelete = hasPermission('category.delete');
  const rules = useRulesList();
  const { categories, wallets } = useRuleTargets();
  const toggle = useToggleRule();
  const remove = useDeleteRule();
  const [editing, setEditing] = useState<RuleSeed | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const focusId = useSearchParams().get('focus');

  const list = rules.data?.data ?? [];

  // Opens once per focus id, not again after every refetch of the list.
  const openedFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!(focusId && canEdit) || openedFocus.current === focusId) {
      return;
    }
    const focused = list.find(rule => rule.id === focusId);
    if (focused) {
      openedFocus.current = focusId;
      setEditing(seedOf(focused));
      setDialogOpen(true);
    }
  }, [focusId, list, canEdit]);

  const ownerName = (memberId: string) =>
    memberId === OWNER_SHARED
      ? words.shared
      : (members.find(member => member.memberId === memberId)?.label ?? null);
  const names = {
    category: (id: string) => {
      const category = categories.find(candidate => candidate.id === id);
      return category ? categoryName(category.name) : null;
    },
    wallet: (id: string) => wallets.find(wallet => wallet.id === id)?.name ?? null,
    owner: ownerName,
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleDelete = (rule: Rule) =>
    void remove.mutateAsync(rule.id).then(
      () => toast.success(t.toast.deleted.value),
      () => toast.error(t.toast.deleteFailed.value),
    );

  return (
    <Box
      component="main"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 24px)', pb: 3, width: '100%' }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          mb: 1,
        }}
      >
        <PageTitle path="/rules" />
        {canEdit && list.length > 0 && (
          <Button variant="contained" onClick={openNew}>
            {t.page.newRule}
          </Button>
        )}
      </Box>
      <p className="seneca-rules__intro">{t.page.intro}</p>

      {rules.isError && <LoadError>{t.page.loadError}</LoadError>}

      {rules.isSuccess && list.length === 0 && (
        <EmptyState
          fill
          icon={<ArrowsLineIcon />}
          title={t.page.emptyTitle}
          description={t.page.emptyHint}
          action={
            canEdit ? (
              <Button variant="contained" onClick={openNew}>
                {t.page.newRule}
              </Button>
            ) : undefined
          }
        />
      )}

      {list.length > 0 && (
        <ul className="seneca-rules__list">
          {list.map(rule => (
            <li
              key={rule.id}
              className={['seneca-rules__row', !rule.isActive && 'seneca-rules__row--paused']
                .filter(Boolean)
                .join(' ')}
            >
              <div className="seneca-rules__body">
                <span className="seneca-rules__name">
                  {rule.name}
                  {!rule.isActive && <span className="seneca-rules__paused">{t.page.paused}</span>}
                </span>
                <span className="seneca-rules__line">
                  <span className="seneca-rules__key">{t.page.when}</span>{' '}
                  {describeConditions(rule.conditions, words, ownerName)}
                </span>
                <span className="seneca-rules__line">
                  <span className="seneca-rules__key">{t.page.thenLabel}</span>{' '}
                  {describeResult(rule.result, words, names)}
                </span>
                <span className="seneca-rules__stats">
                  {rule.matchCount > 0
                    ? [
                        fill(t.page.matched.value, { count: rule.matchCount }),
                        rule.lastMatchedAt
                          ? fill(t.page.lastMatched.value, {
                              date: formatDate(rule.lastMatchedAt, locale),
                            })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(', ')
                    : t.page.neverMatched}
                </span>
              </div>
              <div className="seneca-rules__controls">
                {canEdit && (
                  <Switch
                    size="small"
                    checked={rule.isActive}
                    onChange={event =>
                      void toggle.mutateAsync({ id: rule.id, isActive: event.target.checked })
                    }
                    slotProps={{ input: { 'aria-label': `${t.page.toggle.value}: ${rule.name}` } }}
                  />
                )}
                {canEdit && (
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => {
                      setEditing(seedOf(rule));
                      setDialogOpen(true);
                    }}
                  >
                    {t.page.edit}
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => handleDelete(rule)}
                    sx={{ color: 'var(--text-muted)' }}
                  >
                    {t.page.delete}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <RuleFormDialog open={dialogOpen} seed={editing} onClose={() => setDialogOpen(false)} />
    </Box>
  );
}
