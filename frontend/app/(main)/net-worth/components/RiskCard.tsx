'use client';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { ChevronDown } from '@/app/components/icons';
import { localizeBalanceAccountName } from '@/app/lib/balance-account-names';
import {
  CAPITAL_ROLES,
  type CapitalRole,
  type NetWorthAssetLine,
  type NetWorthClassificationItem,
  RISK_LEVELS,
  RISKY_ALLOCATION_THRESHOLD,
  type RiskLevel,
} from '../hooks/useNetWorth';
import { CardTitle, cardSx, plainLineName, WholeMoney } from './net-worth-ui';

interface RiskCardLabels {
  title: string;
  riskyShare: string;
  riskyHint: string;
  unclassified: string;
  riskColumn: string;
  roleColumn: string;
  risk: Record<RiskLevel, string>;
  role: Record<CapitalRole, string>;
}

interface RiskCardProps {
  byRisk: NetWorthClassificationItem[];
  byRole: NetWorthClassificationItem[];
  riskyPercent: number;
  lines: NetWorthAssetLine[];
  currency: string;
  locale: string;
  labels: RiskCardLabels;
  onClassify: (
    accountId: string,
    patch: { capitalRole?: CapitalRole | null; riskLevel?: RiskLevel | null },
  ) => void;
}

/**
 * Name, amount, risk, role: the same columns in the header and every line.
 * A phone has no room for four columns, so there risk and role go under the
 * name and amount, and the column titles are dropped (the values name themselves).
 */
const LINE_GRID = {
  display: 'grid',
  gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: 'minmax(0, 1fr) 120px 140px 140px' },
  columnGap: 3,
  rowGap: 0.5,
  alignItems: 'center',
} as const;

/**
 * A value shown as plain text that turns into a menu when clicked: two
 * outlined selects on every line made the card a grid of frames.
 */
