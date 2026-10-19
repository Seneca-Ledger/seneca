'use client';

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useIntlayer } from '@/app/i18n';
import {
  getCategoryDisplayName,
  type StatementCategorySource,
} from '@/app/lib/statement-categories';
import {
  MAX_SPLIT_PARTS,
  MIN_SPLIT_PARTS,
  type SplitPartRow,
  useSplitRows,
} from './hooks/useSplitRows';
import type { SplitPartInput } from './hooks/useTransactionSplit';

interface CategoryOption {
  id: string;
  name: string;
  source?: StatementCategorySource;
  isSystem?: boolean;
}

interface PartRowProps {
  index: number;
  row: SplitPartRow;
  categories: CategoryOption[];
  canRemove: boolean;
  locale: string;
  onChange: (index: number, field: keyof SplitPartRow, value: string) => void;
  onRemove: (index: number) => void;
}

function PartRow({
  index,
  row,
  categories,
  canRemove,
  locale,
  onChange,
  onRemove,
}: PartRowProps): React.ReactElement {
  const t = useIntlayer('transactionsDrawer');
  const labelId = `split-category-label-${index}`;
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <TextField
        label={t.splitDialog.amount.value.replace('{n}', String(index + 1))}
        type="number"
        value={row.amount}
        onChange={e => onChange(index, 'amount', e.target.value)}
        size="small"
        sx={{ width: 160 }}
        inputProps={{ min: 0, step: '0.01' }}
      />
      <FormControl fullWidth size="small" data-testid={`split-category-${index}`}>
        <InputLabel id={labelId}>{t.splitDialog.category}</InputLabel>
        <Select
          labelId={labelId}
          label={t.splitDialog.category.value}
          value={row.categoryId}
          onChange={e => onChange(index, 'categoryId', e.target.value)}
        >
          <MenuItem value="">
            <em>{t.splitDialog.none}</em>
          </MenuItem>
          {categories.map(category => (
            <MenuItem key={category.id} value={category.id}>
              {getCategoryDisplayName(category, locale)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <IconButton
        aria-label={t.splitDialog.removePart.value.replace('{n}', String(index + 1))}
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        size="small"
      >
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

export interface SplitTransactionDialogProps {
  open: boolean;
  transactionId: string;
  totalAmount: number;
  currency: string;
  categories: CategoryOption[];
  saving: boolean;
  locale: string;
  onClose: () => void;
  onSubmit: (parts: SplitPartInput[]) => void;
}

export function SplitTransactionDialog(props: SplitTransactionDialogProps): React.ReactElement {
  const { open, totalAmount, currency, categories, saving, locale, onClose, onSubmit } = props;
  const split = useSplitRows(open, totalAmount);
  const t = useIntlayer('transactionsDrawer');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t.splitDialog.title}</DialogTitle>
      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}
      >
        <Typography variant="body2" color="text.secondary">
          {t.splitDialog.totalToAllocate.value.replace(
            '{amount}',
            `${totalAmount.toFixed(2)} ${currency}`,
          )}
        </Typography>

        {split.rows.map((row, index) => (
          <PartRow
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and have no id
            key={index}
            index={index}
            row={row}
            categories={categories}
            canRemove={split.rows.length > MIN_SPLIT_PARTS}
            locale={locale}
            onChange={split.updateRow}
            onRemove={split.removeRow}
          />
        ))}

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            onClick={split.addRow}
            disabled={split.rows.length >= MAX_SPLIT_PARTS}
            size="small"
          >
            {t.splitDialog.addPart}
          </Button>
          <Button onClick={split.distributeEvenly} size="small">
            {t.splitDialog.distributeEvenly}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Typography
            variant="body2"
            data-testid="split-remaining"
            color={split.balanced ? 'success.main' : 'error.main'}
          >
            {t.splitDialog.remaining.value.replace(
              '{amount}',
              `${split.remaining.toFixed(2)} ${currency}`,
            )}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.splitDialog.cancel}</Button>
        <Button
          onClick={() => onSubmit(split.buildParts())}
          variant="contained"
          disabled={!split.canSave || saving}
        >
          {saving ? t.splitDialog.splitting : t.split}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SplitTransactionDialog;
