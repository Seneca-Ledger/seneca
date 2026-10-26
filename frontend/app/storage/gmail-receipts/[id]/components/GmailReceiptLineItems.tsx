'use client';
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import {
  CheckCircle2,
  Layers,
  Pencil,
  Trash2,
  TriangleAlert,
  XCircle,
} from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { useCategoryName } from '@/app/lib/use-category-name';
import { formatStoredDate } from '@/app/lib/user-format-store';
import type {
  EditableLineItem,
  EditableReceiptData,
  ReceiptCategoryOption,
} from '../hooks/useGmailReceiptData';

const formatCurrencyAmount = (amount: number, currency: string): string => {
  if (!Number.isFinite(amount)) {
    return `0 ${currency}`;
  }
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

const createLineItemId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `line-${Math.random().toString(36).slice(2, 10)}`;

interface LineItemRowProps {
  item: EditableLineItem;
  index: number;
  isEditing: boolean;
  isSelected: boolean;
  editedRowData: Record<string, Partial<EditableLineItem>>;
  editedData: EditableReceiptData;
  enabledCategories: ReceiptCategoryOption[];
  selectedCategoryId: string;
  hasCategory: boolean;
  isLowConfidence: boolean;
  transactionType: string;
  currency: string;
  lineItemsCount: number;
  onSelect: (id: string) => void;
  onEdit: (item: EditableLineItem) => void;
  onSaveRow: (id: string) => void;
  onCancelRow: () => void;
  onDeleteRow: (id: string) => void;
  onRowFieldChange: (id: string, field: keyof EditableLineItem, value: string | number) => void;
  setEditedData: React.Dispatch<React.SetStateAction<EditableReceiptData>>;
}

function LineItemRow({
  item,
  index,
  isEditing,
  isSelected,
  editedRowData,
  editedData,
  enabledCategories,
  selectedCategoryId,
  hasCategory,
  isLowConfidence,
  transactionType,
  currency,
  lineItemsCount,
  onSelect,
  onEdit,
  onSaveRow,
  onCancelRow,
  onDeleteRow,
  onRowFieldChange,
  setEditedData,
}: LineItemRowProps): React.ReactElement {
  const t = useIntlayer('gmailReceiptPage');
  const categoryName = useCategoryName();
  const edited = editedRowData[item.id] || item;
  const missingCategory = !(hasCategory || editedData.categoryId);

  const rowSx = {
    bgcolor: missingCategory ? 'error.50' : undefined,
    borderLeft: missingCategory ? '3px solid' : undefined,
    borderLeftColor: missingCategory ? 'error.400' : undefined,
    transition: 'all 0.15s',
    '&:hover': { bgcolor: missingCategory ? 'error.100' : 'grey.50' },
  };

  return (
    <TableRow hover sx={rowSx}>
      <TableCell padding="checkbox">
        <Checkbox checked={isSelected} onCheckedChange={() => onSelect(item.id)} />
      </TableCell>

      <TableCell sx={{ minWidth: 100 }}>
        {isEditing ? (
          <CustomDatePicker
            value={editedData.date?.split('T')[0] || ''}
            onChange={value => setEditedData(prev => ({ ...prev, date: value }))}
          />
        ) : editedData.date ? (
          formatStoredDate(editedData.date)
        ) : (
          '—'
        )}
      </TableCell>

      <TableCell sx={{ minWidth: 140 }}>
        {isEditing ? (
          <TextField
            size="small"
            fullWidth
            value={editedData.vendor || ''}
            onChange={e => setEditedData(prev => ({ ...prev, vendor: e.target.value }))}
            placeholder={t.lineItems.merchant.value}
          />
        ) : (
          editedData.vendor || '—'
        )}
      </TableCell>

      <TableCell sx={{ minWidth: 200, maxWidth: 300 }}>
        {isEditing ? (
          <TextField
            size="small"
            fullWidth
            value={edited.description ?? item.description}
            onChange={e => onRowFieldChange(item.id, 'description', e.target.value)}
            placeholder={t.lineItems.description.value}
          />
        ) : (
          <Tooltip title={item.description}>
            <Typography
              variant="body2"
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {item.description || '—'}
            </Typography>
          </Tooltip>
        )}
      </TableCell>

      <TableCell
        align="right"
        sx={{
          color: transactionType === 'income' ? 'success.600' : 'error.600',
          fontWeight: 600,
          fontSize: '0.9375rem',
        }}
      >
        {isEditing ? (
          <TextField
            size="small"
            type="number"
            value={edited.amount !== undefined ? edited.amount : item.amount}
            onChange={e =>
              onRowFieldChange(item.id, 'amount', Number.parseFloat(e.target.value || '0'))
            }
            inputProps={{ style: { textAlign: 'right' } }}
          />
        ) : (
          <PrivateAmount>{formatCurrencyAmount(item.amount, currency)}</PrivateAmount>
        )}
      </TableCell>

      <TableCell sx={{ minWidth: 150 }}>
        {isEditing ? (
          <TextField
            size="small"
            fullWidth
            select
            value={selectedCategoryId}
            onChange={e => {
              const sel = enabledCategories.find(c => c.id === e.target.value);
              setEditedData(prev => ({ ...prev, categoryId: e.target.value, category: sel?.name }));
            }}
          >
            <MenuItem value="">{t.lineItems.select}</MenuItem>
            {enabledCategories.map(cat => (
              <MenuItem key={cat.id} value={cat.id}>
                {categoryName(cat.name)}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Box>
            {hasCategory ? (
              <Chip
                label={
                  editedData.categoryId
                    ? categoryName(
                        enabledCategories.find(c => c.id === selectedCategoryId)?.name ?? '',
                      ) || t.lineItems.category.value
                    : t.lineItems.category.value
                }
                size="small"
                sx={{
                  bgcolor: 'primary.50',
                  color: 'primary.700',
                  fontWeight: 500,
                  fontSize: '0.8125rem',
                }}
              />
            ) : (
              <Chip
                label={t.lineItems.noCategory.value}
                size="small"
                icon={<TriangleAlert size={16} />}
                sx={{
                  bgcolor: 'error.50',
                  color: 'error.700',
                  border: '1px solid',
                  borderColor: 'error.100',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  '& .MuiChip-icon': { color: 'error.600' },
                }}
              />
            )}
          </Box>
        )}
      </TableCell>

      <TableCell>
        {index === 0 &&
          (isLowConfidence ? (
            <Chip
              label={t.lineItems.lowConfidence.value}
              size="small"
              sx={{
                bgcolor: 'warning.50',
                color: 'warning.800',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          ) : (
            <Chip
              label={t.lineItems.parsed.value}
              size="small"
              sx={{
                bgcolor: 'success.50',
                color: 'success.800',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          ))}
      </TableCell>

      <TableCell>
        {isEditing ? (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => onSaveRow(item.id)}
              sx={{ color: 'success.600', '&:hover': { bgcolor: 'success.50' } }}
            >
              <CheckCircle2 size={16} />
            </IconButton>
            <IconButton
              size="small"
              onClick={onCancelRow}
              sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'grey.100' } }}
            >
              <XCircle size={16} />
            </IconButton>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => onEdit(item)}
              sx={{ color: 'primary.600', '&:hover': { bgcolor: 'primary.50' } }}
            >
              <Pencil size={16} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => onDeleteRow(item.id)}
              disabled={lineItemsCount <= 1}
              sx={{ color: 'error.600', '&:hover': { bgcolor: 'error.50' } }}
            >
              <Trash2 size={16} />
            </IconButton>
          </Box>
        )}
      </TableCell>
    </TableRow>
  );
}

interface GmailReceiptLineItemsProps {
  lineItems: EditableLineItem[];
  editedData: EditableReceiptData;
  enabledCategories: ReceiptCategoryOption[];
  selectedCategoryId: string;
  hasCategory: boolean;
  isLowConfidence: boolean;
  transactionType: string;
  currency: string;
  saving: boolean;
  onSaveChanges: () => Promise<void>;
  setEditedData: React.Dispatch<React.SetStateAction<EditableReceiptData>>;
  onOpenBulkCategory: () => void;
}

export function GmailReceiptLineItems({
  lineItems,
  editedData,
  enabledCategories,
  selectedCategoryId,
  hasCategory,
  isLowConfidence,
  transactionType,
  currency,
  saving,
  onSaveChanges,
  setEditedData,
  onOpenBulkCategory,
}: GmailReceiptLineItemsProps): React.ReactElement {
  const t = useIntlayer('gmailReceiptPage');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedRowData, setEditedRowData] = useState<Record<string, Partial<EditableLineItem>>>({});

  const handleRowSelect = (id: string): void => {
    const next = new Set(selectedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRows(next);
  };

  const handleSelectAll = (): void => {
    if (selectedRows.size === lineItems.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(lineItems.map(item => item.id)));
    }
  };

  const handleEditRow = (item: EditableLineItem): void => {
    setEditingRow(item.id);
    setEditedRowData({ [item.id]: { ...item } });
  };

  const handleRowFieldChange = (
    id: string,
    field: keyof EditableLineItem,
    value: string | number,
  ): void => {
    setEditedRowData(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSaveRow = (itemId: string): void => {
    const updates = editedRowData[itemId];
    if (!updates) {
      return;
    }
    setEditedData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(item => (item.id === itemId ? { ...item, ...updates } : item)),
    }));
    setEditingRow(null);
    setEditedRowData({});
  };

  const handleCancelRow = (): void => {
    setEditingRow(null);
    setEditedRowData({});
  };

  const handleDeleteRow = (itemId: string): void => {
    if (lineItems.length <= 1) {
      return;
    }
    if (!window.confirm(t.lineItems.deleteConfirm.value)) {
      return;
    }
    setEditedData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter(item => item.id !== itemId),
    }));
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  const handleBulkDelete = (): void => {
    if (selectedRows.size === 0) {
      return;
    }
    if (
      !window.confirm(
        t.lineItems.bulkDeleteConfirm.value.replace('{count}', String(selectedRows.size)),
      )
    ) {
      return;
    }
    setEditedData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter(item => !selectedRows.has(item.id)),
    }));
    setSelectedRows(new Set());
  };

  const addLineItem = (): void => {
    setEditedData(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, { id: createLineItemId(), description: '', amount: 0 }],
    }));
  };

  return (
    <>
      {selectedRows.size > 0 && (
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: 3,
            bgcolor: 'primary.50',
            border: '1px solid',
            borderColor: 'primary.200',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              variant="body1"
              sx={{ fontWeight: 600, color: 'primary.700', fontSize: '0.9375rem' }}
            >
              {t.lineItems.selectedCount.value.replace('{count}', String(selectedRows.size))}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="outlined"
                startIcon={<Layers size={18} />}
                onClick={onOpenBulkCategory}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  borderColor: 'primary.300',
                  color: 'primary.700',
                  '&:hover': { borderColor: 'primary.400', bgcolor: 'primary.100' },
                }}
              >
                {t.lineItems.assignCategory}
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Trash2 size={18} />}
                onClick={handleBulkDelete}
                size="small"
                sx={{ textTransform: 'none', fontWeight: 500 }}
              >
                {t.lineItems.delete}
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderBottomColor: 'divider',
            bgcolor: theme =>
              theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t.lineItems.documentLines}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={addLineItem}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderColor: 'grey.300',
                color: 'text.secondary',
                '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
              }}
            >
              {t.lineItems.addLine}
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={onSaveChanges}
              disabled={saving}
              startIcon={saving ? <Spinner className="h-4 w-4" /> : undefined}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              }}
            >
              {t.lineItems.saveChanges}
            </Button>
          </Box>
        </Box>

        <Table size="small">
          <TableHead>
            <TableRow
              sx={{
                bgcolor: theme =>
                  theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50',
                borderBottom: '1px solid',
                borderBottomColor: 'divider',
              }}
            >
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedRows.size === lineItems.length && lineItems.length > 0}
                  indeterminate={selectedRows.size > 0 && selectedRows.size < lineItems.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableCell>
              {[
                { id: 'date', label: t.lineItems.date.value },
                { id: 'merchant', label: t.lineItems.merchant.value },
                { id: 'description', label: t.lineItems.description.value },
                { id: 'amount', label: t.lineItems.amount.value },
                { id: 'category', label: t.lineItems.category.value },
                { id: 'flags', label: t.lineItems.flags.value },
                { id: 'actions', label: '' },
              ].map(({ id, label }) => (
                <TableCell
                  key={id}
                  align={id === 'amount' ? 'right' : 'left'}
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {lineItems.map((item, index) => (
              <LineItemRow
                key={item.id}
                item={item}
                index={index}
                isEditing={editingRow === item.id}
                isSelected={selectedRows.has(item.id)}
                editedRowData={editedRowData}
                editedData={editedData}
                enabledCategories={enabledCategories}
                selectedCategoryId={selectedCategoryId}
                hasCategory={hasCategory}
                isLowConfidence={isLowConfidence}
                transactionType={transactionType}
                currency={currency}
                lineItemsCount={lineItems.length}
                onSelect={handleRowSelect}
                onEdit={handleEditRow}
                onSaveRow={handleSaveRow}
                onCancelRow={handleCancelRow}
                onDeleteRow={handleDeleteRow}
                onRowFieldChange={handleRowFieldChange}
                setEditedData={setEditedData}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
