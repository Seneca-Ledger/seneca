'use client';

import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import type React from 'react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import {
  DE_HOME_OFFICE_CAP_DAYS,
  DE_HOME_OFFICE_DAILY_EUR,
  deHomeOfficeAllowance,
} from '../tax-declaration.helpers';
import type { IncomeTaxProfile, TaxpayerType } from '../tax-declaration.types';
import { DeductionPreview } from './DeductionPreview';
import { FilingInfoCard } from './FilingInfoCard';

/** One-tap values under a number field; the last one is where the allowance tops out. */
function QuickValues({
  values,
  current,
  onPick,
}: {
  values: Array<{ value: number; label: React.ReactNode }>;
  current: unknown;
  onPick: (value: number) => void;
}): React.ReactElement {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
      {values.map(({ value, label }) => {
        const active = Number(current) === value;
        return (
          <Button
            key={value}
            size="small"
            variant="outlined"
            aria-pressed={active}
            onClick={() => onPick(value)}
            sx={{
              minWidth: 0,
              px: 1.25,
              py: 0.25,
              borderRadius: 999,
              textTransform: 'none',
              fontSize: 12,
              fontWeight: 500,
              color: active ? 'primary.main' : 'text.secondary',
              borderColor: active ? 'primary.main' : 'divider',
            }}
          >
            {label}
          </Button>
        );
      })}
    </Box>
  );
}

/** The value a profile field holds: medium weight, not a heading. */
const VALUE_SX = { fontSize: 18, fontWeight: 500 } as const;

/** A footnote that belongs to the form: a quiet panel, not a blue alert. */
function Note({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Box
      sx={{
        bgcolor: 'var(--surface-soft)',
        borderRadius: 1.5,
        px: 1.75,
        py: 1.25,
        fontSize: 13,
        color: 'var(--text-muted)',
      }}
    >
      {children}
    </Box>
  );
}

/** The form a Polish freelancer files follows from the taxation method chosen. */
const PL_REGIME_FORMS: Record<string, string> = {
  liniowy: 'PIT-36L',
  ryczalt: 'PIT-28',
  skala: 'PIT-36',
};

/** Label above a plain-value input, instead of MUI's floating notch label. */
function LabeledField({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Box>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.5 }}>{label}</Typography>
      {children}
    </Box>
  );
}

const ES_ACTIVITY_KEYS = [
  'A01',
  'A02',
  'A03',
  'A04',
  'A05',
  'B01',
  'B02',
  'B03',
  'B04',
  'B05',
  'B06',
];

interface ProfileStepProps {
  profile: IncomeTaxProfile;
  saving: boolean;
  onSave: (taxpayerType: TaxpayerType, details: Record<string, unknown>) => void;
  onNext: () => void;
}

/** Polish contributions go either to costs or to a deduction from income — never both. */
function TreatmentField({
  label,
  deductLabel,
  costLabel,
  value,
  onChange,
}: {
  label: React.ReactNode;
  deductLabel: React.ReactNode;
  costLabel: React.ReactNode;
  value: unknown;
  onChange: (value: 'deduct' | 'cost') => void;
}): React.ReactElement {
  return (
    <FormControl>
      <FormLabel>{label}</FormLabel>
      <RadioGroup
        row
        value={value === 'cost' ? 'cost' : 'deduct'}
        onChange={event => onChange(event.target.value as 'deduct' | 'cost')}
      >
        <FormControlLabel value="deduct" control={<Radio />} label={deductLabel} />
        <FormControlLabel value="cost" control={<Radio />} label={costLabel} />
      </RadioGroup>
    </FormControl>
  );
}

function numberOrUndefined(value: string): number | undefined {
  return value === '' ? undefined : Number(value);
}

