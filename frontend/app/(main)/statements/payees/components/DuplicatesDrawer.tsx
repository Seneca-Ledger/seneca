'use client';

import Button from '@mui/material/Button';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useMergePayees } from '@/app/components/payees/usePayees';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { VendorIcon } from '@/app/components/VendorIcon';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { PayeeDuplicateGroups } from '@/app/lib/contracts';

type Group = PayeeDuplicateGroups[number];

/** One group: the names side by side, the busiest picked to keep, merge or skip. */
function GroupCard({ group, onDone }: { group: Group; onDone: () => void }): React.JSX.Element {
  const t = useIntlayer('payeesPage');
  const tPayees = useIntlayer('payees');
  const merge = useMergePayees();
  const [keep, setKeep] = useState(group.payees[0]?.id ?? '');

  const run = () => {
    const sourceIds = group.payees.filter(payee => payee.id !== keep).map(payee => payee.id);
    void merge
      .mutateAsync({ targetId: keep, sourceIds })
      .then(() => {
        toast.success(tPayees.merged.value);
        onDone();
      })
      .catch((error: unknown) => toast.error(getApiErrorMessage(error, tPayees.failed.value)));
  };

  return (
    <fieldset
      style={{
        margin: 0,
        padding: 16,
        border: '1px solid var(--border)',
        borderRadius: 12,
        display: 'grid',
        gap: 8,
      }}
    >
      <legend style={{ fontSize: 13, color: 'var(--text-muted)', padding: '0 4px' }}>
        {t.keepName}
      </legend>
      {group.payees.map(payee => (
        <label
          key={payee.id}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <input
            type="radio"
            name={`keep-${group.payees[0]?.id}`}
            checked={keep === payee.id}
            onChange={() => setKeep(payee.id)}
          />
          <VendorIcon vendorName={payee.name} size={24} />
          <span style={{ flex: 1, fontSize: 14, color: 'var(--foreground)' }}>{payee.name}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{payee.count}</span>
        </label>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="text" onClick={onDone} disabled={merge.isPending}>
          {t.skip}
        </Button>
        <Button variant="contained" onClick={run} disabled={merge.isPending || !keep}>
          {t.mergeGroup}
        </Button>
      </div>
    </fieldset>
  );
}

/**
 * Payees that look like one business, a group at a time. A skipped group stays
 * skipped until the drawer is opened again; a merged one is gone for good.
 */
export function DuplicatesDrawer({
  open,
  groups,
  onClose,
}: {
  open: boolean;
  groups: PayeeDuplicateGroups;
  onClose: () => void;
}): React.JSX.Element {
  const t = useIntlayer('payeesPage');
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSkipped(new Set());
    }
  }, [open]);

  const keyOf = (group: Group) => group.payees.map(payee => payee.id).join(',');
  const left = groups.filter(group => !skipped.has(keyOf(group)));

  return (
    <DrawerShell
      isOpen={open}
      onClose={onClose}
      position="right"
      width="lg"
      title={t.duplicatesDrawerTitle.value}
    >
      <div style={{ display: 'grid', gap: 16, padding: '4px 4px 16px' }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{t.duplicatesHint}</p>
        {left.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{t.noDuplicates}</p>
        ) : (
          left.map(group => (
            <GroupCard
              key={keyOf(group)}
              group={group}
              onDone={() => setSkipped(previous => new Set(previous).add(keyOf(group)))}
            />
          ))
        )}
      </div>
    </DrawerShell>
  );
}
