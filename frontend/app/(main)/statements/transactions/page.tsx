'use client';

import { TransactionTab } from '@/app/components/dashboard/TransactionTab';

export default function StatementTransactionsPage() {
  return (
    // The /statements shell clips its last child, so every page there scrolls itself.
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: 32,
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <TransactionTab />
    </div>
  );
}
