'use client';

import { Alert, AlertTitle, Dialog, DialogTitle, Typography } from '@mui/material';
import { useMemo } from 'react';
import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { useIntlayer } from '@/app/i18n';
import type { StatementParsingDetails } from '@/app/lib/contracts';
import { DroppedSampleForm } from './DroppedSampleForm';
import {
  extractTxKey,
  formatDroppedSampleText,
  isBalanceMismatchWarning,
  isRepairableWarning,
  toDroppedSample,
} from './helpers/warning-formatters';
import {
  type EditableWarningEntry,
  useParsingWarningsPanel,
} from './hooks/useParsingWarningsPanel';
import { WarningsList } from './WarningsList';

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** A parsed row the import left out, as the parser kept it. */
export type ParsingDroppedSample = Exclude<
  NonNullable<StatementParsingDetails['droppedSamples']>[number],
  string
>;

export type ParsingDroppedSampleTransaction = NonNullable<ParsingDroppedSample['transaction']>;

export type ConvertDroppedSamplePayload = {
  sample: ParsingDroppedSample;
  index: number;
  warning?: string;
};

export type ResolveWarningPayload = {
  warning: string;
  index: number;
};

interface ParsingWarningsPanelProps {
  warnings: string[];
  droppedSamples?: Array<string | ParsingDroppedSample>;
  onConvertDroppedSample?: (payload: ConvertDroppedSamplePayload) => void | Promise<void>;
  onResolveWarning?: (payload: ResolveWarningPayload) => void;
  fixTooltipLabel?: string;
  resolveBalanceTooltipLabel?: string;
  title?: string;
  helperText?: string;
}

// ---------------------------------------------------------------------------
// Re-exports for backward compatibility
// ---------------------------------------------------------------------------

export const formatDroppedSample = formatDroppedSampleText;

// ---------------------------------------------------------------------------
// Editable entry builder
// ---------------------------------------------------------------------------

type FallbackCtx = {
  warnings: string[];
  sampleKeyByReason: Map<string, string>;
  sampleKeyByTxKey: Map<string, string>;
};

const buildFallbackEntries = ({
  warnings,
  sampleKeyByReason,
  sampleKeyByTxKey,
}: FallbackCtx): EditableWarningEntry[] =>
  warnings.flatMap((warning, warningIndex) => {
    const warningTxKey = extractTxKey(warning);
    const matchedKey =
      sampleKeyByReason.get(warning) ??
      (warningTxKey ? sampleKeyByTxKey.get(warningTxKey) : undefined);
    if (matchedKey || !(isRepairableWarning(warning) || isBalanceMismatchWarning(warning))) {
      return [];
    }
    const entry: EditableWarningEntry = {
      key: `warning:${warningIndex}`,
      sample: { reason: warning },
      reason: warning,
      txKey: warningTxKey,
      action: isBalanceMismatchWarning(warning) ? 'resolve' : 'convert',
    };
    return [entry];
  });

const buildEditableEntries = ({
  droppedSamples,
  warnings,
}: {
  droppedSamples: Array<string | ParsingDroppedSample>;
  warnings: string[];
}): EditableWarningEntry[] => {
  const sampleEntries: EditableWarningEntry[] = droppedSamples.map((sample, index) => {
    const normalized = toDroppedSample(sample);
    return {
      key: `sample:${index}`,
      sample: normalized,
      reason: normalized.reason,
      txKey: extractTxKey(normalized.reason),
      action: 'convert',
    };
  });

  const sampleKeyByReason = new Map(sampleEntries.map(e => [e.reason, e.key] as const));
  const sampleKeyByTxKey = new Map(
    sampleEntries
      .filter((e): e is EditableWarningEntry & { txKey: string } => Boolean(e.txKey))
      .map(e => [e.txKey, e.key] as const),
  );

  const fallbackEntries = buildFallbackEntries({ warnings, sampleKeyByReason, sampleKeyByTxKey });
  return [...sampleEntries, ...fallbackEntries];
};

// ---------------------------------------------------------------------------
// Inner sub-components
// ---------------------------------------------------------------------------

type ConvertDialogProps = {
  panel: ReturnType<typeof useParsingWarningsPanel>;
};

function ConvertDialog({ panel }: ConvertDialogProps): React.JSX.Element {
  const { isDialogOpen, selectedEntry, selectedDraft, selectedWarning } = panel;
  const t = useIntlayer('statementDroppedSampleForm');
  return (
    <Dialog
      open={isDialogOpen}
      onClose={() => panel.setSelectedWarning(null)}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>{t.dialogTitle}</DialogTitle>
      {isDialogOpen &&
      selectedEntry !== null &&
      selectedDraft !== null &&
      selectedWarning !== null ? (
        <DroppedSampleForm
          selectedWarning={selectedWarning.warning}
          entryKey={selectedEntry.key}
          draft={selectedDraft}
          canConvert={panel.selectedCanConvert}
          isConverting={panel.selectedIsConverting}
          onUpdateDraft={panel.updateDraft}
          onOpenCurrencyPicker={() => panel.setCurrencyPickerOpen(true)}
          onCancel={() => panel.setSelectedWarning(null)}
          onConvert={() => {
            void panel.handleConvert();
          }}
        />
      ) : null}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ParsingWarningsPanel({
  warnings,
  droppedSamples = [],
  onConvertDroppedSample,
  onResolveWarning,
  fixTooltipLabel = 'Fix',
  resolveBalanceTooltipLabel = 'Review balances',
  title = 'Parsing warnings',
  helperText = 'Review the flagged rows before submitting this statement.',
}: ParsingWarningsPanelProps): React.JSX.Element | null {
  const editableEntries = useMemo(
    () => buildEditableEntries({ droppedSamples, warnings }),
    [droppedSamples, warnings],
  );
  const panel = useParsingWarningsPanel({
    warnings,
    editableEntries,
    onConvertDroppedSample,
    onResolveWarning,
  });

  if (warnings.length === 0 && droppedSamples.length === 0) {
    return null;
  }

  return (
    <>
      <Alert severity="warning" variant="outlined" sx={{ mt: 3, alignItems: 'flex-start' }}>
        <AlertTitle sx={{ mb: 0.5 }}>{title}</AlertTitle>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mb: 1.5,
          }}
        >
          {helperText}
        </Typography>
        <WarningsList
          warnings={warnings}
          editableEntryByReason={panel.editableEntryByReason}
          editableEntryByTxKey={panel.editableEntryByTxKey}
          fixTooltipLabel={fixTooltipLabel}
          resolveBalanceTooltipLabel={resolveBalanceTooltipLabel}
          extractTxKey={extractTxKey}
          onSelectWarning={panel.handleSelectWarning}
          onResolve={panel.handleResolve}
        />
        <ConvertDialog panel={panel} />
      </Alert>
      <CurrencyDrawer
        isOpen={
          panel.currencyPickerOpen && panel.selectedEntry !== null && panel.selectedDraft !== null
        }
        onClose={panel.handleCloseCurrencyPicker}
        currencySearch={panel.currencySearch}
        setCurrencySearch={panel.setCurrencySearch}
        selectedCurrencyItem={panel.selectedCurrencyItem}
        selectedMatchesSearch={panel.selectedMatchesSearch}
        currencyQuery={panel.currencyQuery}
        recentCurrencyItems={panel.recentCurrencyItems}
        allCurrencyItems={panel.allCurrencyItems}
        handleSelectCurrency={panel.handleSelectCurrency}
        zIndex={1400}
      />
    </>
  );
}
