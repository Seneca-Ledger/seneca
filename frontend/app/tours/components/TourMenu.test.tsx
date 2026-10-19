import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TourMenu } from './TourMenu';

const pushMock = vi.fn();
const startTourMock = vi.fn();
const resetTourMock = vi.fn();

type RegisteredTour = {
  id: string;
  name: string;
  description: string;
  page: string;
  autoStart: boolean;
  steps: Array<{ title: string; description: string; selector: string }>;
};

const registeredTours = new Map<string, RegisteredTour>();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: (key: string) => {
    if (key === 'navigation') {
      return {
        tour: {
          buttons: {
            next: { value: 'Next' },
            prev: { value: 'Previous' },
            done: { value: 'Done' },
          },
          progressText: { value: '{{current}} / {{total}}' },
          menuLabel: { value: 'Tours' },
        },
        shell: { toursNotFound: { value: 'No tours found' } },
      };
    }

    return {};
  },
}));

vi.mock('../TourManager', () => ({
  getTourManager: () => ({
    registerTour: (tour: RegisteredTour) => registeredTours.set(tour.id, tour),
    getAllTours: () => Array.from(registeredTours.values()),
    isTourCompleted: () => false,
    resetTour: resetTourMock,
    startTour: startTourMock,
  }),
}));

const createTour = (id: string, name: string, page: string) => ({
  id,
  name,
  description: `${name} description`,
  page,
  autoStart: false,
  steps: [{ title: 'Welcome', description: 'Welcome', selector: 'body' }],
});

vi.mock('../statements-tour', () => ({
  createStatementsTour: () =>
    createTour('statements-tour', 'Statements Tour', '/statements/submit'),
}));
vi.mock('../custom-tables-tour', () => ({
  createCustomTablesTour: () =>
    createTour('custom-tables-tour', 'Custom Tables Tour', '/custom-tables'),
}));
vi.mock('../reports-tour', () => ({
  createReportsTour: () => createTour('reports-tour', 'Reports Tour', '/reports'),
}));
vi.mock('../categories-tour', () => ({
  createCategoriesTour: () =>
    createTour('categories-tour', 'Categories Tour', '/workspaces/categories'),
}));
vi.mock('../integrations-tour', () => ({
  createIntegrationsTour: () =>
    createTour('integrations-tour', 'Integrations Tour', '/integrations'),
}));
vi.mock('../settings-tour', () => ({
  createSettingsTour: () => createTour('settings-tour', 'Workspace Tour', '/workspaces/overview'),
}));
vi.mock('../admin-tour', () => ({
  createAdminTour: () => createTour('admin-tour', 'Admin Tour', '/admin'),
}));

describe('TourMenu', () => {
  beforeEach(() => {
    registeredTours.clear();
    pushMock.mockReset();
    startTourMock.mockReset();
    resetTourMock.mockReset();
  });

  it('navigates to workspace overview before starting workspace tour', async () => {
    render(<TourMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'Tours' }));
    fireEvent.click(await screen.findByText('Workspace Tour'));

    expect(pushMock).toHaveBeenCalledWith('/workspaces/overview');

    await waitFor(
      () => {
        expect(startTourMock).toHaveBeenCalledWith('settings-tour', 0, {
          nextBtnText: 'Next',
          prevBtnText: 'Previous',
          doneBtnText: 'Done',
          progressText: '{{current}} / {{total}}',
        });
      },
      { timeout: 2000 },
    );
  });

  it('does not show upload and storage tours in the menu', async () => {
    render(<TourMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'Tours' }));

    expect(screen.queryByText('Upload Tour')).toBeNull();
    expect(screen.queryByText('Storage Tour')).toBeNull();
    expect(screen.queryByText('Data Entry Tour')).toBeNull();
  });
});
