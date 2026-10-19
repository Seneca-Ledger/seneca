'use client';

import Button from '@mui/material/Button';
import { ChevronLeft } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';

interface GoalSideDrawerProps {
  open: boolean;
  title: string;
  saving: boolean;
  canSave: boolean;
  labels: { save: string; cancel: string };
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
}

// Same right-hand drawer as the budget form, so the goal forms look like every
// other form in the app.
export function GoalSideDrawer({
  open,
  title,
  saving,
  canSave,
  labels,
  onClose,
  onSave,
  children,
}: GoalSideDrawerProps) {
  return (
    <DrawerShell
      isOpen={open}
      onClose={onClose}
      position="right"
      width="lg"
      showCloseButton={false}
      sx={{
        maxWidth: '100%',
        borderLeft: 0,
        bgcolor: 'background.paper',
        '@media (min-width:600px)': { maxWidth: 512 },
      }}
      title={
        <div className="seneca-payable-drawer__title-wrap">
          <button
            type="button"
            onClick={onClose}
            className="seneca-payable-drawer__back-btn"
            aria-label={labels.cancel}
          >
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>{title}</span>
        </div>
      }
    >
      <div className="seneca-payable-drawer__body">
        {/* The padding keeps the first field's floating label inside the scroll box. */}
        <div
          style={{
            display: 'grid',
            gap: 16,
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
            padding: '10px 4px 4px',
            alignContent: 'start',
          }}
        >
          {children}
        </div>
        <div className="seneca-payable-drawer__footer">
          <Button variant="outlined" sx={{ flex: 1 }} onClick={onClose} disabled={saving}>
            {labels.cancel}
          </Button>
          <Button
            variant="contained"
            sx={{ flex: 1 }}
            onClick={onSave}
            disabled={!canSave || saving}
          >
            {labels.save}
          </Button>
        </div>
      </div>
    </DrawerShell>
  );
}
