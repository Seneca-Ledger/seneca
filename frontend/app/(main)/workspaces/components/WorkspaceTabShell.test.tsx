// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceTabShell from './WorkspaceTabShell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    loading: false,
    currentWorkspace: { id: 'ws-1', name: 'Acme', stats: { memberCount: 3 } },
  }),
}));

vi.mock('./WorkspacesListContent', () => ({
  default: () => <div data-testid="all-workspaces-list" />,
}));

describe('WorkspaceTabShell', () => {
  it('links the workspace sections as tabs in the page, marking the current one', () => {
    render(
      <WorkspaceTabShell activeItem="members">
        <div>Members view</div>
      </WorkspaceTabShell>,
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(tab => tab.textContent)).toEqual([
      'Overview',
      'Members (3)',
      'Categories',
      'Payees',
      'All Workspaces',
    ]);
    expect(tabs[0]).toHaveAttribute('href', '/workspaces/overview');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Members view')).toBeInTheDocument();
  });

  it('swaps the view for the workspace list and back', () => {
    render(
      <WorkspaceTabShell activeItem="overview">
        <div>Overview view</div>
      </WorkspaceTabShell>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'All Workspaces' }));
    expect(screen.getByTestId('all-workspaces-list')).toBeInTheDocument();
    expect(screen.queryByText('Overview view')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByText('Overview view')).toBeInTheDocument();
  });
});
