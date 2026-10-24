'use client';

import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import type { SxProps, Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import { X } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

export type DrawerPosition = 'left' | 'right';
export type DrawerWidth = 'sm' | 'md' | 'lg' | 'xl';

export interface DrawerShellProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Callback when the drawer should close */
  onClose: () => void;
  /** Drawer title shown in header */
  title?: React.ReactNode;
  /** Drawer position */
  position?: DrawerPosition;
  /** Drawer width preset */
  width?: DrawerWidth;
  /** Drawer content */
  children: React.ReactNode;
  /** Whether to show the close button in header */
  showCloseButton?: boolean;
  /** Whether clicking backdrop closes the drawer */
  closeOnBackdropClick?: boolean;
  /** Whether pressing ESC closes the drawer */
  closeOnEscape?: boolean;
  /** Additional className for the drawer container */
  className?: string;
  /** Whether to lock body scroll when open */
  lockScroll?: boolean;
  /** Additional sx styles forwarded to the Drawer Paper */
  sx?: SxProps<Theme>;
  /** Override z-index for the drawer modal (useful when rendering above MUI Dialog) */
  zIndex?: number;
  /** Pinned under the content, which then scrolls on its own: the drawer's main actions. */
  footer?: React.ReactNode;
}

/** Set on an overlay while a sidebar opened after it sits on top; styled in `_drawer-stack.scss`. */
const COVERED_ATTR = 'data-seneca-covered';
/** Every overlay a sidebar can open over: other sidebars and centred dialogs, however they are built. */
const OVERLAY_SELECTOR = '.MuiDrawer-root, .MuiDialog-root';

/**
 * While this drawer is open, the overlays that were already on screen fade out so
 * two panels never overlap; they fade back in when it closes. A counter rather than
 * a flag, because several drawers can stack over the same overlay.
 */
function useHideOverlaysBelow(
  isOpen: boolean,
  ownRoot: React.RefObject<HTMLDivElement | null>,
): void {
  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    const below = [...document.querySelectorAll<HTMLElement>(OVERLAY_SELECTOR)].filter(
      el => el !== ownRoot.current && !el.contains(ownRoot.current),
    );
    for (const el of below) {
      el.setAttribute(COVERED_ATTR, String(Number(el.getAttribute(COVERED_ATTR) ?? 0) + 1));
    }
    return () => {
      for (const el of below) {
        const left = Number(el.getAttribute(COVERED_ATTR) ?? 1) - 1;
        if (left > 0) {
          el.setAttribute(COVERED_ATTR, String(left));
        } else {
          el.removeAttribute(COVERED_ATTR);
        }
      }
    };
  }, [isOpen, ownRoot]);
}

/** The close handlers of the drawers on screen, so a shortcut can clear them before it navigates. */
const openDrawerClosers = new Set<() => void>();

/**
 * Closes every open drawer the way Escape would (one that ignores Escape stays).
 * Called before a shortcut or palette jump: a drawer outside the page, or on the
 * page being navigated to, would otherwise stay on top of where the user went.
 */
export function closeAllDrawers(): void {
  for (const close of [...openDrawerClosers]) {
    close();
  }
}

function useRegisterOpenDrawer(isOpen: boolean, closeOnEscape: boolean, onClose: () => void): void {
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });
  React.useEffect(() => {
    if (!(isOpen && closeOnEscape)) {
      return;
    }
    const close = (): void => onCloseRef.current();
    openDrawerClosers.add(close);
    return () => {
      openDrawerClosers.delete(close);
    };
  }, [isOpen, closeOnEscape]);
}

const widthMap: Record<DrawerWidth, number | string> = {
  sm: 320,
  md: 448,
  lg: 512,
  xl: 576,
};

/**
 * DrawerShell - Unified drawer/slide-out panel component
 *
 * Provides consistent styling and behavior for all drawers:
 * - Slide-in animation from left or right
 * - Backdrop overlay
 * - Body scroll lock
 * - Keyboard (ESC) support
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function, complexity
export function DrawerShell({
  isOpen,
  onClose,
  title,
  position = 'right',
  width = 'md',
  children,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className,
  lockScroll: LockScroll = true,
  sx,
  zIndex,
  footer,
}: DrawerShellProps) {
  const t = useIntlayer('uiShell');
  // eslint-disable-next-line max-params
  const handleClose = (_event: object, reason: 'backdropClick' | 'escapeKeyDown'): void => {
    if (reason === 'backdropClick' && !closeOnBackdropClick) {
      return;
    }
    if (reason === 'escapeKeyDown' && !closeOnEscape) {
      return;
    }
    onClose();
  };

  const drawerWidth = widthMap[width];
  const rootRef = React.useRef<HTMLDivElement>(null);
  useHideOverlaysBelow(isOpen, rootRef);
  useRegisterOpenDrawer(isOpen, closeOnEscape, onClose);

  return (
    <Drawer
      open={isOpen}
      onClose={handleClose}
      anchor={position}
      className={className}
      ref={rootRef}
      sx={zIndex !== undefined ? { zIndex } : undefined}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-labelledby': title ? 'drawer-title' : undefined,
          sx: [
            {
              width: drawerWidth,
              maxWidth: '100%',
              borderRadius: tokens.radius.xl,
              display: 'flex',
              flexDirection: 'column',
            },
            ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
          ],
        },
      }}
    >
      {(title || showCloseButton) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid',
            borderColor: 'rgba(0,0,0,0.12)',
          }}
        >
          {title && (
            <Typography
              id="drawer-title"
              variant="h6"
              sx={{
                fontWeight: 700,
              }}
            >
              {title}
            </Typography>
          )}
          {showCloseButton && (
            <IconButton
              type="button"
              onClick={onClose}
              aria-label={t.closeDrawer.value}
              size="small"
              sx={{ ml: 'auto' }}
            >
              <X size={20} />
            </IconButton>
          )}
        </div>
      )}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: 24,
          minHeight: 0,
          overflowY: footer ? 'auto' : undefined,
        }}
      >
        {children}
      </div>
      {footer && (
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)' }}>{footer}</div>
      )}
    </Drawer>
  );
}
