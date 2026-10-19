// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatementsPayPage from './page';

vi.mock('../components/StatementsListView', () => ({
  default: () => <div>legacy-statements-list-view</div>,
}));

vi.mock('../components/payables/PayablesView', () => ({
  PayablesView: () => <div>payables-view</div>,
}));

describe('StatementsPayPage', () => {
  it('renders the dedicated payables view', () => {
    render(<StatementsPayPage />);

    expect(screen.getByText('payables-view')).toBeInTheDocument();
    expect(screen.queryByText('legacy-statements-list-view')).not.toBeInTheDocument();
  });
});
