'use client';

import Box from '@mui/material/Box';
import type { ReactNode } from 'react';
import { formatRate } from '@/app/(main)/workspaces/components/tax-jurisdiction.helpers';
import { Check } from '@/app/components/icons';
import { buildNavItems } from '@/app/components/navigation/helpers/navigation-config';
import { useIntlayer } from '@/app/i18n';
import { formatTimeZoneLabel } from '@/app/lib/timezone';
import { formatDate, resolveFirstDayOfWeek, resolveLocaleTag } from '@/app/lib/user-format';
import type { OnboardingStepKey } from '../lib/onboarding-flow';
import { countryName, useJurisdictions, useStandardRate } from '../lib/tax-countries';
import { type OnboardingText, useOnboardingText } from '../lib/useOnboardingText';
import type { OnboardingData } from '../useOnboardingWizard';
import { FlagIcon } from './FlagIcon';

interface OnboardingPreviewProps {
  stepKey: OnboardingStepKey;
  data: OnboardingData;
}

const overlineSx = {
  m: 0,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--muted-foreground)',
} as const;

function PreviewCard({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        p: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        bgcolor: 'var(--card-bg)',
        color: 'var(--foreground)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {children}
    </Box>
  );
}

/** Placeholder bar for a field that is still empty. */
function Ghost({ width }: { width: string }) {
  return <Box sx={{ height: 10, width, borderRadius: 999, bgcolor: 'var(--muted)' }} />;
}

function RegionPreview({ data, text }: { data: OnboardingData; text: OnboardingText }) {
  const today = new Date();
  const tag = resolveLocaleTag(data.locale);
  const firstDay = resolveFirstDayOfWeek({
    locale: data.locale,
    firstDayOfWeek: data.firstDayOfWeek,
  });
  const weekdayFormat = new Intl.DateTimeFormat(tag, { weekday: 'short' });
  // Any week will do for the names; 2026-11-01 is a Sunday.
  const days = Array.from({ length: 7 }, (_, offset) => {
    const weekday = (firstDay + offset) % 7;
    return { weekday, label: weekdayFormat.format(new Date(2026, 10, 1 + weekday)) };
  });
  let time = '';
  try {
    time = new Intl.DateTimeFormat(tag, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: data.timeZone ?? undefined,
    }).format(today);
  } catch {
    time = '';
  }

  return (
    <PreviewCard>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box component="p" sx={overlineSx}>
          {text(['preview', 'today'], 'Today')}
        </Box>
        <Box
          sx={{
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatDate(today, { locale: data.locale, dateFormat: data.dateFormat })}
        </Box>
        {data.timeZone ? (
          <Box sx={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
            {time ? `${time} · ` : ''}
            {formatTimeZoneLabel(data.timeZone, data.locale)}
          </Box>
        ) : null}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
        {days.map(day => {
          const isToday = day.weekday === today.getDay();
          return (
            <Box
              key={day.weekday}
              sx={{
                py: 1,
                textAlign: 'center',
                fontSize: 13,
                borderRadius: 'var(--radius-sm)',
                color: isToday ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                bgcolor: isToday ? 'var(--primary-fill)' : 'transparent',
                fontWeight: isToday ? 600 : 400,
              }}
            >
              {day.label}
            </Box>
          );
        })}
      </Box>
    </PreviewCard>
  );
}

function WorkspacePreview({ data, text }: { data: OnboardingData; text: OnboardingText }) {
  const { nav } = useIntlayer('navigation');
  // Experimental pages are off for a new account; the menu shows what they will see.
  const items = buildNavItems(nav as Parameters<typeof buildNavItems>[0]).filter(
    item => !item.experimental,
  );

  return (
    <PreviewCard>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ fontSize: 20, fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>
          {data.workspaceName.trim() || <Ghost width="60%" />}
        </Box>
        {data.workspaceCurrency ? (
          <Box
            sx={{
              px: 1.25,
              py: 0.25,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 999,
              border: '1px solid var(--border-color)',
              color: 'var(--muted-foreground)',
            }}
          >
            {data.workspaceCurrency}
          </Box>
        ) : null}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box component="p" sx={overlineSx}>
          {text(['preview', 'menuTitle'], 'Your menu')}
        </Box>
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {items.map(item => {
            // Until a profile is chosen, show the business menu — the one a workspace gets by default.
            const hidden = item.businessOnly && data.profile === 'home';
            return (
              <Box
                component="li"
                key={item.path}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 0.75,
                  fontSize: 14,
                  color: 'var(--foreground)',
                  opacity: hidden ? 0.25 : 1,
                  textDecoration: hidden ? 'line-through' : 'none',
                  transition: 'opacity 200ms ease',
                  '& svg': { color: 'var(--muted-foreground)' },
                }}
              >
                {item.icon}
                {item.label}
              </Box>
            );
          })}
        </Box>
      </Box>
    </PreviewCard>
  );
}

