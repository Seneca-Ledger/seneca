'use client';

import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import clsx from 'clsx';
import type React from 'react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GripVertical } from '@/app/components/icons';
import { useViewPreference } from '@/app/components/transactions/hooks/useViewPreference';
import { useIntlayer } from '@/app/i18n';
import {
  canSitBeside,
  DEFAULT_OVERVIEW_ROWS,
  type DropZone,
  isDefaultLayout,
  moveSection,
  normalizeRows,
  type OverviewRows,
  type OverviewSectionId,
} from './overview-layout';

interface Drop {
  target: string;
  zone: DropZone;
}

interface Point {
  x: number;
  y: number;
}

/** How far into a card, from either side, a drop counts as "next to it". */
const SIDE_BAND_SHARE = 0.3;
const SIDE_BAND_MAX_PX = 200;

/** The preview under the pointer is shrunk to at most this width. */
const GHOST_MAX_WIDTH_PX = 420;

/** Page scroll follows the pointer near the top or bottom edge only, never sideways. */
const AUTO_SCROLL = { threshold: { x: 0, y: 0.15 } };

/** The card under the pointer; in the gaps between cards, the nearest one. */
const collisionDetection: CollisionDetection = args => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : closestCenter(args);
};

function zoneFor(rows: OverviewRows, active: string, target: string, rect: DOMRect, point: Point) {
  const band = Math.min(rect.width * SIDE_BAND_SHARE, SIDE_BAND_MAX_PX);
  if (canSitBeside(rows, active, target)) {
    if (point.x < rect.left + band) {
      return 'left';
    }
    if (point.x > rect.right - band) {
      return 'right';
    }
  }
  return point.y < rect.top + rect.height / 2 ? 'above' : 'below';
}

interface OverviewSectionProps {
  id: string;
  /** Spans both columns: alone in its row, or its partner has nothing to show. */
  wide: boolean;
  drop: DropZone | null;
  handleLabel: string;
  onEmptyChange: (id: string, empty: boolean) => void;
  children: React.ReactNode;
}

function OverviewSection({
  id,
  wide,
  drop,
  handleLabel,
  onEmptyChange,
  children,
}: OverviewSectionProps): React.JSX.Element {
  const drag = useDraggable({ id });
  const { setNodeRef: setDropRef } = useDroppable({ id });
  const nodeRef = useRef<HTMLDivElement | null>(null);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      drag.setNodeRef(node);
      setDropRef(node);
    },
    [drag.setNodeRef, setDropRef],
  );

  // Several cards draw nothing until their data is in, or ever, when there is
  // nothing to say. Such a section must not hold half a row, so the layout is
  // told whenever the card's own markup comes or goes.
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) {
      return undefined;
    }
    const report = () => onEmptyChange(id, node.childElementCount <= 1);
    report();
    const observer = new MutationObserver(report);
    observer.observe(node, { childList: true });
    return () => observer.disconnect();
  }, [id, onEmptyChange]);

  return (
    <div
      ref={setRef}
      data-overview-section={id}
      className={clsx(
        'lumio-overview__section',
        wide && 'lumio-overview__section--wide',
        drag.isDragging && 'lumio-overview__section--dragging',
        drop && `lumio-overview__section--drop-${drop}`,
      )}
    >
      <button
        type="button"
        ref={drag.setActivatorNodeRef}
        className="lumio-overview__handle"
        {...drag.attributes}
        {...drag.listeners}
        aria-label={handleLabel}
        title={handleLabel}
      >
        <GripVertical size={16} />
      </button>
      {children}
    </div>
  );
}

/**
 * What follows the pointer: a shrunken snapshot of the section being moved.
 * Dragging the card itself would carry a full-width card past the screen edge
 * and cover the very places it could be dropped; the snapshot is fixed-position
 * and small, and the card stays put, dimmed, until it is dropped.
 */
function SectionGhost({ id }: { id: string }): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const source = document.querySelector<HTMLElement>(`[data-overview-section="${id}"]`);
    const host = hostRef.current;
    if (!(source && host)) {
      return;
    }
    const width = source.getBoundingClientRect().width;
    const clone = source.cloneNode(true) as HTMLElement;
    // Only the real section may answer to its id while the drop target is looked up.
    clone.removeAttribute('data-overview-section');
    // A picture, not a second set of controls.
    clone.setAttribute('inert', '');
    clone.className = 'lumio-overview__section';
    clone.style.width = `${width}px`;
    host.replaceChildren(clone);
    setScale(Math.min(1, GHOST_MAX_WIDTH_PX / width));
  }, [id]);

  return (
    <div
      ref={hostRef}
      className="lumio-overview__ghost"
      style={{ transform: `scale(${scale})` }}
      aria-hidden
    />
  );
}

