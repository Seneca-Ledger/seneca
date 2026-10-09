'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useSearchParams } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import DetailsDrawer from '@/app/components/transactions/DetailsDrawer';
import { useBulkUpdateCategory } from '@/app/components/transactions/hooks/useBulkUpdateCategory';
import { useBulkUpdateOwner } from '@/app/components/transactions/hooks/useBulkUpdateOwner';
import { useTransactionData } from '@/app/components/transactions/hooks/useTransactionData';
import { useViewPreference } from '@/app/components/transactions/hooks/useViewPreference';
import { useWorkspaceMembers } from '@/app/components/transactions/hooks/useWorkspaceMembers';
import {
  OWNER_SHARED,
  OwnerFilterDropdown,
  ownerValueToMemberId,
} from '@/app/components/transactions/OwnerFilterDropdown';
import TransactionsTable from '@/app/components/transactions/TransactionsTable';
import type { FilterState, Transaction } from '@/app/components/transactions/types';
import { CurrencyDisplayToggle } from '@/app/components/ui/CurrencyDisplayToggle';
import { CurrencyFilterDropdown } from '@/app/components/ui/CurrencyFilterDropdown';
import { Select } from '@/app/components/ui/select';
import { useCurrencyDisplay } from '@/app/contexts/CurrencyDisplayContext';
import { useIntlayer } from '@/app/i18n';
import { isPrivateCategory } from '@/app/lib/private-category';
import { tokens } from '@/lib/theme-tokens';

const TX_ROW_SKELETON_KEYS = ['tx-0', 'tx-1', 'tx-2', 'tx-3', 'tx-4', 'tx-5', 'tx-6', 'tx-7'];

function TransactionTabSkeleton(): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Skeleton variant="rounded" width={448} height={38} sx={{ maxWidth: '100%' }} />
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          <Skeleton variant="rounded" width={200} height={32} />
          <Skeleton variant="rounded" width={96} height={38} />
        </Box>
      </Box>
      <Box className="lumio-tx-table__thead" sx={{ display: 'flex', gap: 2, px: 2, py: 1 }}>
        <Skeleton variant="rounded" width={16} height={16} />
        <Skeleton variant="text" width={70} height={16} />
        <Skeleton variant="text" width="20%" height={16} />
        <Skeleton variant="text" width="20%" height={16} />
        <Skeleton variant="text" width={80} height={16} sx={{ ml: 'auto' }} />
        <Skeleton variant="text" width={80} height={16} />
        <Skeleton variant="rounded" width={90} height={16} />
      </Box>
      {TX_ROW_SKELETON_KEYS.map(key => (
        <Box
          key={key}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2,
            py: 1.25,
            borderTop: '1px solid var(--border)',
          }}
        >
          <Skeleton variant="rounded" width={16} height={16} />
          <Skeleton variant="text" width={70} height={16} />
          <Skeleton variant="text" width="20%" height={16} />
          <Skeleton variant="text" width="20%" height={16} />
          <Skeleton variant="text" width={80} height={16} sx={{ ml: 'auto' }} />
          <Skeleton variant="text" width={80} height={16} />
          <Skeleton variant="rounded" width={90} height={20} />
        </Box>
      ))}
    </Box>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function, complexity
