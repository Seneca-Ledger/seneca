// @vitest-environment jsdom
import { Pencil, ThumbsUp } from '@/app/components/icons';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { SidePanel } from './SidePanel';
import { SidePanelProvider } from './SidePanelContext';
import type { SidePanelPageConfig } from './types';

const config: SidePanelPageConfig = {
  pageId: 'test-side-panel',
  sections: [
    {
      id: 'todo',
      type: 'navigation',
      items: [
        {
          id: 'submit',
          label: 'Submit',
          icon: Pencil,
        },
        {
          id: 'approve',
          label: 'Approve',
          icon: ThumbsUp,
          active: true,
        },
      ],
    },
  ],
};

describe('SidePanel navigation styles', () => {
  it('renders active item icon in primary color without icon or row background fills', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SidePanelProvider>
          <SidePanel config={config} showCollapseToggle={false} />
        </SidePanelProvider>,
      );
    });

    const activeButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Approve'),
    );

    expect(activeButton).toBeTruthy();

    // The 36px icon box: tinted with the primary token, never filled.
    const activeIconWrapper = activeButton?.querySelector('span') as HTMLSpanElement | null;
    expect(activeIconWrapper).toBeTruthy();
    expect(activeIconWrapper?.style.width).toBe('36px');
    expect(activeIconWrapper?.style.color).toBe('var(--primary)');
    expect(activeIconWrapper?.style.backgroundColor).toBe('');
  });

  it('adds left inset to navigation rows to align with header logo axis', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SidePanelProvider>
          <SidePanel config={config} showCollapseToggle={false} />
        </SidePanelProvider>,
      );
    });

    const firstNavButton = container.querySelector('button');

    expect(firstNavButton).toBeTruthy();
    expect(firstNavButton?.style.paddingLeft).toBe('10px');
  });
});
