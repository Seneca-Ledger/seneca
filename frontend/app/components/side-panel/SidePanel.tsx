'use client';

import React, { isValidElement, useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
} from '@/app/components/icons';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { useSidePanel } from './SidePanelContext';
import { SectionRenderer } from './sections';
import type { ActionItem, SidePanelProps } from './types';
import { getWidthValue } from './types';

// ============================================================================
// Helper Components
// ============================================================================

/** Render icon - handles both LucideIcon and ReactNode */
function RenderIcon({
  icon,
  className,
  size = 16,
}: {
  icon: ActionItem['icon'];
  className?: string;
  size?: number;
}) {
  if (!icon) return null;

  if (isValidElement(icon)) {
    return <span className={className}>{icon}</span>;
  }

  const IconComponent = icon as React.ComponentType<{ size?: number; className?: string }>;
  return <IconComponent size={size} className={className} />;
}

// ============================================================================
// Main Component
// ============================================================================

export function SidePanel({
  visible = true,
  width: propWidth,
  position: propPosition,
  defaultCollapsed,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  enabledSections,
  permissions,
  config,
  style: propStyle,
  showCollapseToggle = true,
  collapseTogglePosition = 'header',
  loading = false,
  error = null,
  onRetry,
  topContent,
}: SidePanelProps) {
  const context = useSidePanel();
  const t = useIntlayer('sidePanel');

  // Use prop values or context values
  const width = propWidth ?? context.width;
  const position = propPosition ?? context.position;

  // Handle collapsed state - support both controlled and uncontrolled modes
  const isControlled = controlledCollapsed !== undefined;
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(defaultCollapsed ?? false);

  const isCollapsed = isControlled ? controlledCollapsed : uncontrolledCollapsed;

  const handleToggleCollapsed = useCallback(() => {
    if (isControlled) {
      onCollapsedChange?.(!controlledCollapsed);
    } else {
      setUncontrolledCollapsed(prev => !prev);
    }
  }, [isControlled, controlledCollapsed, onCollapsedChange]);

  // Calculate width value
  const widthValue = useMemo(() => getWidthValue(width), [width]);
  const collapsedWidth = 48; // Width when collapsed (just shows toggle)

  // Filter sections based on enabledSections and permissions
  const sections = config?.sections;
  const filteredSections = useMemo(() => {
    if (!sections) return [];

    return sections.filter(section => {
      // Check if section is enabled
      if (enabledSections && !enabledSections.includes(section.id)) {
        return false;
      }

      // Check permissions
      if (permissions?.sections?.[section.id]) {
        const requiredPermissions = permissions.sections[section.id];
        const hasAllPermissions = requiredPermissions.every(p => context.hasPermission(p));
        if (!hasAllPermissions) return false;
      }

      return true;
    });
  }, [sections, enabledSections, permissions, context]);

  // Check panel-level permissions
  const canViewPanel = useMemo(() => {
    if (!permissions?.viewPanel) return true;
    return permissions.viewPanel.every(p => context.hasPermission(p));
  }, [permissions?.viewPanel, context]);

  // Don't render if not visible or no permission
  if (!(visible && canViewPanel)) return null;

  return (
    <aside
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--border-color)',
        transition: 'width 300ms ease-in-out',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        overflow: 'visible',
        width: isCollapsed ? collapsedWidth : widthValue,
        minWidth: isCollapsed ? collapsedWidth : widthValue,
        ...(position === 'left'
          ? { borderRight: '1px solid var(--border-color)' }
          : { borderLeft: '1px solid var(--border-color)' }),
        ...propStyle,
      }}
      data-side-panel
      data-position={position}
      data-collapsed={isCollapsed}
    >
      {/* Collapsed state - just show toggle button */}
      {isCollapsed ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px 0',
          }}
        >
          {showCollapseToggle && (
            <button
              type="button"
              onClick={handleToggleCollapsed}
              style={{
                padding: 8,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--muted-foreground)',
                borderRadius: tokens.radius.md,
              }}
              aria-label={t.expandPanel.value}
            >
              {position === 'left' ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>
          )}
        </div>
      ) : (
        <>
          {topContent ? (
            <div
              style={{
                flexShrink: 0,
                borderBottom: '1px solid var(--border-color)',
                padding: '12px 16px',
              }}
            >
              {topContent}
            </div>
          ) : null}

          {/* Header */}
          {(config?.header || showCollapseToggle) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px 8px',
                flexShrink: 0,
              }}
            >
              {config?.header && (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}
                >
                  {config.header.icon && (
                    <div
                      style={{
                        padding: 8,
                        backgroundColor: 'rgba(var(--primary-rgb),0.1)',
                        flexShrink: 0,
                      }}
                    >
                      <RenderIcon icon={config.header.icon} size={18} />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    {config.header.title && (
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
                        {config.header.title}
                      </h2>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {/* Header actions */}
                {config?.header?.actions?.map(action => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled || action.loading}
                    title={action.tooltip || action.label}
                    style={{
                      padding: 8,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--muted-foreground)',
                      borderRadius: tokens.radius.md,
                      opacity: action.disabled || action.loading ? 0.5 : 1,
                    }}
                  >
                    {action.loading ? (
                      <Spinner size={16} />
                    ) : (
                      <RenderIcon icon={action.icon} size={16} />
                    )}
                  </button>
                ))}

                {/* Collapse toggle in header */}
                {showCollapseToggle && collapseTogglePosition === 'header' && (
                  <button
                    type="button"
                    onClick={handleToggleCollapsed}
                    style={{
                      padding: 8,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--muted-foreground)',
                      borderRadius: tokens.radius.md,
                    }}
                    aria-label={t.collapsePanel.value}
                  >
                    {position === 'left' ? (
                      <PanelLeftClose size={16} />
                    ) : (
                      <PanelLeftOpen size={16} />
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
            {loading ? (
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
                <p style={{ fontSize: 14, color: 'var(--muted-foreground)', margin: 0 }}>
                  {t.loading}
                </p>
              </div>
            ) : error ? (
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
                  {t.loadError}
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
                    {t.retry}
                  </button>
                )}
              </div>
            ) : filteredSections.length === 0 ? (
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
                <p
                  style={{
                    fontSize: 14,
                    color: 'var(--muted-foreground)',
                    textAlign: 'center',
                    margin: 0,
                  }}
                >
                  {t.noContent}
                </p>
              </div>
            ) : (
              <div data-side-panel-sections>
                {filteredSections.map(section => (
                  <SectionRenderer key={section.id} section={section} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {config?.footer && (
            <div style={{ padding: '12px 16px', flexShrink: 0, overflow: 'visible' }}>
              {config.footer.content}
              {config.footer.actions && config.footer.actions.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  {config.footer.actions.map(action => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={action.onClick}
                      disabled={action.disabled || action.loading}
                      style={{
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
                        opacity: action.disabled || action.loading ? 0.5 : 1,
                        ...(action.variant === 'primary'
                          ? { backgroundColor: 'var(--primary-fill)', color: 'white' }
                          : { backgroundColor: 'var(--muted)', color: 'var(--foreground)' }),
                      }}
                    >
                      {action.loading ? (
                        <Spinner size={14} />
                      ) : (
                        action.icon && <RenderIcon icon={action.icon} size={14} />
                      )}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Edge collapse toggle */}
          {showCollapseToggle && collapseTogglePosition === 'edge' && (
            <button
              type="button"
              onClick={handleToggleCollapsed}
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: 4,
                borderRadius: tokens.radius.full,
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                color: 'var(--muted-foreground)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                cursor: 'pointer',
                ...(position === 'left' ? { right: -12 } : { left: -12 }),
              }}
              aria-label={t.collapsePanel.value}
            >
              {position === 'left' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </>
      )}
    </aside>
  );
}
