import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Plus } from '@/app/components/icons';
import MobileBottomBar from './MobileBottomBar';
import { useQuickActions } from './quick-actions-store';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('./MobileMenuDrawer', () => ({
  MobileMenuDrawer: () => null,
}));

vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({ user: { name: 'Symon', avatarUrl: null } }),
}));

describe('MobileBottomBar', () => {
  it('keeps the quick actions out of the Tab order until the FAB opens them', () => {
    const { container } = render(<MobileBottomBar />);
    const menu = container.querySelector('.seneca-bottom-bar__fab-menu');

    expect(menu).toHaveAttribute('inert');

    fireEvent.click(screen.getByRole('button', { name: 'Quick actions' }));

    expect(menu).not.toHaveAttribute('inert');
  });

  it("offers the page's own actions under the + and the default set once the page leaves", () => {
    const newThing = vi.fn();
    function Page(): null {
      useQuickActions([{ id: 'new-thing', label: 'New thing', icon: Plus, run: newThing }]);
      return null;
    }
    const { rerender } = render(
      <>
        <Page />
        <MobileBottomBar />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quick actions' }));
    expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New thing' }));
    expect(newThing).toHaveBeenCalledOnce();

    rerender(<MobileBottomBar />);
    expect(screen.queryByRole('button', { name: 'New thing' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });
});
