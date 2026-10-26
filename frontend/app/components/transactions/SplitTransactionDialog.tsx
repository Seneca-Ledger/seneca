'use client';

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { CategoryPickerField } from '@/app/components/categories/CategoryPickerField';
import { fillTemplateNodes } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import type { StatementCategorySource } from '@/app/lib/statement-categories';
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
  onChange: (index: number, field: keyof SplitPartRow, value: string) => void;
  onRemove: (index: number) => void;
}

function PartRow({
  index,
  row,
  categories,
  canRemove,
  onChange,
  onRemove,
}: PartRowProps): React.ReactElement {
  const t = useIntlayer('transactionsDrawer');
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <TextField
        label={t.splitDialog.amount.value.replace('{n}', String(index + 1))}
        type="number"
        value={row.amount}
        onChange={e => onChange(index, 'amount', e.target.value)}
        size="small"
        sx={{ width: 160 }}
        slotProps={{
          htmlInput: { min: 0, step: '0.01' },
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }} data-testid={`split-category-${index}`}>
        <CategoryPickerField
          size="small"
          ariaLabel={t.splitDialog.category.value}
          value={row.categoryId}
          categories={categories}
          onChange={categoryId => onChange(index, 'categoryId', categoryId)}
          placeholder={t.splitDialog.category.value}
          clearLabel={t.splitDialog.none.value}
        />
      </Box>
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
  onClose: () => void;
  onSubmit: (parts: SplitPartInput[]) => void;
}

export function SplitTransactionDialog(props: SplitTransactionDialogProps): React.ReactElement {
  const { open, totalAmount, currency, categories, saving, onClose, onSubmit } = props;
  const split = useSplitRows(open, totalAmount);
  const t = useIntlayer('transactionsDrawer');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t.splitDialog.title}</DialogTitle>
      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}
      >
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {fillTemplateNodes(t.splitDialog.totalToAllocate.value, {
            amount: `${totalAmount.toFixed(2)} ${currency}`,
          })}
        </Typography>

        {split.rows.map((row, index) => (
          <PartRow
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and have no id
            key={index}
            index={index}
            row={row}
            categories={categories}
            canRemove={split.rows.length > MIN_SPLIT_PARTS}
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
            {fillTemplateNodes(t.splitDialog.remaining.value, {
              amount: `${split.remaining.toFixed(2)} ${currency}`,
            })}
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
