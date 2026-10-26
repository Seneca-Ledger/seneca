'use client';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { RefObject } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { ChevronDown } from '@/app/components/icons';
import type { MetadataHints, StatementParsingDetails } from '../editHelpers';
import { buildHints, ignoreEventArg } from '../editHelpers';
import type { ConvertDroppedSamplePayload, ResolveWarningPayload } from '../ParsingWarningsPanel';
import { ParsingDetailsPanel } from './ParsingDetailsPanel';

type Labels = Record<string, { value: string }>;
type MetaForm = {
  balanceStart: string;
  balanceEnd: string;
  statementDateFrom: string;
  statementDateTo: string;
};
type ChangeParams = { field: string; value: string };

type MetadataFieldsProps = {
  form: MetaForm;
  hints: MetadataHints;
  labels: Labels;
  balanceStartInputRef: RefObject<HTMLInputElement>;
  balanceEndInputRef: RefObject<HTMLInputElement>;
  onChange: (params: ChangeParams) => void;
};

function MetadataFields({
  form,
  hints,
  labels,
  balanceStartInputRef,
  balanceEndInputRef,
  onChange,
}: MetadataFieldsProps): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
        gap: 3,
        mb: 3,
      }}
    >
      <CustomDatePicker
        containerTestId="statement-metadata-field-start-date"
        label={labels.startDate.value}
        value={form.statementDateFrom}
        onChange={value => onChange({ field: 'statementDateFrom', value })}
        helperText={hints.startDate}
      />
      <CustomDatePicker
        containerTestId="statement-metadata-field-end-date"
        label={labels.endDate.value}
        value={form.statementDateTo}
        onChange={value => onChange({ field: 'statementDateTo', value })}
        helperText={hints.endDate}
      />
      <div data-testid="statement-metadata-field-opening-balance">
        <span
          style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            display: 'block',
            marginBottom: 4,
            fontWeight: 500,
            marginLeft: 4,
          }}
        >
          {labels.openingBalance.value}
        </span>
        <TextField
          type="number"
          fullWidth
          size="small"
          inputRef={balanceStartInputRef}
          value={form.balanceStart}
          onChange={e => onChange({ field: 'balanceStart', value: e.target.value })}
          placeholder="0.00"
          helperText={hints.openingBalance}
          sx={{
            '& .MuiOutlinedInput-root': { '&:hover fieldset': { borderColor: 'primary.main' } },
          }}
        />
      </div>
      <div data-testid="statement-metadata-field-closing-balance">
        <span
          style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            display: 'block',
            marginBottom: 4,
            fontWeight: 500,
            marginLeft: 4,
          }}
        >
          {labels.balanceEnd.value}
        </span>
        <TextField
          type="number"
          fullWidth
          size="small"
          inputRef={balanceEndInputRef}
          value={form.balanceEnd}
          onChange={e => onChange({ field: 'balanceEnd', value: e.target.value })}
          placeholder="0.00"
          helperText={hints.closingBalance}
          sx={{
            '& .MuiOutlinedInput-root': { '&:hover fieldset': { borderColor: 'primary.main' } },
          }}
        />
      </div>
    </Box>
  );
}

export type MetadataAccordionProps = {
  expanded: boolean;
  metadataForm: MetaForm;
  labels: Labels;
  locale: string;
  parsingDetails: StatementParsingDetails | null | undefined;
  formatNumber: (n?: number | null) => string;
  balanceStartInputRef: RefObject<HTMLInputElement>;
  balanceEndInputRef: RefObject<HTMLInputElement>;
  onToggle: (expanded: boolean) => void;
  onMetadataChange: (params: ChangeParams) => void;
  onConvert: (payload: ConvertDroppedSamplePayload) => void | Promise<void>;
  onResolve: (payload: ResolveWarningPayload) => void;
};

export function MetadataAccordion({
  expanded,
  metadataForm,
  labels,
  locale,
  parsingDetails,
  formatNumber,
  balanceStartInputRef,
  balanceEndInputRef,
  onToggle,
  onMetadataChange,
  onConvert,
  onResolve,
}: MetadataAccordionProps): React.ReactElement {
  const parsedMeta = parsingDetails?.metadataExtracted ?? undefined;
  const hints = buildHints({
    prefix: labels.fromFilePrefix?.value,
    locale,
    meta: parsedMeta,
    fmt: formatNumber,
    labels,
  });
  return (
    <Accordion
      expanded={expanded}
      onChange={ignoreEventArg(onToggle)}
      elevation={0}
      sx={{
        mb: 4,
        border: '1px solid',
        borderColor: 'divider',
        '&:before': { display: 'none' },
        overflow: 'hidden',
      }}
    >
      <AccordionSummary
        expandIcon={<ChevronDown size={20} />}
        sx={{
          bgcolor: theme => (theme.palette.mode === 'dark' ? '#18222d' : theme.palette.grey[50]),
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {labels.parsingDetails.value}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <MetadataFields
          form={metadataForm}
          hints={hints}
          labels={labels}
          balanceStartInputRef={balanceStartInputRef}
          balanceEndInputRef={balanceEndInputRef}
          onChange={onMetadataChange}
        />
        {parsingDetails && (
          <ParsingDetailsPanel
            pd={parsingDetails}
            labels={labels}
            onConvert={onConvert}
            onResolve={onResolve}
          />
        )}
      </AccordionDetails>
    </Accordion>
  );
}
