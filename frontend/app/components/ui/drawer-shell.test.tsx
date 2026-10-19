// @vitest-environment jsdom
import Dialog from '@mui/material/Dialog';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DrawerShell } from './drawer-shell';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({ closeDrawer: { value: 'Close' } }),
}));

function DialogUnder({ drawerOpen }: { drawerOpen: boolean }): React.JSX.Element {
  return (
    <>
      <Dialog open>dialog</Dialog>
      <DrawerShell isOpen={drawerOpen} onClose={() => {}}>
        drawer
      </DrawerShell>
    </>
  );
}

function modalRoot(text: string): HTMLElement {
  const root = screen.getByText(text).closest('.MuiDrawer-root');
  if (!(root instanceof HTMLElement)) {
    throw new Error(`no drawer root for ${text}`);
  }
  return root;
}

function Stack({ childOpen }: { childOpen: boolean }): React.JSX.Element {
  return (
    <>
      <DrawerShell isOpen onClose={() => {}}>
        back
      </DrawerShell>
      <DrawerShell isOpen={childOpen} onClose={() => {}}>
        front
      </DrawerShell>
    </>
  );
}

const isCovered = (text: string): boolean => modalRoot(text).hasAttribute('data-seneca-covered');

describe('DrawerShell stacking', () => {
  it('hides the drawer underneath while another one is open on top', () => {
    const { rerender } = render(<Stack childOpen={false} />);
    expect(isCovered('back')).toBe(false);

    rerender(<Stack childOpen />);
    expect(isCovered('back')).toBe(true);
    expect(isCovered('front')).toBe(false);

    rerender(<Stack childOpen={false} />);
    expect(isCovered('back')).toBe(false);
  });

  it('hides a dialog underneath as well', () => {
    const { rerender } = render(<DialogUnder drawerOpen={false} />);
    const dialogRoot = (): Element | null => screen.getByText('dialog').closest('.MuiDialog-root');
    expect(dialogRoot()?.hasAttribute('data-seneca-covered')).toBe(false);

    rerender(<DialogUnder drawerOpen />);
    expect(dialogRoot()?.hasAttribute('data-seneca-covered')).toBe(true);

    rerender(<DialogUnder drawerOpen={false} />);
    expect(dialogRoot()?.hasAttribute('data-seneca-covered')).toBe(false);
  });
});
