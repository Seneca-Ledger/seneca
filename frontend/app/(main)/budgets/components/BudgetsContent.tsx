'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import NextLink from 'next/link';
import { useEffect } from 'react';
import { ImportFromFileButton } from '@/app/components/import-wizard/ImportFromFileButton';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import type { BudgetFormData, BudgetItem } from '../hooks/useBudgetsPage';
import { useStoicBalance } from '../hooks/useStoicBalance';
import { BudgetCard } from './BudgetCard';
import { BudgetFormDrawer } from './BudgetFormDrawer';
import { StoicBalance } from './StoicBalance';

/** Anchor of the budget list; the dashboard's "View all" links to `/budgets#budget-list`. */
export const BUDGET_LIST_ID = 'budget-list';

function BudgetCardSkeleton(): React.JSX.Element {
  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: tokens.radius.lg,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}
      >
        <Box>
          <Skeleton variant="text" width={140} height={24} />
          <Skeleton variant="text" width={100} height={16} />
        </Box>
      </Box>
      <Skeleton variant="rounded" height={8} sx={{ borderRadius: 4, mb: 1 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton variant="text" width={120} height={20} />
        <Skeleton variant="text" width={40} height={20} />
      </Box>
    </Box>
  );
}

interface BudgetsContentProps {
  budgets: BudgetItem[];
  isPending: boolean;
  isFetching: boolean;
  error: string | null;
  dialogOpen: boolean;
  editingBudget: BudgetItem | null;
  formData: BudgetFormData;
  saving: boolean;
  setFormData: (data: BudgetFormData) => void;
  openCreate: (categoryId?: string) => void;
  refresh: () => void;
  openEdit: (budget: BudgetItem) => void;
  closeDialog: () => void;
  handleSave: () => void;
  handleDelete: (id: string) => void;
}

export function BudgetsContent({
  budgets,
  isPending,
  isFetching,
  error,
  dialogOpen,
  editingBudget,
  formData,
  saving,
  setFormData,
  openCreate,
  refresh,
  openEdit,
  closeDialog,
  handleSave,
  handleDelete,
}: BudgetsContentProps) {
  const t = useIntlayer('budgetsPage');
  const { hasPermission } = usePermissions();
  const { balance } = useStoicBalance();
  const classOf = new Map(
    (balance?.categories ?? []).map(category => [category.id, category.stoicClass]),
  );
  const listReady = !(isPending || error) && budgets.length > 0;
  // The browser's own jump to the anchor fires before the list has loaded,
  // so the scroll waits for the cards to render.
  useEffect(() => {
    if (listReady && window.location.hash === `#${BUDGET_LIST_ID}`) {
      document
        .getElementById(BUDGET_LIST_ID)
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [listReady]);
  return (
    <Box sx={{ px: { xs: 2, md: 4 }, pt: 'var(--lumio-page-top, 24px)', pb: 3, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {/* Budgets can fund a goal, so the goals page is reached from here. */}
          {hasPermission('goal.view') && (
            <Button variant="outlined" component={NextLink} href="/goals">
              {t.savingsGoals}
            </Button>
          )}
          <ImportFromFileButton
            target="budgets"
            onImported={refresh}
            renderTrigger={(open, label) => (
              <Button variant="outlined" onClick={open}>
                {label}
              </Button>
            )}
          />
          <Button variant="contained" onClick={() => openCreate()}>
            {t.newBudget}
          </Button>
        </Box>
      </Box>

      <StoicBalance />

      {isPending && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Array.from({ length: 5 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <BudgetCardSkeleton key={index} />
          ))}
        </Box>
      )}

      {error && !isPending && (
        <Typography color="error" sx={{ py: 4, textAlign: 'center' }}>
          {error}
        </Typography>
      )}

      {!(isPending || error) && budgets.length === 0 && (
        <EmptyState
          illustration="top-categories"
          description={t.emptyDescription}
          action={
            <Button variant="outlined" onClick={() => openCreate()}>
              {t.createFirst}
            </Button>
          }
        />
      )}

      {listReady && (
        // Удаление и сохранение перезагружают список в фоне, не гася карточки.
        <Box
          id={BUDGET_LIST_ID}
          sx={{
            scrollMarginTop: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            opacity: isFetching ? 0.6 : 1,
            transition: 'opacity 150ms ease',
          }}
        >
          {budgets.map(budget => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              stoicClass={classOf.get(budget.categoryId) ?? null}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </Box>
      )}

      <BudgetFormDrawer
        open={dialogOpen}
        editing={editingBudget}
        formData={formData}
        saving={saving}
        onFormChange={setFormData}
        onSave={handleSave}
        onClose={closeDialog}
      />
    </Box>
  );
}
