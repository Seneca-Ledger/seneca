'use client';

import { Box, MenuItem, Select, TextField } from '@mui/material';
import { useIntlayer } from '@/app/i18n';
import type { ReceiptsFilterState } from './hooks/useReceipts';

export interface ReceiptFiltersProps {
  filters: ReceiptsFilterState;
  onChange: (filters: ReceiptsFilterState) => void;
}

export function ReceiptFilters({ filters, onChange }: ReceiptFiltersProps) {
  const t = useIntlayer('receiptReview');
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.5fr) 220px 220px' },
      }}
    >
      <TextField
        size="small"
        value={filters.search}
        placeholder={t.searchPlaceholder.value}
        onChange={event => onChange({ ...filters, page: 1, search: event.target.value })}
      />
      <Select
        size="small"
        value={filters.status}
        onChange={event => onChange({ ...filters, page: 1, status: event.target.value })}
      >
        <MenuItem value="all">{t.allStatuses}</MenuItem>
        <MenuItem value="new">{t.statusNew}</MenuItem>
        <MenuItem value="draft">{t.statusDraft}</MenuItem>
        <MenuItem value="parsed">{t.statusParsed}</MenuItem>
        <MenuItem value="needs_review">{t.statusNeedsReview}</MenuItem>
        <MenuItem value="approved">{t.statusApproved}</MenuItem>
      </Select>
      <Select
        size="small"
        value={filters.source}
        onChange={event => onChange({ ...filters, page: 1, source: event.target.value })}
      >
        <MenuItem value="all">{t.allSources}</MenuItem>
        <MenuItem value="upload">{t.sourceUpload}</MenuItem>
        <MenuItem value="scan">{t.sourceScan}</MenuItem>
      </Select>
    </Box>
  );
}
