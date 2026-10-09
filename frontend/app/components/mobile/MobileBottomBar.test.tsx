import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MobileBottomBar from './MobileBottomBar';

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
    const menu = container.querySelector('.lumio-bottom-bar__fab-menu');

    expect(menu).toHaveAttribute('inert');

    fireEvent.click(screen.getByRole('button', { name: 'Quick actions' }));

    expect(menu).not.toHaveAttribute('inert');
  });
});
