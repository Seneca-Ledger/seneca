import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeachOverlay } from './TeachOverlay';
import type { TeachSession } from './useTeachSession';

const session = (over: Partial<TeachSession> = {}): TeachSession => ({
  statementId: 'statement-1',
  words: [{ text: 'When', page: 1, x: 40, y: 100, width: 20, height: 8, dated: false }],
  regions: [],
  activeTag: 'date',
  setActiveTag: vi.fn(),
  addRegion: vi.fn(),
  removeRegion: vi.fn(),
  missing: [],
  preview: null,
  reading: false,
  saving: false,
  save: vi.fn(),
  pageWidths: { 1: 600 },
  setPageWidth: vi.fn(),
  ...over,
});

describe('TeachOverlay', () => {
  it('turns a drag on the page drawn at twice its size into an area in the PDF’s points', () => {
    const marks = session();
    render(<TeachOverlay page={1} width={1200} session={marks} />);
    const layer = screen.getByTestId('teach-layer-1');
    layer.getBoundingClientRect = () => ({ left: 100, top: 50 }) as DOMRect;
    fireEvent.pointerDown(layer, { button: 0, clientX: 180, clientY: 250 });
    fireEvent.pointerMove(layer, { clientX: 300, clientY: 350 });
    // The labels hide while an area is drawn, and come back after.
    expect(layer.className).toContain('seneca-pdf-teach__layer--drawing');
    fireEvent.pointerUp(layer, { clientX: 300, clientY: 350 });
    expect(marks.addRegion).toHaveBeenCalledWith({ page: 1, x0: 40, y0: 100, x1: 100, y1: 150 });
    expect(layer.className).not.toContain('seneca-pdf-teach__layer--drawing');
  });

  it('draws the areas of its own page, each removable, and the rows the preview read', () => {
    const marks = session({
      regions: [
        { tag: 'date', page: 1, x0: 30, y0: 90, x1: 80, y1: 120 },
        { tag: 'debit', page: 2, x0: 0, y0: 0, x1: 10, y1: 10 },
      ],
      preview: {
        missing: [],
        transactions: 2,
        totalDebit: 0,
        totalCredit: 0,
        checks: [],
        rows: [
          { page: 1, y: 120, broken: false },
          { page: 1, y: 140, broken: true },
        ],
      },
    });
    const { container } = render(<TeachOverlay page={1} width={600} session={marks} />);
    expect(container.querySelectorAll('.seneca-pdf-teach__region')).toHaveLength(1);
    // The word inside the date area lights up.
    expect(container.querySelectorAll('.seneca-pdf-teach__word')).toHaveLength(1);
    expect(container.querySelectorAll('.seneca-pdf-teach__row-mark--broken')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button'));
    expect(marks.removeRegion).toHaveBeenCalledWith(0);
  });

  it('waits for the page’s size before drawing anything', () => {
    const { container } = render(
      <TeachOverlay page={1} width={600} session={session({ pageWidths: {} })} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
