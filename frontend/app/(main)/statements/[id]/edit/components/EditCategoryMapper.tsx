'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { CheckCircle2, Layers, Save, Trash2 } from '@/app/components/icons';
import { Spinner } from '@/app/components/ui/spinner';
import { tokens } from '@/lib/theme-tokens';
import type { CategoryOption } from '../editHelpers';
import { formatLabel, labelValue } from '../editHelpers';

type EditCategoryMapperProps = {
  open: boolean;
  saving: boolean;
  selectedCount: number;
  bulkCategoryId: string;
  flattenedEnabledCategories: CategoryOption[];
  labels: Record<string, { value?: string } | undefined>;
  onClose: () => void;
  onCategoryChange: (id: string) => void;
  onApply: () => void;
};

type CategoryPickerProps = {
  bulkCategoryId: string;
  categoryLabel: string;
  helperText: string;
  notSelectedLabel: string;
  flattenedEnabledCategories: CategoryOption[];
  onCategoryChange: (id: string) => void;
};

function CategoryPicker({
  bulkCategoryId,
  categoryLabel,
  helperText,
  notSelectedLabel,
  flattenedEnabledCategories,
  onCategoryChange,
}: CategoryPickerProps): React.ReactElement {
  return (
    <TextField
      select
      label={categoryLabel}
      fullWidth
      value={bulkCategoryId}
      onChange={e => onCategoryChange(e.target.value)}
      helperText={helperText}
      sx={{ '& .MuiOutlinedInput-root': { '&:hover fieldset': { borderColor: 'primary.main' } } }}
    >
      <MenuItem value="">{notSelectedLabel}</MenuItem>
      {flattenedEnabledCategories.map(cat => (
        <MenuItem key={cat.id} value={cat.id}>
          {cat.name}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function EditCategoryMapper({
  open,
  saving,
  selectedCount,
  bulkCategoryId,
  flattenedEnabledCategories,
  labels,
  onClose,
  onCategoryChange,
  onApply,
}: EditCategoryMapperProps): React.ReactElement {
  const title = formatLabel(
    labelValue(
      labels.assignCategoryForTransactions,
      `Assign category for ${selectedCount} transactions`,
    ),
    { count: selectedCount },
  );
  const applyDisabled = saving || !bulkCategoryId;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { boxShadow: 'none', border: '1px solid', borderColor: 'grey.200' } }}
    >
      <DialogTitle
        sx={{
          fontWeight: 600,
          fontSize: '1rem',
          color: 'text.primary',
          letterSpacing: '-0.01em',
          pb: 1,
        }}
      >
        {title}
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <CategoryPicker
          bulkCategoryId={bulkCategoryId}
          categoryLabel={labelValue(labels.category, 'Category')}
          helperText={labelValue(
            labels.bulkCategoryHelper,
            'The category will be applied to all selected transactions',
          )}
          notSelectedLabel={labelValue(labels.notSelected, 'Not selected')}
          flattenedEnabledCategories={flattenedEnabledCategories}
          onCategoryChange={onCategoryChange}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button
          onClick={onClose}
          sx={{ textTransform: 'none', fontWeight: 500, color: 'text.secondary' }}
        >
          {labelValue(labels.cancel, 'Cancel')}
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <Spinner size={18} /> : <CheckCircle2 size={18} />}
          onClick={onApply}
          disabled={applyDisabled}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          }}
        >
          {labelValue(labels.apply, 'Apply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type ExportConfirmDialogProps = {
  open: boolean;
  exportingToTable: boolean;
  hasTransactions: boolean;
  labels: {
    exportConfirmTitle: { value: string };
    exportConfirmBody: { value: string };
    cancel: { value: string };
    exportConfirmConfirm: { value: string };
  };
  onClose: () => void;
  onConfirm: () => void;
};

const BTN_BASE = {
  borderRadius: tokens.radius.md,
  padding: '10px 24px',
  fontSize: 16,
  fontWeight: 500,
  cursor: 'pointer',
} as const;
const CANCEL_STYLE = {
  ...BTN_BASE,
  border: '1px solid var(--border-color)',
  background: 'var(--card-bg)',
  color: 'var(--text-secondary)',
} as const;
const CONFIRM_STYLE = {
  ...BTN_BASE,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'var(--primary-fill)',
  color: '#fff',
  border: 'none',
} as const;

export function ExportConfirmDialog({
  open,
  exportingToTable,
  hasTransactions,
  labels,
  onClose,
  onConfirm,
}: ExportConfirmDialogProps): React.ReactElement {
  const confirmDisabled = exportingToTable || !hasTransactions;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontSize: 22, fontWeight: 600 }}>
        {labels.exportConfirmTitle.value}
      </DialogTitle>
      <DialogContent dividers>
        <p style={{ fontSize: 16, lineHeight: 2, color: 'var(--foreground)' }}>
          {labels.exportConfirmBody.value}
        </p>
      </DialogContent>
      <DialogActions sx={{ px: 4, py: 3, gap: 1.5, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={CANCEL_STYLE}>
          {labels.cancel.value}
        </button>
        <button type="button" onClick={onConfirm} disabled={confirmDisabled} style={CONFIRM_STYLE}>
          {exportingToTable ? <Spinner style={{ height: 16, width: 16, color: '#fff' }} /> : null}
          {labels.exportConfirmConfirm.value}
        </button>
      </DialogActions>
    </Dialog>
  );
}

type BulkActionsBarProps = {
  selectedCount: number;
  saving: boolean;
  labels: Record<string, { value?: string } | undefined>;
  onAssignCategory: () => void;
  onBulkUpdate: () => void;
  onBulkDelete: (confirmMsg: string) => void;
};

export function BulkActionsBar({
  selectedCount,
  saving,
  labels,
  onAssignCategory,
  onBulkUpdate,
  onBulkDelete,
}: BulkActionsBarProps): React.ReactElement {
  const selectedText = formatLabel(
    labelValue(labels.selectedTransactions, `Selected: ${selectedCount} transactions`),
    { count: selectedCount },
  );
  const deleteMsg = formatLabel(
    labelValue(labels.confirmDeleteMany, `Delete ${selectedCount} transactions?`),
    { count: selectedCount },
  );
  return (
    <Box
      sx={{ mb: 3, p: 3, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ fontWeight: 600, color: 'primary.700', fontSize: '0.9375rem' }} component="span">
          {selectedText}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={onAssignCategory}
            startIcon={<Layers size={18} />}
            disabled={saving}
            size="small"
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              borderColor: 'primary.300',
              color: 'primary.700',
              '&:hover': { borderColor: 'primary.400', bgcolor: 'primary.100' },
            }}
          >
            {labelValue(labels.assignCategory, 'Assign category')}
          </Button>
          <Button
            variant="contained"
            onClick={onBulkUpdate}
            disabled={saving}
            startIcon={saving ? <Spinner size={20} /> : <Save size={18} />}
            size="small"
            sx={{ textTransform: 'none', fontWeight: 600, boxShadow: 'none' }}
          >
            {labelValue(labels.save, 'Save')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => onBulkDelete(deleteMsg)}
            disabled={saving}
            startIcon={<Trash2 size={18} />}
            size="small"
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            {labelValue(labels.delete, 'Delete')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
