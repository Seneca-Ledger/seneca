// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ColumnsDrawer } from './ColumnsDrawer';

type ColumnsDrawerProps = React.ComponentProps<typeof ColumnsDrawer>;

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PointerSensor: function PointerSensor() {},
  KeyboardSensor: function KeyboardSensor() {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setActivatorNodeRef: vi.fn(),
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

describe('ColumnsDrawer', () => {
  it('uses dark-safe drawer rows and non-white dividers', () => {
    const { container } = render(
      <ColumnsDrawer
        open
        onClose={vi.fn()}
        onSave={vi.fn()}
        onToggle={vi.fn()}
        onReorder={vi.fn()}
        labels={{ title: 'Columns', save: 'Save' }}
        columns={
          [
            { id: 'receipt', label: 'Receipt', visible: true },
            { id: 'merchant', label: 'Merchant', visible: true },
          ] as ColumnsDrawerProps['columns']
        }
      />,
    );

    expect(screen.getByText('Columns')).toBeInTheDocument();

    const darkSurface = Array.from(document.querySelectorAll('[class]')).find(
      node => typeof node.className === 'string' && node.className.includes('bg-card'),
    );
    const whiteDivider = Array.from(document.querySelectorAll('[class]')).find(
      node =>
        typeof node.className === 'string' &&
        (node.className.includes('border-gray-100') || node.className.includes('bg-white')),
    );

    expect(darkSurface).toBeTruthy();
    expect(whiteDivider).toBeUndefined();
  });
});
