'use client';

import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { resolveCurrencyCode } from '@/app/lib/format-money';
import { useWorkspace } from './WorkspaceContext';

const STORAGE_KEY = 'lumio:currencyDisplay';

interface CurrencyDisplayContextType {
  /** When true, show amounts converted to workspaceCurrency. */
  showConverted: boolean;
  toggleShowConverted: () => void;
  /** Resolved workspace currency code (e.g. 'EUR'). */
  workspaceCurrency: string;
}

const CurrencyDisplayContext = createContext<CurrencyDisplayContextType | undefined>(undefined);

export function CurrencyDisplayProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { currentWorkspace } = useWorkspace();
  const workspaceCurrency = resolveCurrencyCode(currentWorkspace?.currency);

  const [showConverted, setShowConverted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(showConverted));
  }, [showConverted]);

  const toggleShowConverted = useCallback(() => {
    setShowConverted(prev => !prev);
  }, []);

  const value = useMemo(
    () => ({ showConverted, toggleShowConverted, workspaceCurrency }),
    [showConverted, toggleShowConverted, workspaceCurrency],
  );

  return (
    <CurrencyDisplayContext.Provider value={value}>{children}</CurrencyDisplayContext.Provider>
  );
}

export function useCurrencyDisplay(): CurrencyDisplayContextType {
  const ctx = useContext(CurrencyDisplayContext);
  if (!ctx) {
    throw new Error('useCurrencyDisplay must be used inside CurrencyDisplayProvider');
  }
  return ctx;
}
