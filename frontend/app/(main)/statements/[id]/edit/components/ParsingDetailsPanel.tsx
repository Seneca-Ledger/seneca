'use client';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import type { StatementParsingDetails } from '@/app/lib/contracts';
import {
  countArray,
  formatLabel,
  getParsingStats,
  toOptionalStr,
  toUpperOrUndefined,
} from '../editHelpers';
import {
  type ConvertDroppedSamplePayload,
  ParsingWarningsPanel,
  type ResolveWarningPayload,
} from '../ParsingWarningsPanel';

type Labels = Record<string, { value: string }>;

export type ParsingDetailsData = StatementParsingDetails;

type MetaItemProps = { label: string; value?: string | null };
type StatBadgeProps = { label: string; count: number; color: string };
type MentionsBadgeProps = { label: string; mentions: readonly string[] };

function MetaItem({ label, value }: MetaItemProps): React.ReactElement {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

function StatBadge({ label, count, color }: StatBadgeProps): React.ReactElement {
  return (
    <Box>
      <Typography variant="caption" color={color}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, color }}>
        {count}
      </Typography>
    </Box>
  );
}

function MentionsBadge({ label, mentions }: MentionsBadgeProps): React.ReactElement {
  return (
    <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 2' } }}>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {mentions.join(', ')}
      </Typography>
    </Box>
  );
}

type MetaGridProps = { pd: ParsingDetailsData; labels: Labels };

function ParsingMetaGrid({ pd, labels }: MetaGridProps): React.ReactElement {
  const { errCount, warnCount, mentions } = getParsingStats(pd);
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
        gap: 2,
      }}
    >
      <MetaItem label={labels.bank.value} value={pd.detectedBank} />
      <MetaItem label={labels.bankDetectedBy.value} value={pd.detectedBy} />
      <MetaItem label={labels.format.value} value={toUpperOrUndefined(pd.detectedFormat)} />
      <MetaItem
        label={labels.foundTransactions.value}
        value={toOptionalStr(pd.transactionsFound)}
      />
      <MetaItem
        label={labels.createdTransactions.value}
        value={toOptionalStr(pd.transactionsCreated)}
      />
      {errCount > 0 && (
        <StatBadge label={labels.errors.value} count={errCount} color="error.main" />
      )}
      {warnCount > 0 && (
        <StatBadge label={labels.warnings.value} count={warnCount} color="warning.main" />
      )}
      {mentions.length > 0 && (
        <MentionsBadge label={labels.otherBankMentions.value} mentions={mentions} />
      )}
    </Box>
  );
}

type WarningsPanelProps = {
  pd: ParsingDetailsData;
  labels: Labels;
  onConvert: (payload: ConvertDroppedSamplePayload) => void | Promise<void>;
  onResolve: (payload: ResolveWarningPayload) => void;
};

function ParsingWarnings({
  pd,
  labels,
  onConvert,
  onResolve,
}: WarningsPanelProps): React.ReactElement | null {
  const warnCount = countArray(pd.warnings);
  const dropCount = countArray(pd.droppedSamples);
  if (warnCount === 0 && dropCount === 0) {
    return null;
  }
  const helperText = formatLabel(labels.alertParsingWarnings.value, { count: warnCount });
  return (
    <ParsingWarningsPanel
      warnings={pd.warnings ?? []}
      droppedSamples={pd.droppedSamples ?? []}
      onConvertDroppedSample={onConvert}
      onResolveWarning={onResolve}
      fixTooltipLabel={labels.fixDroppedRow.value}
      resolveBalanceTooltipLabel={labels.balanceEnd.value}
      title={labels.warnings.value}
      helperText={helperText}
    />
  );
}

export type ParsingDetailsPanelProps = {
  pd: ParsingDetailsData;
  labels: Labels;
  onConvert: (payload: ConvertDroppedSamplePayload) => void | Promise<void>;
  onResolve: (payload: ResolveWarningPayload) => void;
};

export function ParsingDetailsPanel({
  pd,
  labels,
  onConvert,
  onResolve,
}: ParsingDetailsPanelProps): React.ReactElement {
  return (
    <>
      <Divider sx={{ mb: 3 }} />
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          display: 'block',
          mb: 2,
          fontWeight: 600,
          textTransform: 'uppercase',
        }}
      >
        {labels.extractedMetadata.value}
      </Typography>
      <ParsingMetaGrid pd={pd} labels={labels} />
      <ParsingWarnings pd={pd} labels={labels} onConvert={onConvert} onResolve={onResolve} />
    </>
  );
}
