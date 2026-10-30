// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RoiPage from './page';

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { currency: 'EUR' } }),
}));
// Every dictionary entry renders as its own key, both as a node and as `.value`,
// like react-intlayer's own nodes.
vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy(
      {},
      {
        get: (_, key: string) =>
          // biome-ignore lint/complexity/noUselessFragments: the Proxy needs an object to wrap
          new Proxy(<>{key}</>, {
            get: (target, prop, receiver) =>
              prop === 'value' ? key : Reflect.get(target, prop, receiver),
          }),
      },
    ),
  useLocale: () => ({ locale: 'en' }),
}));
vi.mock('./components/RoiProjectionChart', () => ({ RoiProjectionChart: () => null }));
vi.mock('./components/PerformanceTab', () => ({
  PerformanceTab: () => <div data-testid="performance-tab" />,
}));
vi.mock('@/app/components/ui/page-title', () => ({ PageTitle: () => null }));
const search = vi.hoisted(() => ({ value: 'tab=calculator' }));
const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/roi',
  useSearchParams: () => new URLSearchParams(search.value),
}));

describe('RoiPage', () => {
  it('opens on performance and keeps the chosen tab in the address', () => {
    search.value = '';
    render(<RoiPage />);

    expect(screen.getByTestId('performance-tab')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'tabCalculator' }));
    expect(replace).toHaveBeenCalledWith('/roi?tab=calculator', { scroll: false });
    search.value = 'tab=calculator';
  });

  it('holds the answer\'s place with a dash, then fills it in as the amounts arrive', () => {
    render(<RoiPage />);

    expect(screen.getByTestId('roi-payback').textContent).toBe('—');
    expect(screen.getByText('hint')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();

    fireEvent.change(screen.getByLabelText('investmentLabel'), { target: { value: '120,000' } });
    fireEvent.change(screen.getByLabelText('monthlyIncomeLabel'), { target: { value: '1000' } });

    expect(screen.getByTestId('roi-payback').textContent).toBe('10 years');
  });

  it('labels each amount above the field and shows the currency inside it', () => {
    render(<RoiPage />);

    const field = screen.getByLabelText('investmentLabel');
    expect(field.getAttribute('inputmode')).toBe('decimal');
    expect(field.getAttribute('placeholder')).toBe('0');
    expect(screen.getAllByText('€')).toHaveLength(2);
  });
});
