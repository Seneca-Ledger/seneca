'use client';

import { useEffect } from 'react';

export default function GlobalNavHeight() {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const nav = document.querySelector<HTMLElement>('[data-global-nav]');

    if (!nav) {
      root.style.setProperty('--global-nav-height', '0px');
      return;
    }

    const updateHeight = () => {
      const height = nav.getBoundingClientRect().height;
      root.style.setProperty('--global-nav-height', `${Math.max(0, height)}px`);
    };

    updateHeight();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateHeight()) : null;

    resizeObserver?.observe(nav);

    const onResize = () => updateHeight();
    window.addEventListener('resize', onResize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return null;
}
