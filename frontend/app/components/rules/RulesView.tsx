'use client';

import { Box, Button } from '@mui/material';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { ArrowsLineIcon } from '@/app/components/ui/empty-state-icons';
import { LoadError } from '@/app/components/ui/load-error';
import { PageTitle } from '@/app/components/ui/page-title';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer } from '@/app/i18n';
import { RuleSuggestions } from './RuleSuggestions';
import { RulesTable } from './RulesTable';
import { fill } from './rule-text';
import type { Rule } from './types';
import { useRuleNames } from './useRuleNames';
import {
  useApplyRule,
  useDeleteRule,
  useReorderRules,
  useRulesList,
  useToggleRule,
} from './useRules';

/**
 * The workspace's rules as a table, in the order they are tried, with the
 * rules worth adding above it. A rule opens on a page of its own; the old
 * `?focus=<id>` link goes there.
 */
export function RulesView() {
  const t = useIntlayer('categorizationRules');
  const router = useRouter();
  const { words, names } = useRuleNames();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('category.edit');
  const canDelete = hasPermission('category.delete');
  const rules = useRulesList();
  const toggle = useToggleRule();
  const remove = useDeleteRule();
  const reorder = useReorderRules();
  const apply = useApplyRule();
  const focusId = useSearchParams().get('focus');

  useEffect(() => {
    if (focusId) {
      router.replace(`/rules/${focusId}`);
    }
  }, [focusId, router]);

  const list = rules.data?.data ?? [];

  const handleDelete = (rule: Rule) =>
    void remove.mutateAsync(rule.id).then(
      () => toast.success(t.toast.deleted.value),
      () => toast.error(t.toast.deleteFailed.value),
    );

  const handleApply = (rule: Rule) =>
    void apply.mutateAsync(rule.id).then(
      done =>
        toast.success(
          done.tagged > 0
            ? fill(t.toast.appliedAll.value, { applied: done.applied, tagged: done.tagged })
            : fill(t.toast.applied.value, { count: done.applied }),
        ),
      () => toast.error(t.toast.applyFailed.value),
    );

  const handleReorder = (next: Rule[]) =>
    void reorder.mutateAsync(next).catch(() => toast.error(t.toast.orderFailed.value));

  const newRuleButton = (
    <Button component={NextLink} href="/rules/new" variant="contained">
      {t.page.newRule}
    </Button>
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
        {canEdit && list.length > 0 && newRuleButton}
      </Box>
      <p className="seneca-rules__intro">{t.page.intro}</p>

      {canEdit && <RuleSuggestions categoryName={names.category} />}

      {rules.isError && <LoadError>{t.page.loadError}</LoadError>}

      {rules.isSuccess && list.length === 0 && (
        <EmptyState
          fill
          icon={<ArrowsLineIcon />}
          title={t.page.emptyTitle}
          description={t.page.emptyHint}
          action={canEdit ? newRuleButton : undefined}
        />
      )}

      {list.length > 0 && (
        <>
          <p className="seneca-rules__order-hint">
            {canEdit ? t.page.orderHint : t.page.orderHintReadOnly}
          </p>
          <RulesTable
            rules={list}
            words={words}
            names={names}
            canEdit={canEdit}
            canDelete={canDelete}
            onReorder={handleReorder}
            onToggle={(rule, isActive) => void toggle.mutateAsync({ id: rule.id, isActive })}
            onApply={handleApply}
            onDelete={handleDelete}
            onEdit={rule => router.push(`/rules/${rule.id}`)}
          />
        </>
      )}
    </Box>
  );
}
