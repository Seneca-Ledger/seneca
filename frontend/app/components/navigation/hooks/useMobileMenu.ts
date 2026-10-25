'use client';

import { useEffect, useState } from 'react';
import { MOBILE_MENU_VISIBILITY_EVENT } from '../helpers/navigation-config';

export function useMobileMenu(pathname: string) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuMounted, setMobileMenuMounted] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);

  // Close on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Animation mount/unmount cycle
  useEffect(() => {
    if (mobileMenuOpen) {
      setMobileMenuMounted(true);
      const frame = window.requestAnimationFrame(() => {
        setMobileMenuVisible(true);
      });
      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    if (!mobileMenuMounted) {
      return;
    }

    setMobileMenuVisible(false);
    const timer = window.setTimeout(() => {
      setMobileMenuMounted(false);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [mobileMenuOpen, mobileMenuMounted]);

  // Escape key + body overflow
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileMenuOpen]);

  // Broadcast visibility event
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(MOBILE_MENU_VISIBILITY_EVENT, {
        detail: { open: mobileMenuOpen },
      }),
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent(MOBILE_MENU_VISIBILITY_EVENT, {
          detail: { open: false },
        }),
      );
    };
  }, [mobileMenuOpen]);

  return { mobileMenuOpen, setMobileMenuOpen, mobileMenuMounted, mobileMenuVisible };
}