function UnlockRow({ children }: { children: ReactNode }) {
  return (
    <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontSize: 14 }}>
      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--primary)' }}>
        <Check size={18} />
      </Box>
      {children}
    </Box>
  );
}

function TaxPreview({ data, text }: { data: OnboardingData; text: OnboardingText }) {
  const jurisdictions = useJurisdictions();
  const rate = useStandardRate(data.taxCountry);
  const jurisdiction = jurisdictions.data?.find(item => item.code === data.taxCountry);

  if (!data.taxCountry) {
    return (
      <PreviewCard>
        <Box sx={{ fontSize: 20, fontWeight: 600, color: 'var(--muted-foreground)' }}>
          {text(['preview', 'noCountry'], 'No tax country yet')}
        </Box>
        <Box sx={{ fontSize: 14, lineHeight: 1.6, color: 'var(--muted-foreground)' }}>
          {text(
            ['tax', 'notListedHint'],
            'Tax features stay off until a country is chosen in the workspace settings.',
          )}
        </Box>
      </PreviewCard>
    );
  }

  return (
    <PreviewCard>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <FlagIcon code={data.taxCountry} size={36} />
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em' }}>
            {countryName(data.taxCountry, data.locale, jurisdiction?.name)}
          </Box>
          {jurisdiction?.taxName ? (
            <Box sx={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
              {jurisdiction.taxName}
            </Box>
          ) : null}
        </Box>
      </Box>

      {rate.data ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            py: 2,
            borderTop: '1px solid var(--border-color)',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <Box sx={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
            {text(['preview', 'rateLabel'], 'Standard rate')}
          </Box>
          <Box sx={{ fontSize: 28, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {formatRate(rate.data.rate)}
          </Box>
        </Box>
      ) : null}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box component="p" sx={overlineSx}>
          {text(['preview', 'unlocksTitle'], 'This turns on')}
        </Box>
        <Box
          component="ul"
          sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          <UnlockRow>
            {text(['preview', 'unlockVat'], 'VAT rates on receipts and invoices')}
          </UnlockRow>
          <UnlockRow>{text(['preview', 'unlockDeclaration'], 'Income tax declaration')}</UnlockRow>
          {/* The holding-period rule is German law (metals.service.ts), nowhere else. */}
          {data.taxCountry === 'DE' ? (
            <UnlockRow>
              {text(['preview', 'unlockMetals'], '§23 holding period for precious metals')}
            </UnlockRow>
          ) : null}
        </Box>
      </Box>
    </PreviewCard>
  );
}

function BusinessPreview({ data, text }: { data: OnboardingData; text: OnboardingText }) {
  const labels = useIntlayer('businessProfile');
  const { legalName, addressLines, taxId, registrationId } = data.business;

  return (
    <PreviewCard>
      <Box component="p" sx={overlineSx}>
        {text(['preview', 'invoiceTitle'], 'Invoice')}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ fontSize: 20, fontWeight: 600, overflowWrap: 'anywhere' }}>
          {legalName.trim() || <Ghost width="55%" />}
        </Box>
        {addressLines.trim() ? (
          <Box sx={{ fontSize: 14, whiteSpace: 'pre-line', color: 'var(--muted-foreground)' }}>
            {addressLines.trim()}
          </Box>
        ) : (
          <>
            <Ghost width="70%" />
            <Ghost width="45%" />
          </>
        )}
        {data.taxCountry ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontSize: 14,
              color: 'var(--muted-foreground)',
            }}
          >
            <FlagIcon code={data.taxCountry} size={16} />
            {countryName(data.taxCountry, data.locale)}
          </Box>
        ) : null}
      </Box>
      <Box
        component="dl"
        sx={{
          m: 0,
          pt: 2,
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          columnGap: 2,
          rowGap: 1,
          fontSize: 13,
          borderTop: '1px solid var(--border-color)',
        }}
      >
        <Box component="dt" sx={{ color: 'var(--muted-foreground)' }}>
          {String(labels.taxId.value)}
        </Box>
        <Box component="dd" sx={{ m: 0 }}>
          {taxId.trim() || '—'}
        </Box>
        <Box component="dt" sx={{ color: 'var(--muted-foreground)' }}>
          {String(labels.registrationId.value)}
        </Box>
        <Box component="dd" sx={{ m: 0 }}>
          {registrationId.trim() || '—'}
        </Box>
      </Box>
    </PreviewCard>
  );
}

/** What the answers on the left change, drawn on the right as they are typed. */
export function OnboardingPreview({ stepKey, data }: OnboardingPreviewProps) {
  const text = useOnboardingText(data.locale);

  switch (stepKey) {
    case 'language':
      return <RegionPreview data={data} text={text} />;
    case 'tax':
      return <TaxPreview data={data} text={text} />;
    case 'business':
      return <BusinessPreview data={data} text={text} />;
    default:
      return <WorkspacePreview data={data} text={text} />;
  }
}