export function TransactionTab() {
  const t = useIntlayer('transactionsPageView');
  const tOwner = useIntlayer('transactionOwner');
  const { showConverted, workspaceCurrency } = useCurrencyDisplay();
  const searchParams = useSearchParams();
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const bulkUpdateCategory = useBulkUpdateCategory();
  const bulkUpdateOwner = useBulkUpdateOwner();
  const members = useWorkspaceMembers();
  const [currencyFilter, setCurrencyFilterState] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilterState] = useState<string | null>(null);
  // The page comes back the way it was left; until the saved state arrives the
  // filters stay at their defaults rather than flashing somebody else's.
  const viewPreference = useViewPreference<{
    owner?: string | null;
    currency?: string | null;
  }>('transactions');
  const restored = useRef(false);
  if (!restored.current && viewPreference.state !== undefined && members.length > 0) {
    restored.current = true;
    if (viewPreference.state) {
      // A remembered owner the dropdown can no longer offer — a member who left,
      // or a value from an older client — would filter the list down to nothing
      // with no way to see why. Drop it rather than show an empty page.
      const owner = viewPreference.state.owner ?? null;
      const known =
        owner === null ||
        owner === OWNER_SHARED ||
        members.some(member => member.memberId === owner);
      setOwnerFilterState(known ? owner : null);
      setCurrencyFilterState(viewPreference.state.currency ?? null);
    }
  }

  const setOwnerFilter = (value: string | null): void => {
    setOwnerFilterState(value);
    viewPreference.save({ owner: value, currency: currencyFilter });
  };
  const setCurrencyFilter = (value: string | null): void => {
    setCurrencyFilterState(value);
    viewPreference.save({ owner: ownerFilter, currency: value });
  };
  const { transactions, categories, isPending, error, refetch } = useTransactionData({
    showConverted,
    workspaceCurrency,
    currencyFilter,
    owner: ownerFilter,
    startDate,
    endDate,
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailsTransaction, setDetailsTransaction] = useState<Transaction | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  const [bulkOwnerId, setBulkOwnerId] = useState<string>('');

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    category: null,
  });

  const availableCurrencies = useMemo(
    () => [...new Set(transactions.map(tx => tx.currency).filter(Boolean) as string[])].sort(),
    [transactions],
  );

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleRowClick = (transaction: Transaction) => {
    setDetailsTransaction(transaction);
    setDrawerOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setDetailsTransaction(null), 300);
  };

  // eslint-disable-next-line max-params, @typescript-eslint/explicit-function-return-type
  const handleUpdateCategory = async (txIds: string[], categoryId: string) => {
    // Messages resolved outside the promise chain and no try/catch here:
    // React Compiler skips components with optional chaining inside `try`.
    const successMessage = t.categoriesUpdated?.value || 'Category updated successfully';
    const failureMessage = t.bulkUpdateFailed?.value || 'Failed to update category';
    await bulkUpdateCategory.mutateAsync({ txIds, categoryId }).then(
      () => toast.success(successMessage),
      (err: unknown) => {
        console.error('Failed to update category:', err);
        toast.error(failureMessage);
        throw err;
      },
    );
  };

  // eslint-disable-next-line max-params, @typescript-eslint/explicit-function-return-type
  const handleSingleUpdateCategory = async (txId: string, categoryId: string) => {
    // Error already reported in handleUpdateCategory.
    await handleUpdateCategory([txId], categoryId).then(handleCloseDrawer, () => undefined);
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleSplitDone = async () => {
    handleCloseDrawer();
    refetch();
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleBulkAssignCategory = async () => {
    if (!bulkCategoryId || selectedIds.length === 0) return;
    try {
      await handleUpdateCategory(selectedIds, bulkCategoryId);
      setSelectedIds([]);
      setBulkCategoryId('');
    } catch {
      // Error handled in handleUpdateCategory
    }
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleBulkAssignOwner = async () => {
    if (!bulkOwnerId || selectedIds.length === 0) return;
    const successMessage = tOwner.ownerUpdated.value;
    const failureMessage = tOwner.ownerUpdateFailed.value;
    await bulkUpdateOwner
      .mutateAsync({
        txIds: selectedIds,
        ownerMemberId: ownerValueToMemberId(bulkOwnerId),
      })
      .then(
        () => {
          toast.success(successMessage);
          setSelectedIds([]);
          setBulkOwnerId('');
        },
        (err: unknown) => {
          console.error('Failed to update owner:', err);
          toast.error(failureMessage);
        },
      );
  };

  if (isPending && transactions.length === 0) {
    return <TransactionTabSkeleton />;
  }

  if (error && transactions.length === 0) {
    return (
      <Box
        sx={{
          border: '1px solid #fecaca',
          bgcolor: 'var(--color-error-soft-bg)',
          p: 2,
          color: 'var(--destructive)',
          mb: 2,
        }}
      >
        {error}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Bulk Actions Toolbar */}
      {selectedIds.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
            border: '1px solid rgba(var(--primary-rgb), 0.3)',
            bgcolor: 'rgba(var(--primary-rgb), 0.05)',
            p: 2,
            transition: 'all 300ms',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                height: 24,
                width: 24,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: tokens.radius.full,
                bgcolor: 'var(--primary)',
                fontSize: 12,
                fontWeight: 700,
                color: 'white',
              }}
            >
              {selectedIds.length}
            </Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {t.selected?.value || 'selected'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', gap: 1 }}>
            <Select
              value={bulkCategoryId}
              onChange={setBulkCategoryId}
              options={[
                { value: '', label: t.selectCategory?.value || 'Select category...' },
                ...categories
                  .filter(cat => !isPrivateCategory(cat) && cat.isEnabled !== false)
                  .map(cat => ({ value: cat.id, label: cat.name })),
              ]}
              sx={{ flex: 1, maxWidth: 320, backgroundColor: 'var(--card-bg)' }}
            />

            {members.length > 0 && (
              <Select
                value={bulkOwnerId}
                onChange={value => {
                  setBulkOwnerId(value);
                }}
                aria-label={tOwner.assignOwner.value}
                options={[
                  { value: '', label: tOwner.assignOwner.value },
                  { value: OWNER_SHARED, label: tOwner.shared.value },
                  ...members.map(member => ({
                    value: member.memberId,
                    label: member.isSelf ? tOwner.me.value : member.label,
                  })),
                ]}
                sx={{ minWidth: 170, backgroundColor: 'var(--card-bg)' }}
              />
            )}

            <button
              type="button"
              onClick={bulkOwnerId ? handleBulkAssignOwner : handleBulkAssignCategory}
              disabled={!(bulkCategoryId || bulkOwnerId)}
              style={{
                backgroundColor: 'var(--primary-fill)',
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
                border: 'none',
                cursor: bulkCategoryId || bulkOwnerId ? 'pointer' : 'not-allowed',
                opacity: bulkCategoryId || bulkOwnerId ? 1 : 0.5,
                transition: 'opacity 150ms',
              }}
            >
              {t.apply?.value || 'Apply'}
            </button>
          </Box>

          <button
            type="button"
            onClick={() => setSelectedIds([])}
            style={{
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--card-bg)',
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--foreground)',
              cursor: 'pointer',
              transition: 'background-color 150ms',
            }}
          >
            {t.clearSelection?.value || 'Clear selection'}
          </button>
        </Box>
      )}

      {/* Transactions Table */}
      <TransactionsTable
        transactions={transactions}
        categories={categories}
        selectedIds={selectedIds}
        onSelectRows={setSelectedIds}
        onRowClick={handleRowClick}
        onUpdateCategory={handleSingleUpdateCategory}
        filters={filters}
        onFilterChange={setFilters}
        toolbarExtra={
          <>
            <CurrencyDisplayToggle />
            <CurrencyFilterDropdown
              currencies={availableCurrencies}
              value={currencyFilter}
              onChange={setCurrencyFilter}
            />
            <OwnerFilterDropdown members={members} value={ownerFilter} onChange={setOwnerFilter} />
          </>
        }
      />

      {/* Details Drawer */}
      <DetailsDrawer
        open={drawerOpen}
        transaction={detailsTransaction}
        categories={categories}
        onClose={handleCloseDrawer}
        onUpdateCategory={handleSingleUpdateCategory}
        onSplitDone={handleSplitDone}
      />
    </Box>
  );
}
