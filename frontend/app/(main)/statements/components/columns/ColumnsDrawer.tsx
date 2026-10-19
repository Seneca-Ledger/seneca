'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import MuiButton from '@mui/material/Button';
import { ChevronLeft, GripVertical } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import type { StatementColumn, StatementColumnId } from './statement-columns';

type ColumnsDrawerLabels = {
  title: string;
  save: string;
};

type ColumnsDrawerProps = {
  open: boolean;
  onClose: () => void;
  columns: StatementColumn[];
  onToggle: (id: StatementColumn['id'], value: boolean) => void;
  onReorder: (activeId: StatementColumnId, overId: StatementColumnId) => void;
  onSave: () => void;
  labels: ColumnsDrawerLabels;
};

type SortableColumnItemProps = {
  column: StatementColumn;
  onToggle: (id: StatementColumn['id'], value: boolean) => void;
};

function SortableColumnItem({ column, onToggle }: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`seneca-col-drawer__col-item${isDragging ? ' seneca-col-drawer__col-item--dragging' : ''}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="seneca-col-drawer__grip"
          aria-label={`Reorder ${column.label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={20} />
        </button>
        <span
          className={`seneca-col-drawer__col-label${column.visible ? '' : ' seneca-col-drawer__col-label--hidden'}`}
        >
          {column.label}
        </span>
      </div>
      <Checkbox
        checked={column.visible}
        onCheckedChange={(value: boolean) => onToggle(column.id, value)}
      />
    </div>
  );
}

export function ColumnsDrawer({
  open,
  onClose,
  columns,
  onToggle,
  onReorder,
  onSave,
  labels,
}: ColumnsDrawerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    onReorder(active.id as StatementColumnId, over.id as StatementColumnId);
  };

  return (
    <DrawerShell
      isOpen={open}
      onClose={onClose}
      position="right"
      width="sm"
      showCloseButton={false}
      sx={{ borderLeft: 0, bgcolor: 'background.paper' }}
      title={
        <div className="seneca-payable-drawer__title-wrap">
          <button
            type="button"
            onClick={onClose}
            className="seneca-col-drawer__back-btn"
            aria-label={labels.title}
          >
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground, #0f172a)' }}>
            {labels.title}
          </span>
        </div>
      }
    >
      <div className="seneca-col-drawer">
        <div className="seneca-col-drawer__list">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map(column => column.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="seneca-col-drawer__col-list">
                {columns.map(column => (
                  <SortableColumnItem key={column.id} column={column} onToggle={onToggle} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        <div className="seneca-col-drawer__footer">
          <MuiButton variant="contained" sx={{ width: '100%' }} size="large" onClick={onSave}>
            {labels.save}
          </MuiButton>
        </div>
      </div>
    </DrawerShell>
  );
}
