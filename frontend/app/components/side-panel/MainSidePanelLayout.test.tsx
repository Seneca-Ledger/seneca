import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MainSidePanelLayout as MainSidePanelLayoutBase } from './MainSidePanelLayout';
import { SidePanelProvider } from './SidePanelContext';
import { useSidePanelConfig } from './hooks/useSidePanelConfig';
import type { SidePanelPageConfig } from './types';

const pathnameRef = vi.hoisted(() => ({ current: '/statements' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
}));

const config: SidePanelPageConfig = {
  pageId: 'mobile-panel-test',
  header: {
    title: 'Statements',
  },
  sections: [
    {
      id: 'navigation',
      type: 'navigation',
      items: [
        {
          id: 'submit',
          label: 'Submit',
          href: '/statements/submit',
        },
      ],
    },
  ],
  footer: {
    content: <FooterProbe />,
  },
};

function FooterProbe({ placement = 'panel' }: { placement?: string }) {
  return <div data-testid="mobile-footer-probe" data-placement={placement} />;
}

// The provider lives in the root layout in the app.
function MainSidePanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidePanelProvider persistState={false}>
      <MainSidePanelLayoutBase>{children}</MainSidePanelLayoutBase>
    </SidePanelProvider>
  );
}

function ConfigRegistrar() {
  useSidePanelConfig({ config, autoRegister: true });
  return null;
}

describe('MainSidePanelLayout mobile panel', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    pathnameRef.current = '/statements';
  });

  // The floating open button was removed (3c284588): on mobile only the page's
  // footer floats, with the floating placement, and no panel dialog is shown.
  it('floats the panel footer on mobile without an open trigger', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MainSidePanelLayout>
          <ConfigRegistrar />
          <div>Page content</div>
        </MainSidePanelLayout>,
      );
    });

    expect(container.querySelector('[data-testid="mobile-side-panel-open"]')).toBeNull();
    const floatingFooterContainer = container.querySelector(
      '[data-testid="mobile-side-panel-floating-footer"]',
    ) as HTMLDivElement | null;
    expect(floatingFooterContainer).toBeTruthy();
    const mobileFooterProbe = floatingFooterContainer?.querySelector(
      '[data-testid="mobile-footer-probe"]',
    ) as HTMLDivElement | null;
    expect(mobileFooterProbe).toBeTruthy();
    expect(mobileFooterProbe?.dataset.placement).toBe('floating');
    expect(container.querySelector('[data-testid="mobile-side-panel-dialog"]')).toBeNull();
  });

  it('does not render trigger when side panel config is missing', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MainSidePanelLayout>
          <div>No side panel config</div>
        </MainSidePanelLayout>,
      );
    });

    expect(container.querySelector('[data-testid="mobile-side-panel-open"]')).toBeNull();
  });

  it('hides the floating footer when global mobile menu is open', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MainSidePanelLayout>
          <ConfigRegistrar />
          <div>Page content</div>
        </MainSidePanelLayout>,
      );
    });

    expect(
      container.querySelector('[data-testid="mobile-side-panel-floating-footer"]'),
    ).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('seneca-mobile-menu-visibility', { detail: { open: true } }),
      );
    });

    expect(container.querySelector('[data-testid="mobile-side-panel-floating-footer"]')).toBeNull();
  });
});
