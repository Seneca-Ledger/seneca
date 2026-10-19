// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { IntlayerProviderContent } from 'react-intlayer';
import { describe, expect, it, vi } from 'vitest';
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

describe('WelcomeTutorialDialog', () => {
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

  it('covers the whole screen', () => {
    renderDialog(vi.fn());
    expect(screen.getByRole('dialog').className).toContain('MuiDialog-paperFullScreen');
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
