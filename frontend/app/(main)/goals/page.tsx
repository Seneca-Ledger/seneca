'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { useIntlayer, useLocale } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { ContributionDrawer } from './components/ContributionDrawer';
import { GoalCard } from './components/GoalCard';
import { GoalFormDrawer } from './components/GoalFormDrawer';
import { EMPTY_GOAL_FORM, type Goal, type GoalFormData, useGoals } from './hooks/useGoals';

function GoalCardSkeleton(): React.JSX.Element {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
        p: 2.5,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0 }}>
          <Skeleton variant="text" width={140} height={22} />
          <Skeleton variant="text" width={80} height={16} />
        </Box>
        <Skeleton variant="text" width={120} height={22} />
      </Box>
      <Skeleton variant="rounded" height={8} sx={{ borderRadius: tokens.radius.full, my: 1.5 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Skeleton variant="text" width={160} height={20} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Skeleton variant="rounded" width={70} height={30} />
          <Skeleton variant="rounded" width={50} height={30} />
          <Skeleton variant="rounded" width={60} height={30} />
        </Box>
      </Box>
    </Box>
  );
}

export default function GoalsPage() {
  const t = useIntlayer('goalsPage');
  const { locale } = useLocale();
  const {
    goals,
    isPending,
    isFetching,
    error,
    saving,
    createGoal,
    updateGoal,
    deleteGoal,
    addContribution,
  } = useGoals();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalFormData>(EMPTY_GOAL_FORM);

  const [contributing, setContributing] = useState<Goal | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_GOAL_FORM);
    setFormOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setForm({
      name: goal.name,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate ?? '',
    });
    setFormOpen(true);
  };

  const saveGoal = async () => {
    const ok = editing ? await updateGoal(editing.id, form) : await createGoal(form);
    if (ok) {
      setFormOpen(false);
    }
  };

  const openContribution = (goal: Goal) => {
    setContributing(goal);
    setAmount('');
    setNote('');
  };

  const saveContribution = async () => {
    if (!contributing) {
      return;
    }
    const ok = await addContribution(contributing.id, Number(amount), note);
    if (ok) {
      setContributing(null);
    }
  };

  return (
    <Box
      component="main"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--lumio-page-top, 24px)', pb: 3, width: '100%' }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'flex-start',
          gap: 2,
          mb: 3,
          flexWrap: 'wrap',
        }}
      >
        <Button variant="contained" onClick={openCreate}>
          {t.newGoal}
        </Button>
      </Box>

      {isPending && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <GoalCardSkeleton key={index} />
          ))}
        </Box>
      )}

      {error && !isPending && (
        <Typography color="error" sx={{ py: 6, textAlign: 'center' }}>
          {t.error}
        </Typography>
      )}

      {!(isPending || error) && goals.length === 0 && (
        <EmptyState illustration="goals" description={t.empty} />
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          // Список остаётся на экране, пока мутация перезагружает цели.
          opacity: isFetching ? 0.6 : 1,
          transition: 'opacity 150ms ease',
        }}
      >
        {goals.map(goal => (
          <GoalCard
            key={goal.id}
            goal={goal}
            locale={locale}
            labels={{
              reached: t.reached.value,
              remaining: t.remaining.value,
            }}
            actions={
              <>
                <Button size="small" variant="outlined" onClick={() => openContribution(goal)}>
                  {t.addContribution}
                </Button>
                <Button size="small" onClick={() => openEdit(goal)}>
                  {t.edit}
                </Button>
                <Button size="small" color="error" onClick={() => void deleteGoal(goal.id)}>
                  {t.remove}
                </Button>
              </>
            }
          />
        ))}
      </Box>

      <GoalFormDrawer
        open={formOpen}
        title={editing ? t.edit.value : t.newGoal.value}
        form={form}
        saving={saving}
        currentCover={editing?.cover ?? null}
        labels={{
          name: t.nameLabel.value,
          target: t.targetLabel.value,
          date: t.dateLabel.value,
          save: t.save.value,
          cancel: t.cancel.value,
          cover: t.coverLabel.value,
          chooseCover: t.chooseCover.value,
          picker: {
            title: t.coverPickerTitle.value,
            presets: t.coverPresets.value,
            photos: t.coverPhotos.value,
            searchPlaceholder: t.coverSearchPlaceholder.value,
            search: t.coverSearch.value,
            noResults: t.coverNoResults.value,
            searchHint: t.coverSearchHint.value,
            licenceNote: t.coverLicenceNote.value,
            remove: t.coverRemove.value,
            close: t.close.value,
          },
        }}
        onChange={setForm}
        onClose={() => setFormOpen(false)}
        onSave={() => void saveGoal()}
      />

      <ContributionDrawer
        open={contributing !== null}
        title={contributing?.name ?? ''}
        amount={amount}
        note={note}
        saving={saving}
        labels={{
          amount: t.amountLabel.value,
          note: t.noteLabel.value,
          save: t.save.value,
          cancel: t.cancel.value,
        }}
        onAmountChange={setAmount}
        onNoteChange={setNote}
        onClose={() => setContributing(null)}
        onSave={() => void saveContribution()}
      />
    </Box>
  );
}