function InlineChoice<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  /** What the choice is, for screen readers: "Risk", "Role". */
  label: string;
  value: { key: T | ''; text: string };
  options: Array<{ key: T | ''; text: string }>;
  disabled: boolean;
  onChange: (key: T | '') => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (disabled) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {value.text}
      </Typography>
    );
  }
  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={`${label}: ${value.text}`}
        aria-haspopup="menu"
        onClick={event => setAnchor(event.currentTarget)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          p: 0,
          border: 0,
          background: 'none',
          font: 'inherit',
          typography: 'body2',
          color: 'text.primary',
          cursor: 'pointer',
          textAlign: 'left',
          '& svg': { opacity: 0, transition: 'opacity 0.15s' },
          '&:hover svg, &:focus-visible svg': { opacity: 0.6 },
        }}
      >
        {value.text}
        <ChevronDown size={14} aria-hidden />
      </Box>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {options.map(option => (
          <MenuItem
            key={option.key || 'none'}
            selected={option.key === value.key}
            onClick={() => {
              setAnchor(null);
              if (option.key !== value.key) {
                onChange(option.key);
              }
            }}
          >
            {option.text}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** The share in medium or high risk against the 20% limit, as a thin bar with the limit marked. */
function RiskLimitBar({ percent, label }: { percent: number; label: string }) {
  const over = percent > RISKY_ALLOCATION_THRESHOLD;
  return (
    <Box sx={{ mb: 4.5 }}>
      <Typography variant="body2" sx={{ mb: 1, fontVariantNumeric: 'tabular-nums' }}>
        {label}: {percent}%
      </Typography>
      <Box
        role="img"
        aria-label={`${label}: ${percent}% / ${RISKY_ALLOCATION_THRESHOLD}%`}
        sx={{
          position: 'relative',
          height: 6,
          borderRadius: '3px',
          bgcolor: 'var(--icon-badge-bg)',
        }}
      >
        <Box
          sx={{
            height: '100%',
            width: `${Math.min(percent, 100)}%`,
            borderRadius: '3px',
            bgcolor: over ? 'var(--money-down)' : 'var(--money-up)',
          }}
        />
        {/* The limit itself: a tick across the bar and its figure under it. */}
        <Box
          sx={{
            position: 'absolute',
            top: -3,
            bottom: -3,
            left: `${RISKY_ALLOCATION_THRESHOLD}%`,
            width: '1px',
            bgcolor: 'text.secondary',
          }}
        />
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            top: 10,
            left: `${RISKY_ALLOCATION_THRESHOLD}%`,
            transform: 'translateX(-50%)',
            color: 'text.secondary',
          }}
        >
          {RISKY_ALLOCATION_THRESHOLD}%
        </Typography>
      </Box>
    </Box>
  );
}

export function RiskCard({
  byRisk,
  byRole,
  riskyPercent,
  lines,
  currency,
  locale,
  labels,
  onClassify,
}: RiskCardProps) {
  if (lines.length === 0) {
    return null;
  }

  const money = (value: number) => <WholeMoney value={value} currency={currency} locale={locale} />;

  const riskLabel = (key: string | null) =>
    key === null ? labels.unclassified : labels.risk[key as RiskLevel];
  const roleLabel = (key: string | null) =>
    key === null ? labels.unclassified : labels.role[key as CapitalRole];

  const riskOptions = [
    { key: '' as const, text: labels.unclassified },
    ...RISK_LEVELS.map(level => ({ key: level, text: labels.risk[level] })),
  ];
  const roleOptions = [
    { key: '' as const, text: labels.unclassified },
    ...CAPITAL_ROLES.map(role => ({ key: role, text: labels.role[role] })),
  ];

  return (
    <Box data-attention="card:risk" data-tour-shot="net-worth-risk" sx={cardSx}>
      {/* Two columns on a wide screen: the reading (limit and totals) on the
          left, the lines and their choices on the right, with room between. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px, 1fr) minmax(0, 2fr)' },
          columnGap: 8,
          rowGap: 4,
        }}
      >
        <Box>
          <CardTitle>{labels.title}</CardTitle>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 3 }}>
            {labels.riskyHint}
          </Typography>

          <RiskLimitBar percent={riskyPercent} label={labels.riskyShare} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Summary items={byRisk} label={riskLabel} money={money} />
            <Summary items={byRole} label={roleLabel} money={money} />
          </Box>
        </Box>

        <Box>
          {/* Visual column titles; each choice names itself for screen readers. */}
          <Box aria-hidden sx={{ ...LINE_GRID, display: { xs: 'none', sm: 'grid' }, pb: 1 }}>
            <span />
            <span />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {labels.riskColumn}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {labels.roleColumn}
            </Typography>
          </Box>
          {lines.map(line => (
            <Box
              key={line.id}
              sx={{ ...LINE_GRID, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
            >
              <Typography variant="body2" sx={{ minWidth: 0 }} noWrap>
                {plainLineName(localizeBalanceAccountName(line.name, locale))}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              >
                {money(line.amount)}
              </Typography>
              {/* Cash is the zero-risk anchor, so its risk is shown but locked. */}
              <Box>
                <InlineChoice<RiskLevel>
                  label={labels.riskColumn}
                  value={{ key: line.riskLevel ?? '', text: riskLabel(line.riskLevel) }}
                  options={riskOptions}
                  disabled={!line.isClassifiable}
                  onChange={key => onClassify(line.id, { riskLevel: key || null })}
                />
              </Box>
              <Box sx={{ justifySelf: { xs: 'end', sm: 'stretch' } }}>
                <InlineChoice<CapitalRole>
                  label={labels.roleColumn}
                  value={{ key: line.capitalRole ?? '', text: roleLabel(line.capitalRole) }}
                  options={roleOptions}
                  disabled={!line.isClassifiable}
                  onChange={key => onClassify(line.id, { capitalRole: key || null })}
                />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function Summary({
  items,
  label,
  money,
}: {
  items: NetWorthClassificationItem[];
  label: (key: string | null) => string;
  money: (value: number) => React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map(item => (
        <Box
          key={String(item.key)}
          sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 72px 96px', columnGap: 2 }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
            {label(item.key)}
          </Typography>
          <Typography
            variant="body2"
            sx={{ textAlign: 'right', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
          >
            {item.percent}%
          </Typography>
          <Typography
            variant="body2"
            sx={{ textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
          >
            {money(item.amount)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
