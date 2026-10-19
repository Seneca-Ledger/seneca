'use client';

import React from 'react';
import { AlertCircle, PanelLeftClose, PanelLeftOpen, RefreshCw } from '@/app/components/icons';
import { Spinner } from '@/app/components/ui/spinner';
import { tokens } from '@/lib/theme-tokens';
import { SectionRenderer } from './sections';
import { RenderIcon } from './sections/components/RenderIcon';
import type { ActionItem, SidePanelProps, SidePanelSection } from './types';

export const BTN_BASE: React.CSSProperties = {
  padding: 8,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: 'var(--muted-foreground)',
  borderRadius: tokens.radius.md,
};
const BTN_FOOTER: React.CSSProperties = {
  flex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '8px 12px',
  fontSize: 14,
  fontWeight: 500,
  border: 'none',
  cursor: 'pointer',
  borderRadius: tokens.radius.md,
};
const STYLE_PRIMARY = { backgroundColor: 'var(--primary-fill)', color: 'white' };
const STYLE_SECONDARY = { backgroundColor: 'var(--muted)', color: 'var(--foreground)' };

type ToggleProps = { position: string; onToggle: () => void; label: string; size?: number };
export function CollapseBtn({
  position,
  onToggle,
  label,
  size = 16,
}: ToggleProps): React.JSX.Element {
  const Icon =
    size > 16
      ? position === 'left'
        ? PanelLeftOpen
        : PanelLeftClose
      : position === 'left'
        ? PanelLeftClose
        : PanelLeftOpen;
  return (
    <button type="button" onClick={onToggle} style={BTN_BASE} aria-label={label}>
      <Icon size={size} />
    </button>
  );
}

type ContentProps = {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  sections: SidePanelSection[];
};
export function PanelContent({
  loading,
  error,
  onRetry,
  sections,
}: ContentProps): React.JSX.Element {
  if (loading)
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '48px 0',
        }}
      >
        <Spinner size={32} />
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)', margin: 0 }}>Loading...</p>
      </div>
    );
  if (error)
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '48px 16px',
        }}
      >
        <AlertCircle size={40} style={{ color: 'var(--destructive)', marginBottom: 12 }} />
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--foreground)',
            textAlign: 'center',
            margin: '0 0 4px',
          }}
        >
          Error loading content
        </p>
        <p
          style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            textAlign: 'center',
            margin: '0 0 16px',
          }}
        >
          {error}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--primary)',
              backgroundColor: 'rgba(var(--primary-rgb),0.1)',
              border: 'none',
              cursor: 'pointer',
              borderRadius: tokens.radius.md,
            }}
          >
            <RefreshCw size={14} />
            Retry
          </button>
        )}
      </div>
    );
  if (sections.length === 0)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '48px 16px',
        }}
      >
        <p
          style={{ fontSize: 14, color: 'var(--muted-foreground)', textAlign: 'center', margin: 0 }}
        >
          No content available
        </p>
      </div>
    );
  return (
    <>
      {sections.map(s => (
        <SectionRenderer key={s.id} section={s} />
      ))}
    </>
  );
}

function HeaderActionBtn({ action: a }: { action: ActionItem }): React.JSX.Element {
  const isBusy = a.disabled ?? a.loading;
  return (
    <button
      type="button"
      onClick={a.onClick}
      disabled={!!isBusy}
      title={a.tooltip ?? a.label}
      style={{ ...BTN_BASE, opacity: isBusy ? 0.5 : 1 }}
    >
      {a.loading ? <Spinner size={16} /> : <RenderIcon icon={a.icon} size={16} />}
    </button>
  );
}

type FooterBtnContent = { action: ActionItem };
function FooterBtnLabel({ action: a }: FooterBtnContent): React.JSX.Element {
  return (
    <>
      {a.icon && <RenderIcon icon={a.icon} size={14} />}
      {a.label}
    </>
  );
}

function FooterActionBtn({ action: a }: { action: ActionItem }): React.JSX.Element {
  const isBusy = a.disabled ?? a.loading;
  const colorStyle = a.variant === 'primary' ? STYLE_PRIMARY : STYLE_SECONDARY;
  return (
    <button
      type="button"
      onClick={a.onClick}
      disabled={!!isBusy}
      style={{ ...BTN_FOOTER, opacity: isBusy ? 0.5 : 1, ...colorStyle }}
    >
      {a.loading ? <Spinner size={14} /> : <FooterBtnLabel action={a} />}
    </button>
  );
}

type ActionBtnProps = { action: ActionItem; size: number };
function ActionBtn({ action, size }: ActionBtnProps): React.JSX.Element {
  if (size <= 16) return <HeaderActionBtn action={action} />;
  return <FooterActionBtn action={action} />;
}

type HeaderInfoProps = { header: NonNullable<NonNullable<SidePanelProps['config']>['header']> };
function HeaderInfo({ header }: HeaderInfoProps): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
      {header.icon && (
        <div style={{ padding: 8, backgroundColor: 'rgba(var(--primary-rgb),0.1)', flexShrink: 0 }}>
          <RenderIcon icon={header.icon} size={18} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        {header.title && (
          <h2
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: 'var(--foreground)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              margin: 0,
            }}
          >
            {header.title}
          </h2>
        )}
      </div>
    </div>
  );
}

type HeaderActionsProps = {
  actions: ActionItem[] | undefined;
  position: string;
  showToggle: boolean;
  onToggle: () => void;
};
function HeaderActions({
  actions,
  position,
  showToggle,
  onToggle,
}: HeaderActionsProps): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      {actions?.map(a => (
        <ActionBtn key={a.id} action={a} size={16} />
      ))}
      {showToggle && <CollapseBtn position={position} onToggle={onToggle} label="Collapse panel" />}
    </div>
  );
}

type HeaderProps = {
  config: SidePanelProps['config'];
  position: string;
  showCollapseToggle: boolean;
  collapseTogglePosition: string;
  onToggle: () => void;
};
export function PanelHeader({
  config,
  position,
  showCollapseToggle,
  collapseTogglePosition,
  onToggle,
}: HeaderProps): React.JSX.Element {
  const showToggle = showCollapseToggle && collapseTogglePosition === 'header';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px 8px',
        flexShrink: 0,
      }}
    >
      {config?.header && <HeaderInfo header={config.header} />}
      <HeaderActions
        actions={config?.header?.actions}
        position={position}
        showToggle={showToggle}
        onToggle={onToggle}
      />
    </div>
  );
}

type FooterProps = { footer: NonNullable<SidePanelProps['config']>['footer'] };
export function PanelFooter({ footer }: FooterProps): React.JSX.Element | null {
  if (!footer) return null;
  const actions = footer.actions ?? [];
  return (
    <div style={{ padding: '12px 16px', flexShrink: 0, overflow: 'visible' }}>
      {footer.content}
      {actions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          {actions.map(a => (
            <ActionBtn key={a.id} action={a} size={14} />
          ))}
        </div>
      )}
    </div>
  );
}

export function filterSections({
  sections,
  enabledSections,
  permissions,
  hasPermission,
}: {
  sections: SidePanelSection[];
  enabledSections?: string[];
  permissions?: SidePanelProps['permissions'];
  hasPermission: (p: string) => boolean;
}): SidePanelSection[] {
  return sections.filter(s => {
    if (enabledSections && !enabledSections.includes(s.id)) return false;
    const req = permissions?.sections?.[s.id];
    return !req || req.every(p => hasPermission(p));
  });
}
