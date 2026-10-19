'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  SidePanelContextState,
  SidePanelPageConfig,
  SidePanelPosition,
  SidePanelProviderProps,
  SidePanelWidth,
} from './types';

// ============================================================================
// Context
// ============================================================================

const SidePanelContext = createContext<SidePanelContextState | undefined>(undefined);

// ============================================================================
// Storage Keys
// ============================================================================

const DEFAULT_STORAGE_KEY = 'side-panel-state';

interface PersistedState {
  isCollapsed: boolean;
  width: SidePanelWidth;
  position: SidePanelPosition;
  collapsedSections: string[];
}

// ============================================================================
// Provider Component
// ============================================================================

// localStorage access lives outside the provider: React Compiler skips any
// component containing a try/catch with early returns.
function readPersistedState(storageKey: string): PersistedState | null {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as PersistedState) : null;
  } catch {
    return null; // Ignore parse errors
  }
}

function writePersistedState(storageKey: string, state: PersistedState): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

export function SidePanelProvider({
  children,
  defaultWidth = 'md',
  defaultPosition = 'right',
  defaultCollapsed = false,
  checkPermission,
  persistState = true,
  storageKey = DEFAULT_STORAGE_KEY,
}: SidePanelProviderProps) {
  // Keep server and initial client render identical to avoid hydration mismatch.
  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed);
  const [width, setWidth] = useState<SidePanelWidth>(defaultWidth);
  const [position, setPosition] = useState<SidePanelPosition>(defaultPosition);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const [config, setConfig] = useState<SidePanelPageConfig | null>(null);

  // Restore persisted state on client after mount.
  // eslint-disable-next-line complexity
  useEffect(() => {
    if (typeof window === 'undefined' || !persistState) return;

    const parsed = readPersistedState(storageKey);
    if (!parsed) return;
    setIsCollapsed(parsed.isCollapsed ?? defaultCollapsed);
    setWidth(parsed.width ?? defaultWidth);
    setPosition(parsed.position ?? defaultPosition);
    setCollapsedSections(new Set(parsed.collapsedSections ?? []));
  }, [defaultCollapsed, defaultPosition, defaultWidth, persistState, storageKey]);

  // Persist state to localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !persistState) return;

    const state: PersistedState = {
      isCollapsed,
      width,
      position,
      collapsedSections: Array.from(collapsedSections),
    };

    writePersistedState(storageKey, state);
  }, [isCollapsed, width, position, collapsedSections, persistState, storageKey]);

  // Toggle collapsed state
  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Set collapsed state
  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
  }, []);

  // Toggle section collapsed state
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Check permission
  const hasPermission = useCallback(
    (permission: string) => {
      if (!checkPermission) return true;
      return checkPermission(permission);
    },
    [checkPermission],
  );

  // Memoize context value

  const contextValue = useMemo<SidePanelContextState>(
    () => ({
      isCollapsed,
      toggleCollapsed,
      setCollapsed,
      width,
      setWidth,
      position,
      setPosition,
      config,
      setConfig,
      collapsedSections,
      toggleSection,
      hasPermission,
    }),
    [
      isCollapsed,
      toggleCollapsed,
      setCollapsed,
      width,
      setWidth,
      position,
      setPosition,
      config,
      collapsedSections,
      toggleSection,
      hasPermission,
    ],
  );

  return <SidePanelContext.Provider value={contextValue}>{children}</SidePanelContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useSidePanel(): SidePanelContextState {
  const context = useContext(SidePanelContext);
  if (context === undefined) {
    throw new Error('useSidePanel must be used within a SidePanelProvider');
  }
  return context;
}

// ============================================================================
// Optional Hook (returns null if not in provider)
// ============================================================================

export function useSidePanelOptional(): SidePanelContextState | null {
  return useContext(SidePanelContext) ?? null;
}
