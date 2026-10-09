/* eslint-disable max-lines */
'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { usePathname } from 'next/navigation';
import React from 'react';
import { X } from '@/app/components/icons';
import { useLockBodyScroll } from '@/app/hooks/useLockBodyScroll';
import { useIntlayer } from '@/app/i18n';
import { SidePanel, useCurrentSidePanelConfig, useSidePanel } from './index';

type ClonableProps = Record<string, unknown>;
const MOBILE_MENU_VISIBILITY_EVENT = 'lumio-mobile-menu-visibility';
const SIDEPANEL_ACTIVE_BODY_ATTRIBUTE = 'data-side-panel-active';

function useMountAnimation(
  isOpen: boolean,
  isMounted: boolean,
  setMounted: (v: boolean) => void,
  setVisible: (v: boolean) => void,
): void {
  React.useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    if (!isMounted) {
      return;
    }

    setVisible(false);
    const timer = window.setTimeout(() => {
      setMounted(false);
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen, isMounted, setMounted, setVisible]);
}

function computeDragX(
  event: React.TouchEvent<HTMLDialogElement>,
  dragActiveRef: React.MutableRefObject<boolean>,
  touchStartXRef: React.MutableRefObject<number | null>,
  touchStartYRef: React.MutableRefObject<number | null>,
): number | null {
  if (!dragActiveRef.current) {
    return null;
  }
  if (touchStartXRef.current === null || touchStartYRef.current === null) {
    return null;
  }

  const touch = event.touches[0];
  if (!touch) {
    return null;
  }

  const deltaX = touch.clientX - touchStartXRef.current;
  const deltaY = touch.clientY - touchStartYRef.current;

  if (Math.abs(deltaX) <= Math.abs(deltaY)) {
    return null;
  }

  if (deltaX >= 0) {
    return 0;
  }

  return Math.max(-240, deltaX);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-lines-per-function, complexity
function MainSidePanelLayoutInner({ children }: { children: React.ReactNode }) {
  const config = useCurrentSidePanelConfig();
  const sidePanel = useSidePanel();
  const t = useIntlayer('sidePanel');
  const pathname = usePathname();
  const isStatementsPage = pathname?.startsWith('/statements');
  const [mobileSidePanelOpen, setMobileSidePanelOpen] = React.useState(false);
  const [mobileSidePanelMounted, setMobileSidePanelMounted] = React.useState(false);
  const [mobileSidePanelVisible, setMobileSidePanelVisible] = React.useState(false);
  const [globalMobileMenuOpen, setGlobalMobileMenuOpen] = React.useState(false);
  const [mobilePanelDragX, setMobilePanelDragX] = React.useState(0);
  const touchStartXRef = React.useRef<number | null>(null);
  const touchStartYRef = React.useRef<number | null>(null);
  const dragActiveRef = React.useRef(false);

  useLockBodyScroll(mobileSidePanelOpen);

  React.useEffect(() => {
    if (sidePanel.position !== 'left') {
      sidePanel.setPosition('left');
    }
  }, [sidePanel]);

  React.useEffect(() => {
    setMobileSidePanelOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!mobileSidePanelOpen) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileSidePanelOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileSidePanelOpen]);

  React.useEffect(() => {
    if (!mobileSidePanelOpen) {
      setMobilePanelDragX(0);
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      dragActiveRef.current = false;
    }
  }, [mobileSidePanelOpen]);

  useMountAnimation(
    mobileSidePanelOpen,
    mobileSidePanelMounted,
    setMobileSidePanelMounted,
    setMobileSidePanelVisible,
  );

  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const handleMenuVisibility = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setGlobalMobileMenuOpen(Boolean(customEvent.detail?.open));
    };

    window.addEventListener(MOBILE_MENU_VISIBILITY_EVENT, handleMenuVisibility);

    return () => {
      window.removeEventListener(MOBILE_MENU_VISIBILITY_EVENT, handleMenuVisibility);
    };
  }, []);

  React.useEffect(() => {
    if (globalMobileMenuOpen) {
      setMobileSidePanelOpen(false);
    }
  }, [globalMobileMenuOpen]);

  React.useLayoutEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.setAttribute(SIDEPANEL_ACTIVE_BODY_ATTRIBUTE, config ? 'true' : 'false');

    return () => {
      document.body.setAttribute(SIDEPANEL_ACTIVE_BODY_ATTRIBUTE, 'false');
    };
  }, [config]);

  const handlePanelTouchStart = React.useCallback(
    (event: React.TouchEvent<HTMLDialogElement>): void => {
      if (!mobileSidePanelVisible || event.touches.length !== 1) {
        return;
      }
      touchStartXRef.current = event.touches[0]?.clientX ?? null;
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
      dragActiveRef.current = true;
    },
    [mobileSidePanelVisible],
  );

  const handlePanelTouchMove = React.useCallback(
    (event: React.TouchEvent<HTMLDialogElement>): void => {
      const dragX = computeDragX(event, dragActiveRef, touchStartXRef, touchStartYRef);
      if (dragX === null) {
        return;
      }
      if (dragX < 0) {
        event.preventDefault();
      }
      setMobilePanelDragX(dragX);
    },
    [],
  );

  const handlePanelTouchEnd = React.useCallback(() => {
    if (!dragActiveRef.current) {
      return;
    }

    const shouldClose = mobilePanelDragX < -72;

    dragActiveRef.current = false;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    setMobilePanelDragX(0);

    if (shouldClose) {
      setMobileSidePanelOpen(false);
    }
  }, [mobilePanelDragX]);

  const mobileFooterContent = React.useMemo(() => {
    const content = config?.footer?.content;
    if (!content) {
      return null;
    }

    if (!React.isValidElement(content)) {
      return content;
    }

    if (typeof content.type === 'string') {
      return content;
    }

    return React.cloneElement(content as React.ReactElement<ClonableProps>, {
      placement: 'floating',
    });
  }, [config]);

  const mobileDialogConfig = React.useMemo(() => {
    if (!config) {
      return null;
    }

    return {
      ...config,
      footer: undefined,
    };
  }, [config]);

  const isDragging = mobilePanelDragX !== 0;
  const dialogTransform = isDragging
    ? `translateX(${mobilePanelDragX}px)`
    : mobileSidePanelVisible
      ? 'translateX(0)'
      : 'translateX(-100%)';

  return (
    <div
      style={{
        display: 'flex',
        minHeight: 'calc(100vh - var(--global-nav-height,0px))',
        ...(isStatementsPage
          ? { height: 'calc(100vh - var(--global-nav-height,0px))', overflow: 'hidden' }
          : {}),
      }}
    >
      <div
        className={isStatementsPage ? 'lumio-statements-shell' : undefined}
        style={{
          flex: 1,
          // A flex item defaults to min-width:auto; without this, wide nowrap
          // content (month chips, tables) pushes the page past the viewport.
          minWidth: 0,
          ...(isStatementsPage ? { height: '100%', overflow: 'hidden' } : {}),
        }}
      >
        {children}
      </div>

      {mobileDialogConfig && mobileSidePanelMounted ? (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            display: { lg: 'none' },
            ...(mobileSidePanelVisible ? {} : { pointerEvents: 'none' }),
          }}
          data-testid="mobile-side-panel-dialog"
        >
          <button
            type="button"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              opacity: mobileSidePanelVisible ? 1 : 0,
              transition: 'opacity 300ms',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
            }}
            aria-label={t.closeSidePanel.value}
            onClick={() => setMobileSidePanelOpen(false)}
          />

          <dialog
            open
            aria-modal="true"
            style={{
              position: 'absolute',
              inset: 'auto auto auto 0',
              top: 0,
              bottom: 0,
              margin: 0,
              height: '100vh',
              width: '88vw',
              maxWidth: 384,
              padding: 0,
              borderRight: '1px solid var(--border)',
              backgroundColor: 'var(--card)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              transform: dialogTransform,
              transition: isDragging ? 'none' : 'transform 300ms ease-out',
              willChange: 'transform',
              border: 'none',
            }}
            onCancel={event => {
              event.preventDefault();
              setMobileSidePanelOpen(false);
            }}
            onTouchStart={handlePanelTouchStart}
            onTouchMove={handlePanelTouchMove}
            onTouchEnd={handlePanelTouchEnd}
            onTouchCancel={handlePanelTouchEnd}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  px: 2,
                  py: 1.5,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {mobileDialogConfig.header?.title ?? t.sections}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setMobileSidePanelOpen(false)}
                  aria-label={t.closeSidePanel.value}
                >
                  <X size={18} />
                </IconButton>
              </Box>

              <div style={{ height: 'calc(100vh - 57px)', overflow: 'hidden' }}>
                <SidePanel
                  config={mobileDialogConfig}
                  width={320}
                  showCollapseToggle={false}
                  style={{ height: '100%', border: 'none', boxShadow: 'none' }}
                />
              </div>
            </Box>
          </dialog>
        </Box>
      ) : null}

      {mobileFooterContent && !mobileSidePanelOpen && !globalMobileMenuOpen ? (
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            zIndex: 72,
            pointerEvents: 'none',
            display: { lg: 'none' },
          }}
          data-testid="mobile-side-panel-floating-footer"
        >
          <div style={{ pointerEvents: 'auto' }}>{mobileFooterContent}</div>
        </Box>
      ) : null}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
export function MainSidePanelLayout({ children }: { children: React.ReactNode }) {
  // SidePanelProvider sits in the root layout so the shell can render the panel.
  return <MainSidePanelLayoutInner>{children}</MainSidePanelLayoutInner>;
}
