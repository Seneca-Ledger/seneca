'use client';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isValid, parseISO } from 'date-fns';
import { CalendarDays, Download, RefreshCcw } from '@/app/components/icons';
import { Select } from '@/app/components/ui/select';
import { tokens } from '@/lib/theme-tokens';

type BalanceExportFormat = 'excel' | 'pdf';

export type BalanceFilterLabels = {
  asOfNow: string;
  asOfDate: string;
  refresh: string;
  exportBalance: string;
  exportExcel: string;
  exportPdf: string;
};

type BalanceFilterBarProps = {
  filterMode: 'now' | 'date';
  selectedDate: string;
  exportingFormat: BalanceExportFormat | null;
  exportMenuOpen: boolean;
  saveHint: string;
  labels: BalanceFilterLabels;
  onFilterModeChange: (mode: 'now' | 'date') => void;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  onExportMenuToggle: () => void;
  onDownloadExport: (format: BalanceExportFormat) => void;
};

const filterSelectSx = { fontSize: 14, color: 'var(--foreground)' };
const buttonBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  padding: '8px 12px',
  fontSize: 14,
  cursor: 'pointer',
  borderRadius: tokens.radius.md,
};
const menuBtnStyle = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  textAlign: 'left' as const,
  fontSize: 14,
  color: 'var(--foreground)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
};
const dateInputStyle = {
  border: '1px solid var(--border)',
  padding: '8px 12px',
  fontSize: 14,
  color: 'var(--foreground)',
  background: 'var(--card)',
};

type ExportMenuProps = {
  labels: BalanceFilterLabels;
  onDownloadExport: (format: BalanceExportFormat) => void;
};
function ExportMenu({ labels, onDownloadExport }: ExportMenuProps): React.ReactElement {
  return (
    <Box
      sx={{
        position: 'absolute',
        right: 0,
        zIndex: 10,
        mt: 0.5,
        width: 144,
        border: '1px solid var(--border)',
        bgcolor: 'var(--card)',
        p: 0.5,
        boxShadow: 1,
      }}
    >
      <button type="button" style={menuBtnStyle} onClick={() => onDownloadExport('excel')}>
        {labels.exportExcel}
      </button>
      <button type="button" style={menuBtnStyle} onClick={() => onDownloadExport('pdf')}>
        {labels.exportPdf}
      </button>
    </Box>
  );
}

type FilterControlsProps = {
  filterMode: 'now' | 'date';
  selectedDate: string;
  exportingFormat: BalanceExportFormat | null;
  labels: BalanceFilterLabels;
  onFilterModeChange: (mode: 'now' | 'date') => void;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
};
function FilterControls({
  filterMode,
  selectedDate,
  exportingFormat,
  labels,
  onFilterModeChange,
  onDateChange,
  onRefresh,
}: FilterControlsProps): React.ReactElement {
  const handleModeChange = (value: string): void => {
    onFilterModeChange(value as 'now' | 'date');
  };
  const dateValue = selectedDate ? parseISO(selectedDate) : null;
  const handleDatePickerChange = (d: Date | null): void =>
    onDateChange(d && isValid(d) ? format(d, 'yyyy-MM-dd') : '');
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          border: '1px solid var(--border)',
          bgcolor: 'var(--card)',
          px: 1.5,
          py: 1,
          fontSize: 14,
          color: 'var(--foreground)',
        }}
      >
        <CalendarDays size={16} style={{ color: 'var(--muted-foreground)' }} />
        <Select
          variant="standard"
          disableUnderline
          sx={filterSelectSx}
          value={filterMode}
          onChange={handleModeChange}
          options={[
            { value: 'now', label: labels.asOfNow },
            { value: 'date', label: labels.asOfDate },
          ]}
        />
      </Box>
      {filterMode === 'date' && (
        <DatePicker
          value={dateValue}
          onChange={handleDatePickerChange}
          slotProps={{ textField: { size: 'small' } as never }}
        />
      )}
      <button
        type="button"
        onClick={onRefresh}
        disabled={!!exportingFormat}
        style={{ ...buttonBase, color: 'var(--muted-foreground)' }}
      >
        <RefreshCcw size={16} />
        {labels.refresh}
      </button>
    </Box>
  );
}

export function BalanceFilterBar({
  filterMode,
  selectedDate,
  exportingFormat,
  exportMenuOpen,
  saveHint,
  labels,
  onFilterModeChange,
  onDateChange,
  onRefresh,
  onExportMenuToggle,
  onDownloadExport,
}: BalanceFilterBarProps): React.ReactElement {
  return (
    <Box sx={{ border: '1px solid var(--border)', bgcolor: 'var(--card)', p: 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { md: 'center' },
          justifyContent: { md: 'space-between' },
          gap: 1.5,
        }}
      >
        <FilterControls
          filterMode={filterMode}
          selectedDate={selectedDate}
          exportingFormat={exportingFormat}
          labels={labels}
          onFilterModeChange={onFilterModeChange}
          onDateChange={onDateChange}
          onRefresh={onRefresh}
        />
        <Box sx={{ position: 'relative' }}>
          <button
            type="button"
            onClick={onExportMenuToggle}
            disabled={!!exportingFormat}
            style={{ ...buttonBase, color: 'var(--foreground)' }}
          >
            {exportingFormat ? (
              <CircularProgress size={16} sx={{ color: 'inherit' }} />
            ) : (
              <Download size={16} />
            )}
            {labels.exportBalance}
          </button>
          {exportMenuOpen && <ExportMenu labels={labels} onDownloadExport={onDownloadExport} />}
        </Box>
      </Box>
      {saveHint && (
        <Typography
          variant="caption"
          sx={{ mt: 1, display: 'block', color: 'var(--muted-foreground)' }}
        >
          {saveHint}
        </Typography>
      )}
    </Box>
  );
}
