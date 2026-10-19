// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppChrome from './AppChrome';

const mocks = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('./Sidebar', () => {
  const SidebarContent = () => <nav aria-label="Main navigation" />;
  return {
    default: () => (
      <aside data-testid="sidebar">
        <SidebarContent />
      </aside>
    ),
    SidebarContent,
  };
});

describe('AppChrome', () => {
  beforeEach(() => {
    mocks.pathname = '/';
  });

  it.each([
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ])('renders no sidebar on the auth screen %s', pathname => {
    mocks.pathname = pathname;
    const { container } = render(<AppChrome />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the sidebar on app routes', () => {
    mocks.pathname = '/dashboard';
    const { getByTestId } = render(<AppChrome />);
    expect(getByTestId('sidebar')).toBeInTheDocument();
  });

  it('renders the navigation once, without an off-screen copy in the Tab order', () => {
    mocks.pathname = '/dashboard';
    render(<AppChrome />);

    expect(screen.getAllByRole('navigation', { name: 'Main navigation' })).toHaveLength(1);
  });
});
