'use client';

import React from 'react';
import { useLockBodyScroll } from '@/app/hooks/useLockBodyScroll';
import type { SidePanelPageConfig } from '../types';

type ClonableProps = Record<string, unknown>;

interface SidePanelHandle {
  position: string;
  setPosition: (p: 'left' | 'right') => void;
}

const MOBILE_MENU_VISIBILITY_EVENT = 'seneca-mobile-menu-visibility';
const SIDEPANEL_ACTIVE_BODY_ATTRIBUTE = 'data-side-panel-active';

interface UseMobileSidePanelParams {
  config: SidePanelPageConfig | null;
  sidePanel: SidePanelHandle;
  pathname: string | null;
}

export function useMobileSidePanel({ config, sidePanel, pathname }: UseMobileSidePanelParams) {
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
    if (!mobileSidePanelOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
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

  React.useEffect(() => {
    if (mobileSidePanelOpen) {
      setMobileSidePanelMounted(true);
      const frame = window.requestAnimationFrame(() => {
        setMobileSidePanelVisible(true);
      });
      return () => {
        window.cancelAnimationFrame(frame);
      };
    }
    if (!mobileSidePanelMounted) {
      return;
    }
    setMobileSidePanelVisible(false);
    const timer = window.setTimeout(() => {
      setMobileSidePanelMounted(false);
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [mobileSidePanelOpen, mobileSidePanelMounted]);

  React.useEffect(() => {
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
    if (typeof document === 'undefined') return;
    document.body.setAttribute(SIDEPANEL_ACTIVE_BODY_ATTRIBUTE, config ? 'true' : 'false');
    return () => {
      document.body.setAttribute(SIDEPANEL_ACTIVE_BODY_ATTRIBUTE, 'false');
    };
  }, [config]);

  const handlePanelTouchStart = React.useCallback(
    (event: React.TouchEvent<HTMLDialogElement>): void => {
      if (!mobileSidePanelVisible) return;
      if (event.touches.length !== 1) return;
      touchStartXRef.current = event.touches[0]?.clientX ?? null;
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
      dragActiveRef.current = true;
    },
    [mobileSidePanelVisible],
  );

  const handlePanelTouchMove = React.useCallback(
    (event: React.TouchEvent<HTMLDialogElement>): void => {
      if (!dragActiveRef.current) return;
      if (touchStartXRef.current === null || touchStartYRef.current === null) return;
      const touch = event.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - touchStartXRef.current;
      const deltaY = touch.clientY - touchStartYRef.current;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
      if (deltaX >= 0) {
        setMobilePanelDragX(0);
        return;
      }
      event.preventDefault();
      setMobilePanelDragX(Math.max(-240, deltaX));
    },
    [],
  );

  const handlePanelTouchEnd = React.useCallback(() => {
    if (!dragActiveRef.current) return;
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
    if (!content) return null;
    if (!React.isValidElement(content)) return content;
    if (typeof content.type === 'string') return content;
    return React.cloneElement(content as React.ReactElement<ClonableProps>, {
      placement: 'floating',
    });
  }, [config]);

  const mobileDialogConfig = React.useMemo(() => {
    if (!config) return null;
    return { ...config, footer: undefined };
  }, [config]);

  return {
    mobileSidePanelOpen,
    setMobileSidePanelOpen,
    mobileSidePanelMounted,
    mobileSidePanelVisible,
    mobilePanelDragX,
    globalMobileMenuOpen,
    handlePanelTouchStart,
    handlePanelTouchMove,
    handlePanelTouchEnd,
    mobileFooterContent,
    mobileDialogConfig,
  };
}
