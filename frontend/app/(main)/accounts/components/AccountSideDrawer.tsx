'use client';

import { ChevronLeft } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';

interface AccountSideDrawerProps {
  open: boolean;
  title: string;
  backLabel: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}

/** The right-hand form drawer every other form in the app uses (budgets, goals). */
export function AccountSideDrawer({
  open,
  title,
  backLabel,
  onClose,
  footer,
  children,
}: AccountSideDrawerProps): React.JSX.Element {
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
            aria-label={backLabel}
          >
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--foreground)' }}>{title}</span>
        </div>
      }
    >
      <div className="seneca-payable-drawer__body">
        <div
          style={{
            display: 'grid',
            gap: 20,
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
            padding: '10px 4px 4px',
            alignContent: 'start',
          }}
        >
          {children}
        </div>
        <div className="seneca-payable-drawer__footer">{footer}</div>
      </div>
    </DrawerShell>
  );
}

/** A label that stays above its field, with an optional grey line under the field. */
export function Field({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
        {label}
      </label>
      {children}
      {hint && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{hint}</span>}
    </div>
  );
}
