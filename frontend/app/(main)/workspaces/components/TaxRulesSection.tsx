'use client';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { tokens } from '@/lib/theme-tokens';
import { SettingsSection } from './SettingsSection';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface WorkspaceRate {
  id: string;
  code: string | null;
  name: string;
  rate: string | number;
}

interface TaxRule {
  id: string;
  categoryId: string | null;
  taxRateCode: string;
  direction: 'expense' | 'income' | 'both';
  isEnabled: boolean;
}

const DIRECTIONS: Array<TaxRule['direction']> = ['both', 'expense', 'income'];

/** Our own failures are stored by kind and worded at render; server messages pass through. */
type RuleError = 'loadError' | 'addError' | 'deleteError' | { message: string };

/**
 * Category-to-rate rules.
 *
 * Rules name a rate code rather than a rate, which is why the picker offers
 * codes: a rule written today has to keep working after the law changes, and
 * the code is what spans every version of a rate.
 */
export function TaxRulesSection(): React.ReactElement {
  const t = useIntlayer('workspaceTaxRules');
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rates, setRates] = useState<WorkspaceRate[]>([]);
  const [draft, setDraft] = useState<{
    categoryId: string;
    taxRateCode: string;
    direction: TaxRule['direction'];
  }>({ categoryId: '', taxRateCode: '', direction: 'both' });
  const [error, setError] = useState<RuleError | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    await (async () => {
      const [rules, categories, rates] = await Promise.all([
        apiQueryDecoded({ url: '/tax/rules', contract: 'TaxRuleList' }),
        apiQueryDecoded({ url: '/categories', contract: 'CategoryList' }),
        apiQueryDecoded({ url: '/tax/settings/rates', contract: 'TaxRateList' }),
      ]);

      setRules(rules);
      setCategories(categories);
      // Only coded rates can be named by a rule; hand-made ones have no code.
      setRates(rates.filter(rate => Boolean(rate.code)));
      setError(null);
    })()
      .catch(async () => {
        setError('loadError');
      })
      .finally(async () => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addRule = async () => {
    setBusy(true);
    setError(null);

    await (async () => {
      await apiClient.post('/tax/rules', {
        categoryId: draft.categoryId || undefined,
        taxRateCode: draft.taxRateCode,
        direction: draft.direction,
      } satisfies ContractInput<'CreateTaxRuleBody'>);
      setDraft({ categoryId: '', taxRateCode: '', direction: 'both' });
      await load();
    })()
      .catch(async caught => {
        // The server rejects a duplicate category/direction pair and an unknown
        // rate code, and says which; passing that through beats a generic line.
        const message = (caught as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message;
        setError(message ? { message } : 'addError');
      })
      .finally(async () => {
        setBusy(false);
      });
  };

  const removeRule = async (id: string) => {
    setBusy(true);

    await (async () => {
      await apiClient.delete(`/tax/rules/${id}`);
      await load();
    })()
      .catch(async () => {
        setError('deleteError');
      })
      .finally(async () => {
        setBusy(false);
      });
  };

  const nameOfCategory = (id: string | null) =>
    id
      ? (categories.find(category => category.id === id)?.name ?? t.unknownCategory.value)
      : t.anyCategory.value;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // A flat section like the rest of the Overview tab, not a card of its own.
  return (
    <SettingsSection title={t.title} description={t.description}>
      <Stack spacing={2}>
        {error ? (
          <Alert severity="error">{typeof error === 'string' ? t[error] : error.message}</Alert>
        ) : null}

        {rates.length === 0 ? (
          <Alert severity="info">{t.needJurisdiction}</Alert>
        ) : (
          <>
            {rules.length > 0 ? (
              <Stack
                component="ul"
                spacing={1}
                sx={{ listStyle: 'none', m: 0, p: 0 }}
                aria-label={t.title.value}
              >
                {rules.map(rule => (
                  <Stack
                    component="li"
                    key={rule.id}
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    sx={{
                      borderRadius: tokens.radius.md,
                      border: '1px solid',
                      borderColor: 'divider',
                      px: 1.5,
                      py: 1,
                    }}
                  >
                    <Typography sx={{ fontSize: 14, flex: 1, color: 'text.primary' }}>
                      {nameOfCategory(rule.categoryId)}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                      {t.directions[rule.direction]}
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
                      {rule.taxRateCode}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label={t.deleteRule.value.replace(
                        '{name}',
                        nameOfCategory(rule.categoryId),
                      )}
                      disabled={busy}
                      onClick={() => removeRule(rule.id)}
                    >
                      ×
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{t.empty}</Typography>
            )}

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Select
                size="small"
                displayEmpty
                value={draft.categoryId}
                onChange={event => setDraft(d => ({ ...d, categoryId: event.target.value }))}
                inputProps={{ 'aria-label': t.categoryLabel.value }}
                sx={{ minWidth: 180, borderRadius: tokens.radius.md }}
              >
                <MenuItem value="">{t.anyCategory}</MenuItem>
                {categories.map(category => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>

              <Select
                size="small"
                displayEmpty
                value={draft.taxRateCode}
                onChange={event => setDraft(d => ({ ...d, taxRateCode: event.target.value }))}
                inputProps={{ 'aria-label': t.rateLabel.value }}
                sx={{ minWidth: 180, borderRadius: tokens.radius.md }}
              >
                <MenuItem value="">{t.chooseRate}</MenuItem>
                {rates.map(rate => (
                  <MenuItem key={rate.id} value={rate.code ?? ''}>
                    {rate.name}
                  </MenuItem>
                ))}
              </Select>

              <Select
                size="small"
                value={draft.direction}
                onChange={event =>
                  setDraft(d => ({ ...d, direction: event.target.value as TaxRule['direction'] }))
                }
                inputProps={{ 'aria-label': t.directionLabel.value }}
                sx={{ minWidth: 130, borderRadius: tokens.radius.md }}
              >
                {DIRECTIONS.map(direction => (
                  <MenuItem key={direction} value={direction}>
                    {t.directions[direction]}
                  </MenuItem>
                ))}
              </Select>

              <Button
                variant="contained"
                onClick={addRule}
                disabled={busy || !draft.taxRateCode}
                sx={{ borderRadius: tokens.radius.md, textTransform: 'none', fontWeight: 600 }}
              >
                {t.addRule}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </SettingsSection>
  );
}
