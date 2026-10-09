import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MobileMenuDrawer } from './MobileMenuDrawer';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));

// The account entry has its own auth, router and notification wiring; this test
// is about the drawer's focus trap, so a focusable stand-in is enough.
vi.mock('../navigation/AccountMenu', () => ({
  AccountMenu: () => (
    <button type="button" className="lumio-account__trigger">
      Account
    </button>
  ),
}));

// Mirrors react-intlayer's renderIntlayerNode: usable as a JSX child and via `.value`.
const node = (v: string) =>
  // biome-ignore lint/complexity/noUselessFragments: Proxy needs an object target — a bare string can't be proxied
  new Proxy(<>{v}</>, {
    get(target, prop, receiver) {
      if (prop === 'value') return v;
      return Reflect.get(target, prop, receiver);
    },
  });

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    nav: new Proxy({}, { get: (_target, key) => String(key) }),
    shell: { menu: node('Menu'), closeMenu: node('Close menu'), help: node('Help') },
    userMenu: { workspace: node('Workspace'), settings: node('Settings') },
  }),
}));

let openDrawer: () => void = () => {};
let closeDrawer: () => void = () => {};

function Harness() {
  const [open, setOpen] = useState(false);
  openDrawer = () => setOpen(true);
  closeDrawer = () => setOpen(false);
  return (
    <>
      <button type="button">Open menu</button>
      <MobileMenuDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function getDrawer(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Menu', hidden: true });
}

describe('MobileMenuDrawer', () => {
  it('keeps the closed drawer out of the Tab order', () => {
    render(<Harness />);

    expect(getDrawer()).toHaveAttribute('inert');
  });

  it('moves focus into the open drawer and back to the trigger on close', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    trigger.focus();

    act(() => openDrawer());
    const drawer = getDrawer();
    expect(drawer).not.toHaveAttribute('inert');
    expect(drawer.contains(document.activeElement)).toBe(true);

    act(() => closeDrawer());
    expect(document.activeElement).toBe(trigger);
  });
});
