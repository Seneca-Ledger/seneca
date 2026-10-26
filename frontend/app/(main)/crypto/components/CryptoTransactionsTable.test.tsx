import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CryptoTransaction } from '../hooks/useCrypto';
import { CryptoTransactionsTable } from './CryptoTransactionsTable';

const labels = {
  title: 'Transactions',
  empty: 'No transactions yet',
  date: 'Date',
  wallet: 'Wallet',
  counterparty: 'Counterparty',
  amount: 'Amount',
  worth: 'Value',
  received: 'Received',
  sent: 'Sent',
  receivedFrom: 'Received from {counterparty}',
  sentTo: 'Sent to {counterparty}',
};

const base: CryptoTransaction = {
  id: 'tx-1',
  date: '2026-10-07T10:00:00.000Z',
  walletId: 'w1',
  walletLabel: 'Tron',
  walletAddress: 'TWBPxxxxxxxxxxxxxxxxxxxxxxxxxxW1JJ',
  walletChainName: 'Tron',
  direction: 'in',
  asset: 'USDT',
  cryptoAmount: '12.5',
  amount: 12.5,
  currency: 'USD',
  counterparty: 'TWBPuiVYJNx7vsp1VsZvDZRxtyZr7nW1JJ',
  txHash: null,
};

describe('CryptoTransactionsTable', () => {
  it('says who the coins came from or went to on one line', () => {
    render(
      <CryptoTransactionsTable
        embedded
        locale="en"
        labels={labels}
        transactions={[
          base,
          {
            ...base,
            id: 'tx-2',
            direction: 'out',
            counterparty: '0x2a52aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2da6',
          },
        ]}
      />,
    );

    expect(screen.getByText(/^Received from TWBP.+W1JJ$/)).toBeInTheDocument();
    expect(screen.getByText(/^Sent to 0x2a52.+2da6$/)).toBeInTheDocument();
    expect(screen.queryByText('Received')).not.toBeInTheDocument();
  });

  it('shows the wallet once, the date short, and incoming coins in sage', () => {
    render(
      <CryptoTransactionsTable embedded locale="en" labels={labels} transactions={[base]} />,
    );

    // Name and network are both "Tron": said once, not twice.
    expect(screen.getAllByText('Tron')).toHaveLength(1);
    expect(screen.getByText('Oct 7, 2026')).toBeInTheDocument();
    expect(screen.getByText(/\+12\.5 USDT/)).toHaveStyle({ color: 'var(--money-up)' });
    // No frame or title of its own inside another card.
    expect(screen.queryByText('Transactions')).not.toBeInTheDocument();
  });

  it('says plainly what happened when the other side is unknown', () => {
    render(
      <CryptoTransactionsTable
        locale="en"
        labels={labels}
        transactions={[{ ...base, direction: 'out', counterparty: null }]}
      />,
    );

    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });
});
