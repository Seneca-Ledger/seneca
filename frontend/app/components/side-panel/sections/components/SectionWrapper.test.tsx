import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SidePanelProvider } from '../../SidePanelContext';
import type { SidePanelSection } from '../../types';
import { SectionWrapper } from './SectionWrapper';

function renderSection(section: Partial<SidePanelSection>) {
  return render(
    <SidePanelProvider>
      <SectionWrapper section={{ id: 'filters', type: 'custom', title: 'Filters', ...section } as SidePanelSection}>
        <button type="button">Inner action</button>
      </SectionWrapper>
    </SidePanelProvider>,
  );
}

describe('SectionWrapper', () => {
  it('keeps the content of a collapsed section out of the Tab order', () => {
    renderSection({ collapsible: true, defaultCollapsed: true });

    const inner = screen.getByRole('button', { name: 'Inner action', hidden: true });
    expect(inner.closest('[inert]')).not.toBeNull();
  });

  it('does not clip the content of an expanded section', () => {
    renderSection({});

    const inner = screen.getByRole('button', { name: 'Inner action' });
    expect(inner.closest('[inert]')).toBeNull();
    let node = inner.parentElement;
    while (node && node !== document.body) {
      expect(node.style.overflow).not.toBe('hidden');
      node = node.parentElement;
    }
  });
});
