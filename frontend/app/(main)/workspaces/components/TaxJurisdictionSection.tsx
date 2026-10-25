'use client';

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/app/lib/api';
import { APP_NAME } from '@/app/lib/brand';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { tokens } from '@/lib/theme-tokens';
import { SettingsSection } from './SettingsSection';
import {
  flagFor,
  formatRate,
  type Jurisdiction,
  type JurisdictionRate,
  ratesInForce,
  supportMailto,
  todayLocal,
} from './tax-jurisdiction.helpers';

interface TaxJurisdictionSectionProps {
  labels: {
    title: string;
    description: string;
    none: string;
    placeholder: string;
    ratesTitle: string;
    apply: string;
    applying: string;
    switchWarning: string;
    noRates: string;
    loadError: string;
    saveError: string;
    saved: string;
    disclaimer: string;
    reportError: string;
  };
}

function FlagIcon({ code }: { code: string }): React.ReactElement | null {
  const Flag = flagFor(code);
  if (!Flag) {
    return null;
  }
  return <Flag style={{ width: 20, height: 14, borderRadius: 2, flexShrink: 0 }} />;
}

/**
 * Picks the country a workspace files tax in.
 *
 * Kept out of WorkspaceOverviewView, which is already long: everything tax
 * related on this screen lives here, and the overview renders one element.
 */
export function TaxJurisdictionSection({
  labels,
}: TaxJurisdictionSectionProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [rates, setRates] = useState<JurisdictionRate[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<'load' | 'save' | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiQueryDecoded({ url: '/tax/jurisdictions', contract: 'TaxJurisdictionList' }),
      apiQueryDecoded({ url: '/tax/settings', contract: 'WorkspaceTaxSettings' }),
    ])
      .then(([list, settings]) => {
        if (cancelled) {
          return;
        }
        setJurisdictions(list);
        const code = settings.jurisdiction?.code ?? '';
        setCurrentCode(code);
        setSelectedCode(code);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed('load');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Previewed before anything is applied, so the choice is visible rather than
  // a surprise after saving.
  useEffect(() => {
    if (!selectedCode) {
      setRates([]);
      return;
    }

    let cancelled = false;
    const on = todayLocal();

    apiQueryDecoded({
      url: `/tax/jurisdictions/${selectedCode}/rates`,
      params: { date: on },
      contract: 'JurisdictionRateList',
    })
      .then(rates => {
        if (!cancelled) {
          setRates(ratesInForce(rates, on));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRates([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCode]);

  const handleApply = useCallback(async () => {
    setSaving(true);
    setFailed(null);
    setSaved(false);

    await (async () => {
      await apiClient.put('/tax/settings/jurisdiction', {
        code: selectedCode,
      } satisfies ContractInput<'SetJurisdictionBody'>);
      setCurrentCode(selectedCode);
      setSaved(true);
    })()
      .catch(async () => {
        setFailed('save');
      })
      .finally(async () => {
        setSaving(false);
      });
  }, [selectedCode]);

  const isSwitch = Boolean(currentCode) && selectedCode !== currentCode;
  const isDirty = selectedCode !== '' && selectedCode !== currentCode;
  const mailto = supportMailto(`${APP_NAME} — tax rate correction`);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // A flat section like the rest of the Overview tab, not a card of its own.
  return (
    <SettingsSection title={labels.title} description={labels.description}>
      <Stack spacing={2}>
        {failed === 'load' ? <Alert severity="error">{labels.loadError}</Alert> : null}
        {failed === 'save' ? <Alert severity="error">{labels.saveError}</Alert> : null}
        {saved ? <Alert severity="success">{labels.saved}</Alert> : null}

        <Select
          value={selectedCode}
          onChange={event => {
            setSelectedCode(event.target.value);
            setSaved(false);
          }}
          displayEmpty
          size="small"
          inputProps={{ 'aria-label': labels.title }}
          sx={{ maxWidth: 360, borderRadius: tokens.radius.md }}
        >
          <MenuItem value="">
            <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
              {labels.placeholder}
            </Typography>
          </MenuItem>
          {jurisdictions.map(jurisdiction => (
            <MenuItem key={jurisdiction.code} value={jurisdiction.code}>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: 'center',
                }}
              >
                <FlagIcon code={jurisdiction.code} />
                <span>{jurisdiction.name}</span>
                <Typography component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
                  {jurisdiction.taxName}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </Select>

        {isSwitch ? <Alert severity="warning">{labels.switchWarning}</Alert> : null}

        {selectedCode ? (
          <Box>
            <Typography sx={{ mb: 1, fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
              {labels.ratesTitle}
            </Typography>
            {rates.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                {labels.noRates}
              </Typography>
            ) : (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {rates.map(rate => (
                  <Chip
                    key={`${rate.code}-${rate.validFrom}`}
                    size="small"
                    label={`${rate.name} · ${formatRate(rate.rate)}`}
                    variant={rate.isDefault ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
            )}
          </Box>
        ) : null}

        <Box>
          <Button
            variant="contained"
            onClick={handleApply}
            disabled={!isDirty || saving}
            sx={{
              borderRadius: tokens.radius.md,
              fontWeight: 600,
              fontSize: 14,
              textTransform: 'none',
              px: 2.5,
              '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
            }}
          >
            {saving ? labels.applying : labels.apply}
          </Button>
        </Box>

        {/* Statutory figures are seeded by migration and can fall behind the law,
          so the screen says so where the numbers are shown rather than burying
          it in a help page. */}
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
          <Typography sx={{ fontSize: 12, lineHeight: 1.6, color: 'text.secondary' }}>
            {labels.disclaimer}
            {mailto ? (
              <>
                {' '}
                <Typography
                  component="a"
                  href={mailto}
                  sx={{ fontSize: 12, color: 'primary.main', textDecoration: 'underline' }}
                >
                  {labels.reportError}
                </Typography>
              </>
            ) : null}
          </Typography>
        </Box>
      </Stack>
    </SettingsSection>
  );
}