export function ProfileStep({
  profile,
  saving,
  onSave,
  onNext,
}: ProfileStepProps): React.ReactElement {
  const t = useIntlayer('taxDeclarationPage');
  const { locale } = useLocale();
  const [taxpayerType, setTaxpayerType] = useState<TaxpayerType>(profile.taxpayerType);
  const [details, setDetails] = useState<Record<string, unknown>>(profile.details);

  const setDetail = (key: string, value: unknown): void =>
    setDetails(previous => ({ ...previous, [key]: value }));

  const dirty =
    taxpayerType !== profile.taxpayerType ||
    JSON.stringify(details) !== JSON.stringify(profile.details);

  if (!profile.country) {
    return (
      <Alert
        severity="info"
        action={
          <Button component={Link} href="/workspaces" size="small">
            {t.openWorkspaceSettings}
          </Button>
        }
      >
        {t.noCountry}
      </Alert>
    );
  }

  const pack = profile.pack;
  const formKey = pack?.formKey;
  const showEdition =
    pack?.formEditionYear !== null &&
    pack?.formEditionYear !== undefined &&
    pack.formEditionYear < profile.taxYear;

  const isDe = formKey === 'de-euer';
  const isEs = formKey === 'es-modelo100-eds';
  const isPlSelfEmployed = profile.country.code === 'PL' && taxpayerType === 'self_employed';
  const hasAllowances = isDe || isEs || isPlSelfEmployed;
  const allowance = deHomeOfficeAllowance(details);
  // Only the German pack shows money here, and its currency is always EUR.
  const currency = profile.currency ?? 'EUR';

  // Once a Polish freelancer has picked a method, only its form is shown up front.
  const regime = typeof details.regime === 'string' ? details.regime : null;
  const chosenForm =
    isPlSelfEmployed && regime && PL_REGIME_FORMS[regime]
      ? {
          code: PL_REGIME_FORMS[regime],
          label: {
            liniowy: t.plRegimeLiniowy,
            ryczalt: t.plRegimeRyczalt,
            skala: t.plRegimeSkala,
          }[regime] as React.ReactNode,
        }
      : undefined;

  const sidePanel =
    isDe || profile.filingInfo ? (
      <Stack spacing={3} sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
        {isDe ? <DeductionPreview allowance={allowance} currency={currency} /> : null}
        {profile.filingInfo ? (
          <FilingInfoCard info={profile.filingInfo} chosenForm={chosenForm} />
        ) : null}
      </Stack>
    ) : null;

  // Settings on the left; on wide screens a sticky column on the right shows
  // what the entries amount to and when things are due.
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        alignItems: 'start',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(300px, 380px)' },
      }}
    >
      <Stack spacing={3}>
        <Card>
          <CardHeader style={{ padding: 16, paddingBottom: 8 }}>
            <CardTitle>{t.filingProfileCardTitle}</CardTitle>
          </CardHeader>
          <CardContent style={{ paddingTop: 8 }}>
            <Stack spacing={3}>
              <Box>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                  {t.countryLabel}
                </Typography>
                <Typography sx={VALUE_SX}>
                  {profile.country.name} ({profile.country.code}) · {profile.currency}
                </Typography>
              </Box>

              <FormControl>
                <FormLabel sx={{ mb: 1 }}>{t.taxpayerTypeLabel}</FormLabel>
                <ToggleButtonGroup
                  value={taxpayerType}
                  exclusive
                  onChange={(_event, value: TaxpayerType | null) => value && setTaxpayerType(value)}
                  aria-label={t.taxpayerTypeLabel.value}
                  sx={{
                    alignSelf: 'flex-start',
                    flexWrap: 'wrap',
                    // A soft neutral track; the picked option is a white chip with a
                    // hairline, no shadow and no icons.
                    bgcolor: 'var(--surface-soft)',
                    borderRadius: 999,
                    p: 0.5,
                    gap: 0.5,
                    '& .MuiToggleButtonGroup-grouped': {
                      border: '1px solid transparent',
                      borderRadius: 999,
                    },
                  }}
                >
                  {(
                    [
                      ['self_employed', t.typeSelfEmployed],
                      ['employee', t.typeEmployee],
                      ['company', t.typeCompany],
                    ] as const
                  ).map(([value, label]) => (
                    <ToggleButton
                      key={value}
                      value={value}
                      sx={{
                        textTransform: 'none',
                        px: 2,
                        fontWeight: 500,
                        borderRadius: '999px !important',
                        color: 'var(--text-muted)',
                        '&.Mui-selected, &.Mui-selected:hover': {
                          color: 'text.primary',
                          bgcolor: 'background.paper',
                          borderColor: 'divider',
                          boxShadow: 'none',
                        },
                      }}
                    >
                      {label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </FormControl>

              {pack ? (
                <Stack spacing={1}>
                  <Box>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                      {t.formLabel}
                    </Typography>
                    <Typography sx={VALUE_SX}>{pack.name}</Typography>
                  </Box>
                  {pack.isGeneric ? <Note>{t.genericNotice}</Note> : null}
                  {showEdition ? (
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                      {t.editionNotice} {pack.formEditionYear}
                    </Typography>
                  ) : null}
                  {pack.filingChannel ? (
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                      {t.filingChannelLabel}: {pack.filingChannel}
                    </Typography>
                  ) : null}
                </Stack>
              ) : null}

              {isDe ? (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={details.smallBusiness === true}
                      onChange={event => setDetail('smallBusiness', event.target.checked)}
                    />
                  }
                  label={t.deSmallBusiness}
                />
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        {hasAllowances ? (
          <Card>
            <CardHeader style={{ padding: 16, paddingBottom: 8 }}>
              <CardTitle>{t.allowancesCardTitle}</CardTitle>
            </CardHeader>
            <CardContent style={{ paddingTop: 8 }}>
              <Stack spacing={2.5}>
                {isDe ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 2,
                    }}
                  >
                    <LabeledField label={t.deHomeOfficeDays}>
                      <TextField
                        type="number"
                        placeholder="0"
                        value={details.homeOfficeDays ?? ''}
                        onChange={event =>
                          setDetail('homeOfficeDays', numberOrUndefined(event.target.value))
                        }
                        fullWidth
                        slotProps={{
                          htmlInput: { min: 0, max: 366 },
                        }}
                      />
                      <QuickValues
                        current={details.homeOfficeDays}
                        onPick={value => setDetail('homeOfficeDays', value)}
                        values={[
                          { value: 50, label: '50' },
                          { value: 100, label: '100' },
                          {
                            value: DE_HOME_OFFICE_CAP_DAYS,
                            label: (
                              <>
                                {t.quickMax} ({DE_HOME_OFFICE_CAP_DAYS})
                              </>
                            ),
                          },
                        ]}
                      />
                      {allowance.basis === 'days' ? (
                        <Typography sx={{ mt: 1, fontSize: 12, color: 'success.main' }}>
                          +{' '}
                          <PrivateAmount>
                            {formatMoney(
                              Math.min(
                                allowance.units * DE_HOME_OFFICE_DAILY_EUR,
                                allowance.amount,
                              ),
                              currency,
                              locale,
                            )}
                          </PrivateAmount>{' '}
                          {t.deductionHint}
                        </Typography>
                      ) : null}
                    </LabeledField>
                    <LabeledField label={t.deHomeStudyMonths}>
                      <TextField
                        type="number"
                        placeholder="0"
                        value={details.homeStudyMonths ?? ''}
                        onChange={event =>
                          setDetail('homeStudyMonths', numberOrUndefined(event.target.value))
                        }
                        fullWidth
                        slotProps={{
                          htmlInput: { min: 0, max: 12 },
                        }}
                      />
                      <QuickValues
                        current={details.homeStudyMonths}
                        onPick={value => setDetail('homeStudyMonths', value)}
                        values={[
                          { value: 6, label: '6' },
                          { value: 12, label: '12' },
                        ]}
                      />
                      {allowance.basis === 'study' ? (
                        <Typography sx={{ mt: 1, fontSize: 12, color: 'success.main' }}>
                          +{' '}
                          <PrivateAmount>
                            {formatMoney(allowance.amount, currency, locale)}
                          </PrivateAmount>{' '}
                          {t.deductionHint}
                        </Typography>
                      ) : null}
                    </LabeledField>
                  </Box>
                ) : null}

                {isEs ? (
                  <Stack spacing={2}>
                    <TextField
                      select
                      label={t.esActivityKey.value}
                      value={typeof details.activityKey === 'string' ? details.activityKey : ''}
                      onChange={event => setDetail('activityKey', event.target.value)}
                    >
                      {ES_ACTIVITY_KEYS.map(key => (
                        <MenuItem key={key} value={key}>
                          {key}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      type="number"
                      label={t.esPreviousTurnover.value}
                      value={details.previousYearTurnover ?? ''}
                      onChange={event =>
                        setDetail('previousYearTurnover', numberOrUndefined(event.target.value))
                      }
                      slotProps={{
                        htmlInput: { min: 0 },
                      }}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={details.singleClientReduction === true}
                          onChange={event =>
                            setDetail('singleClientReduction', event.target.checked)
                          }
                        />
                      }
                      label={t.esSingleClient}
                    />
                  </Stack>
                ) : null}

                {isPlSelfEmployed ? (
                  <Stack spacing={2}>
                    <TextField
                      select
                      label={t.plRegimeLabel.value}
                      helperText={t.plRegimeHint.value}
                      slotProps={{ inputLabel: { shrink: true } }}
                      value={typeof details.regime === 'string' ? details.regime : ''}
                      onChange={event => setDetail('regime', event.target.value)}
                    >
                      <MenuItem value="liniowy">{t.plRegimeLiniowy}</MenuItem>
                      <MenuItem value="ryczalt">{t.plRegimeRyczalt}</MenuItem>
                      <MenuItem value="skala">{t.plRegimeSkala}</MenuItem>
                    </TextField>
                    {details.regime === 'liniowy' || details.regime === 'skala' ? (
                      <TreatmentField
                        label={t.plZusTreatment}
                        deductLabel={t.plTreatmentDeduct}
                        costLabel={t.plTreatmentCost}
                        value={details.zusTreatment}
                        onChange={value => setDetail('zusTreatment', value)}
                      />
                    ) : null}
                    {details.regime === 'liniowy' ? (
                      <TreatmentField
                        label={t.plHealthTreatment}
                        deductLabel={t.plTreatmentDeduct}
                        costLabel={t.plTreatmentCost}
                        value={details.healthTreatment}
                        onChange={value => setDetail('healthTreatment', value)}
                      />
                    ) : null}
                    {details.regime === 'ryczalt' ? (
                      <TextField
                        type="number"
                        label={t.plPreviousRevenue.value}
                        value={details.previousYearRevenue ?? ''}
                        onChange={event =>
                          setDetail('previousYearRevenue', numberOrUndefined(event.target.value))
                        }
                        slotProps={{
                          htmlInput: { min: 0 },
                        }}
                      />
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        <Stack direction="row" spacing={1}>
          {/* Next is the step's way forward; Save only matters once something changed. */}
          <Button
            variant="outlined"
            disabled={!dirty || saving}
            onClick={() => onSave(taxpayerType, details)}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            {t.save}
          </Button>
          <Button
            variant="contained"
            disabled={dirty}
            onClick={onNext}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            {t.next}
          </Button>
        </Stack>
      </Stack>
      {sidePanel}
    </Box>
  );
}
