/**
 * Tour Manager helper functions
 */

import type { AllowedButtons } from 'driver.js';

export const TOUR_STORAGE_KEY = 'seneca_tour_state';
export const TOUR_STATE_VERSION = '1.0.0';

export interface AnalyticsTracker {
  track: (event: string, properties: Record<string, unknown>) => void;
}

import type { Config as DriverConfig } from 'driver.js';
import { stabilizeTourPopover } from './TourPopoverPositioning';
import type { TourProgress, TourState } from './types';

export function getDefaultTourState(): TourState {
  return {
    completedTours: [],
    lastInteraction: new Date().toISOString(),
    version: TOUR_STATE_VERSION,
  };
}

export function saveTourState(state: TourState): void {
  try {
    state.lastInteraction = new Date().toISOString();
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save tour state:', error);
  }
}

export function loadTourState(): TourState | null {
  try {
    const stored = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const state = JSON.parse(stored) as TourState;
    if (state.version !== TOUR_STATE_VERSION) {
      console.warn('Tour state version mismatch, resetting');
      return null;
    }
    return state;
  } catch (error) {
    console.error('Failed to load tour state:', error);
    return null;
  }
}

export function serializeProgress(progress: TourProgress): TourProgress {
  return {
    ...progress,
    startedAt:
      progress.startedAt instanceof Date ? progress.startedAt.toISOString() : progress.startedAt,
    completedAt:
      progress.completedAt instanceof Date
        ? progress.completedAt.toISOString()
        : progress.completedAt,
  };
}

import type { TourDriverConfig } from './types';

const DRIVER_DEFAULTS = {
  showProgress: true,
  animate: true,
  allowClose: true,
  popoverClass: 'tour-popover',
  progressText: '{{current}} of {{total}}',
  nextBtnText: 'Next',
  prevBtnText: 'Back',
  doneBtnText: 'Done',
} as const;

export function buildDriverConfig(
  overrides: TourDriverConfig | undefined,
  onHighlighted: () => void,
  onDestroyed: () => void,
): Partial<DriverConfig> {
  const merged = { ...DRIVER_DEFAULTS, ...(overrides ?? {}) };
  return {
    showProgress: merged.showProgress,
    animate: merged.animate,
    allowClose: merged.allowClose,
    showButtons: toAllowedButtons(overrides?.showButtons),
    popoverClass: merged.popoverClass,
    progressText: merged.progressText,
    nextBtnText: merged.nextBtnText,
    prevBtnText: merged.prevBtnText,
    doneBtnText: merged.doneBtnText,
    onPopoverRender: (popover, opts) => {
      stabilizeTourPopover(popover, {
        side: opts.state.activeStep?.popover?.side,
        align: opts.state.activeStep?.popover?.align,
      });
    },
    onHighlighted,
    onDestroyed,
  };
}

export function toAllowedButtons(value?: string[]): AllowedButtons[] | undefined {
  if (!value) {
    return undefined;
  }

  return value.filter(
    (button): button is AllowedButtons =>
      button === 'next' || button === 'previous' || button === 'close',
  );
}

export function getPreferredLang(): string {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement?.lang;
    if (lang) {
      return lang;
    }
  }
  return 'ru';
}

function resolveIntlayerProxy(record: Record<string, unknown>): string | null {
  const maybeValue: unknown = Reflect.get(record, 'value');
  if (typeof maybeValue !== 'undefined') {
    return resolveText(maybeValue);
  }
  return null;
}

function resolveTranslationNode(record: Record<string, unknown>): string | null {
  if (
    record.nodeType === 'translation' &&
    typeof record.translation === 'object' &&
    record.translation
  ) {
    const lang = getPreferredLang();
    const translation = record.translation as Record<string, unknown>;
    return resolveText(translation[lang] ?? translation.ru ?? Object.values(translation)[0]);
  }
  return null;
}

function hasLocaleKeys(record: Record<string, unknown>): boolean {
  return 'ru' in record || 'en' in record || 'kk' in record;
}

function resolveLocaleMap(record: Record<string, unknown>): string | null {
  if (!hasLocaleKeys(record)) {
    return null;
  }
  const lang = getPreferredLang();
  return resolveText(record[lang] ?? record.ru ?? record.en ?? record.kk);
}

function resolveObjectInput(record: Record<string, unknown>, input: unknown): string {
  return (
    resolveIntlayerProxy(record) ??
    resolveTranslationNode(record) ??
    resolveLocaleMap(record) ??
    String(input)
  );
}

export function resolveText(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input == null) {
    return '';
  }

  if (typeof input === 'object') {
    return resolveObjectInput(input as Record<string, unknown>, input);
  }

  return String(input);
}

export function getAnalyticsTracker(): AnalyticsTracker | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const analytics = (window as Window & { analytics?: unknown }).analytics;
  if (!analytics || typeof analytics !== 'object' || !('track' in analytics)) {
    return null;
  }

  const track = (analytics as { track?: unknown }).track;
  if (typeof track !== 'function') {
    return null;
  }

  return analytics as AnalyticsTracker;
}

export function markTourCompleted(tourId: string): void {
  const state = loadTourState() ?? getDefaultTourState();
  if (!state.completedTours.includes(tourId)) {
    state.completedTours.push(tourId);
  }
  if (state.currentProgress?.tourId === tourId) {
    state.currentProgress.completed = true;
    state.currentProgress.completedAt = new Date().toISOString();
  }
  saveTourState(state);
}

export function updateTourProgress(tourId: string, stepIndex: number): void {
  const state = loadTourState();
  if (state?.currentProgress?.tourId === tourId) {
    state.currentProgress.currentStep = stepIndex;
    saveTourState(state);
  }
}

export function saveTourStartProgress(progress: TourProgress): void {
  const state = loadTourState() ?? getDefaultTourState();
  state.currentProgress = serializeProgress(progress);
  saveTourState(state);
}

export interface DismissListeners {
  onClick: (event: MouseEvent) => void;
  onVisibilityChange: () => void;
}

export function createDismissListeners(
  isActive: () => boolean,
  stopTour: () => void,
): DismissListeners {
  return {
    onClick: (event: MouseEvent): void => {
      if (!isActive()) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest('.driver-popover')) {
        return;
      }
      stopTour();
    },
    onVisibilityChange: (): void => {
      if (document.visibilityState === 'hidden' && isActive()) {
        stopTour();
      }
    },
  };
}