interface OverviewLayoutProps {
  sections: Record<OverviewSectionId, React.ReactNode>;
}

/**
 * The Overview sections, each movable by its grip. Dropped on a card's side a
 * section joins that card's row and both take half the width; dropped above or
 * below it gets a row of its own. The arrangement is remembered per person and
 * workspace. Phones get no grips: there everything is one column anyway.
 */
export function OverviewLayout({ sections }: OverviewLayoutProps): React.JSX.Element {
  const t = useIntlayer('overviewTab');
  const { state, save } = useViewPreference<{ overviewRows: OverviewRows }>('dashboard');
  const rows = useMemo(() => normalizeRows(state ? { rows: state.overviewRows } : null), [state]);
  const [empty, setEmpty] = useState<ReadonlySet<string>>(() => new Set());
  const [drop, setDrop] = useState<Drop | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const pointer = useRef<Point | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const onEmptyChange = useCallback((id: string, isEmpty: boolean) => {
    setEmpty(previous => {
      if (previous.has(id) === isEmpty) {
        return previous;
      }
      const next = new Set(previous);
      if (isEmpty) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const trackPointer = useCallback((event: PointerEvent) => {
    pointer.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      setDragging(String(active.id));
      window.addEventListener('pointermove', trackPointer);
    },
    [trackPointer],
  );

  const stopTracking = useCallback(() => {
    window.removeEventListener('pointermove', trackPointer);
    pointer.current = null;
    setDrop(null);
    setDragging(null);
  }, [trackPointer]);

  const handleDragMove = useCallback(
    ({ active, over }: DragMoveEvent) => {
      const target = over ? String(over.id) : null;
      const node =
        target && target !== active.id
          ? document.querySelector(`[data-overview-section="${target}"]`)
          : null;
      // A keyboard drag has no pointer; the moved card's centre stands in for it.
      const moved = active.rect.current.translated;
      const point =
        pointer.current ??
        (moved ? { x: moved.left + moved.width / 2, y: moved.top + moved.height / 2 } : null);
      if (!(target && node && point)) {
        setDrop(null);
        return;
      }
      const zone = zoneFor(rows, String(active.id), target, node.getBoundingClientRect(), point);
      setDrop(previous =>
        previous?.target === target && previous.zone === zone ? previous : { target, zone },
      );
    },
    [rows],
  );

  const handleDragEnd = useCallback(
    ({ active }: DragEndEvent) => {
      if (drop) {
        const next = moveSection(rows, String(active.id), drop.target, drop.zone);
        if (next !== rows) {
          save({ overviewRows: next });
        }
      }
      stopTracking();
    },
    [drop, rows, save, stopTracking],
  );

  const targetRow = drop ? rows.find(row => row.includes(drop.target)) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      autoScroll={AUTO_SCROLL}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={stopTracking}
    >
      <div className="lumio-dashboard__tab lumio-overview">
        <div className="lumio-overview__body">
          <div className="lumio-overview__grid">
            {/* One flat list, not a wrapper per row: a moved card keeps its place
              in the tree, so it is not remounted and keeps its own state. */}
            {rows.flatMap(row => {
              const shown = row.filter(id => !empty.has(id));
              const vertical = drop && (drop.zone === 'above' || drop.zone === 'below');
              return row.map(id => (
                <OverviewSection
                  key={id}
                  id={id}
                  wide={shown.length < 2}
                  drop={
                    drop?.target === id || (vertical && row === targetRow)
                      ? (drop?.zone ?? null)
                      : null
                  }
                  handleLabel={t.layoutDragHandle.value}
                  onEmptyChange={onEmptyChange}
                >
                  {sections[id as OverviewSectionId]}
                </OverviewSection>
              ));
            })}
          </div>
        </div>
        {!isDefaultLayout(rows) && (
          <button
            type="button"
            className="lumio-overview__reset"
            onClick={() => save({ overviewRows: DEFAULT_OVERVIEW_ROWS })}
          >
            {t.layoutReset}
          </button>
        )}
      </div>
      <DragOverlay>{dragging ? <SectionGhost id={dragging} /> : null}</DragOverlay>
    </DndContext>
  );
}
