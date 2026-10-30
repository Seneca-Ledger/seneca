'use client';

import { Box, Button } from '@mui/material';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft } from '@/app/components/icons';
import { offerAction } from '@/app/components/payees/offer-action-toast';
import { LoadError } from '@/app/components/ui/load-error';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer } from '@/app/i18n';
import type { CategorizationRuleTestResult } from '@/app/lib/contracts';
import { RuleEditorForm } from './RuleEditorForm';
import { RuleMatchesTable } from './RuleMatchesTable';
import { seedFromParams, seedOf } from './rule-seed';
import { describeConditions, fill } from './rule-text';
import type { RuleDraftBody, RuleSeed } from './types';
import { useRuleNames } from './useRuleNames';
import { completeConditions, useApplyRule, useRule, useRulePreview, useSaveRule } from './useRules';

/**
 * How many existing rows applying the rule would change: every match when it
 * adds tags, else the matches nobody filed by hand when it sets a category.
 */
function rowsToApply(
  result: RuleSeed['result'],
  preview: CategorizationRuleTestResult | undefined,
) {
  if (!preview) {
    return 0;
  }
  if (result.tagIds?.length) {
    return preview.matchedTransactions;
  }
  return result.categoryId ? preview.overridable : 0;
}

/**
 * A rule on a page of its own: what it matches and sets on the left, the rows
 * it would match today beside it. `id` is `new` for a rule not saved yet,
 * which may start from `?payee=…&categoryId=…` (a row or a suggestion).
 */
export function RuleEditorView({ id }: { id: string }) {
  const isNew = id === 'new';
  const t = useIntlayer('categorizationRules');
  const router = useRouter();
  const params = useSearchParams();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('category.edit');
  const targets = useRuleNames();
  const { words, names } = targets;
  const saved = useRule(isNew ? null : id);
  const save = useSaveRule();
  const apply = useApplyRule();
  const [edited, setEdited] = useState<RuleSeed | null>(null);

  // The form holds the user's edits; until the first one it shows the rule as loaded.
  const loaded = isNew
    ? seedFromParams(new URLSearchParams(params.toString()))
    : saved.data && seedOf(saved.data);
  const draft = edited ?? loaded ?? null;
  const preview = useRulePreview(draft?.conditions ?? [], isNew ? null : id);

  if (!isNew && saved.isError) {
    return (
      <Box component="main" sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 24px)' }}>
        <LoadError>{t.editor.notFound}</LoadError>
      </Box>
    );
  }

  const conditions = completeConditions(draft?.conditions ?? []);
  const result = draft?.result ?? {};
  const hasAction =
    Boolean(result.categoryId) ||
    Boolean(result.walletId) ||
    result.ownerMemberId !== undefined ||
    Boolean(result.tagIds?.length);
  const problem =
    conditions.length === 0 ? t.dialog.needsCondition : hasAction ? null : t.dialog.needsAction;

  const handleSave = async () => {
    if (!draft || problem || save.isPending || !canEdit) {
      return;
    }
    const body: RuleDraftBody = {
      name: draft.name.trim() || describeConditions(conditions, words, names),
      conditions: conditions.map(condition =>
        condition.field === 'amount' ? { ...condition, value: Number(condition.value) } : condition,
      ),
      result: draft.result,
    };
    // Read before leaving the page: the preview is of what is being saved.
    const pending = rowsToApply(draft.result, preview.data);
    const tags = Boolean(draft.result.tagIds?.length);
    const rule = await save.mutateAsync({ id: draft.id, body }).catch(() => null);
    if (!rule) {
      toast.error(t.toast.saveFailed.value);
      return;
    }
    toast.success(t.toast.saved.value);
    router.push('/rules');
    if (pending > 0) {
      offerAction({
        message: fill((tags ? t.toast.applyOfferAll : t.toast.applyOffer).value, {
          count: pending,
        }),
        applyLabel: t.toast.apply.value,
        dismissLabel: t.toast.notNow.value,
        onApply: () =>
          void apply.mutateAsync(rule.id).then(
            done =>
              toast.success(
                done.tagged > 0
                  ? fill(t.toast.appliedAll.value, { applied: done.applied, tagged: done.tagged })
                  : fill(t.toast.applied.value, { count: done.applied }),
              ),
            () => toast.error(t.toast.applyFailed.value),
          ),
      });
    }
  };

  return (
    <Box
      component="main"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 24px)', pb: 3, width: '100%' }}
    >
      <NextLink href="/rules" className="seneca-rule-editor__back">
        <ChevronLeft size={18} aria-hidden />
        {t.editor.back}
      </NextLink>
      <h1 className="seneca-rule-editor__title">
        {isNew ? t.dialog.createTitle : (draft?.name ?? t.dialog.editTitle)}
      </h1>

      {draft && (
        <div className="seneca-rule-editor">
          <div className="seneca-rule-editor__form">
            <RuleEditorForm
              draft={draft}
              onChange={update => setEdited(current => update(current ?? draft))}
              targets={targets}
              onSubmit={() => void handleSave()}
            />
            <div className="seneca-rule-editor__actions">
              <Button
                component={NextLink}
                href="/rules"
                variant="text"
                sx={{ color: 'var(--text-muted)', fontWeight: 500 }}
              >
                {t.dialog.cancel}
              </Button>
              <Button
                type="button"
                variant={problem ? 'outlined' : 'contained'}
                onClick={() => void handleSave()}
                disabled={Boolean(problem) || save.isPending || !canEdit}
              >
                {t.dialog.save}
              </Button>
            </div>
          </div>
          <RuleMatchesTable
            problem={problem && conditions.length === 0 ? problem : null}
            preview={conditions.length > 0 ? preview.data : undefined}
            setsCategory={Boolean(result.categoryId)}
            categoryName={names.category}
          />
        </div>
      )}
    </Box>
  );
}
