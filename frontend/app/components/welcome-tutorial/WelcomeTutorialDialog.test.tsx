// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { IntlayerProviderContent } from 'react-intlayer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WelcomeTutorialDialog from './WelcomeTutorialDialog';
import { TUTORIAL_SCREENS } from './welcome-tutorial-screens';
import type { TutorialStep } from './welcome-tutorial-steps';

const STEPS: TutorialStep[] = [
  {
    id: 'dashboard',
    path: '/dashboard',
    label: 'Dashboard',
    title: 'Dashboard',
    icon: <span />,
    fragments: TUTORIAL_SCREENS.dashboard,
  },
  {
    id: 'crypto',
    path: '/crypto',
    label: 'Crypto',
    title: 'Crypto',
    icon: <span />,
    fragments: TUTORIAL_SCREENS.crypto,
  },
];

// Which pages are visible depends on permissions; that is tested with the step builder.
vi.mock('./useTutorialSteps', () => ({ useTutorialSteps: () => STEPS }));

function renderDialog(onClose: () => void, locale = 'en', page: 'crypto' | null = null): void {
  render(
    <IntlayerProviderContent locale={locale as 'en'} setLocale={() => undefined}>
      <WelcomeTutorialDialog open page={page} onClose={onClose} />
    </IntlayerProviderContent>,
  );
}

const heading = (): HTMLElement => screen.getByRole('heading', { level: 2 });
const press = (key: string): boolean => fireEvent.keyDown(screen.getByRole('dialog'), { key });
const click = (name: string): boolean => fireEvent.click(screen.getByRole('button', { name }));

/** A stand-in for the real sidebar: one nav item, measured where the sidebar would put it. */
function mountSidebarItem(path: string, rect: Partial<DOMRect>): void {
  const aside = document.createElement('aside');
  const item = document.createElement('a');
  item.dataset.navPath = path;
  aside.append(item);
  document.body.append(aside);
  const box = { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, ...rect };
  item.getBoundingClientRect = () => box as DOMRect;
  aside.getBoundingClientRect = () => ({ ...box, left: 0, right: 192 }) as DOMRect;
}

describe('WelcomeTutorialDialog', () => {
  afterEach(() => {
    for (const aside of document.querySelectorAll('aside')) aside.remove();
  });

  it('opens on the first page and turns pages with the buttons and the arrow keys', () => {
    renderDialog(vi.fn());
    expect(heading().textContent).toBe('Your month at a glance');
    expect((screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement).disabled).toBe(true);

    press('ArrowRight');
    expect(heading().textContent).toBe('Wallets next to your bank accounts');

    // The last page goes no further on an arrow key.
    press('ArrowRight');
    expect(heading().textContent).toBe('Wallets next to your bank accounts');

    click('Back');
    expect(heading().textContent).toBe('Your month at a glance');

    click('Next');
    press('ArrowLeft');
    expect(heading().textContent).toBe('Your month at a glance');
  });

  it('opened on one page, shows it alone until asked for the whole guide', () => {
    const onClose = vi.fn();
    renderDialog(onClose, 'en', 'crypto');
    expect(heading().textContent).toBe('Wallets next to your bank accounts');
    // No page turning on its own: no dots, no Back, and the arrow keys stay put.
    expect(screen.queryByRole('group', { name: /Step/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    press('ArrowLeft');
    expect(heading().textContent).toBe('Wallets next to your bank accounts');

    click('Whole guide');
    expect(screen.getByRole('group', { name: 'Step 2 of 2' })).toBeTruthy();
    press('ArrowLeft');
    expect(heading().textContent).toBe('Your month at a glance');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes a single page with Done', () => {
    const onClose = vi.fn();
    renderDialog(onClose, 'en', 'crypto');
    click('Done');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the last page with Done', () => {
    const onClose = vi.fn();
    renderDialog(onClose);
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();

    click('Next');
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    click('Done');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows one dot per page, marks the current one and jumps from a dot', () => {
    renderDialog(vi.fn());
    const dots = screen.getByRole('group', { name: 'Step 1 of 2' });
    const buttons = within(dots).getAllByRole('button');
    expect(buttons.map(dot => dot.getAttribute('aria-label'))).toEqual(['Dashboard', 'Crypto']);
    expect(buttons.map(dot => dot.getAttribute('aria-current'))).toEqual(['step', null]);

    fireEvent.click(within(dots).getByRole('button', { name: 'Crypto' }));
    expect(heading().textContent).toBe('Wallets next to your bank accounts');
    expect(screen.getByRole('group', { name: 'Step 2 of 2' })).toBeTruthy();
  });

  it('focuses the heading when it opens and keeps it there as the arrow keys turn pages', () => {
    renderDialog(vi.fn());
    expect(document.activeElement).toBe(heading());

    press('ArrowRight');
    expect(heading().textContent).toBe('Wallets next to your bank accounts');
    expect(document.activeElement).toBe(heading());
  });

  it('closes on Escape and on Close, but not on a click beside the dialog', () => {
    const onClose = vi.fn();
    renderDialog(onClose);

    const container = document.querySelector('.MuiDialog-container') as HTMLElement;
    fireEvent.mouseDown(container);
    fireEvent.click(container);
    expect(onClose).not.toHaveBeenCalled();

    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);

    click('Close');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('rings the sidebar item of the page on show and moves with the pages', () => {
    mountSidebarItem('/dashboard', { top: 100, left: 8, width: 176, height: 36 });
    mountSidebarItem('/crypto', { top: 140, left: 8, width: 176, height: 36 });
    renderDialog(vi.fn());

    const ring = (): HTMLElement => screen.getByTestId('guide-sidebar-ring');
    expect(ring().style).toMatchObject({ top: '97px', left: '5px', width: '182px', height: '42px' });

    press('ArrowRight');
    expect(ring().style.top).toBe('137px');
    // The guide moves over to leave the sidebar uncovered.
    const paper = document.querySelector('.MuiDialog-paper') as HTMLElement;
    expect(paper.style.getPropertyValue('--guide-inset')).toBe('192px');
  });

  it('draws no ring while the sidebar is hidden', () => {
    // display: none measures as an empty box.
    mountSidebarItem('/dashboard', {});
    renderDialog(vi.fn());
    expect(screen.queryByTestId('guide-sidebar-ring')).toBeNull();
  });

  it('loads the screenshots of the current language, and the English ones when they are missing', () => {
    renderDialog(vi.fn(), 'de');
    // The first frame is the dashboard's categories.
    const [image] = screen.getAllByRole('img');
    expect(decodeURIComponent(image.getAttribute('src') ?? '')).toContain(
      '/tour/de/dashboard-categories-light.webp',
    );

    fireEvent.error(image);
    expect(decodeURIComponent(image.getAttribute('src') ?? '')).toContain(
      '/tour/en/dashboard-categories-light.webp',
    );
  });
});
