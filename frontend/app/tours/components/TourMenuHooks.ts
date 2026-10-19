/**
 * Custom hooks for TourMenu component
 */

import { useEffect, useState } from 'react';
import { createAdminTour } from '../admin-tour';
import { createCategoriesTour } from '../categories-tour';
import { createCustomTablesTour } from '../custom-tables-tour';
import { createIntegrationsTour } from '../integrations-tour';
import { createReportsTour } from '../reports-tour';
import { createSettingsTour } from '../settings-tour';
import { createStatementsTour } from '../statements-tour';
import { getTourManager } from '../TourManager';
import type { TourConfig } from '../types';
import type { TourTextContent } from './TourMenuHelpers';
import { getTypedTourInput } from './TourMenuHelpers';

type CreateCustomTablesTourInput = Parameters<typeof createCustomTablesTour>[0];
type CreateReportsTourInput = Parameters<typeof createReportsTour>[0];
type CreateCategoriesTourInput = Parameters<typeof createCategoriesTour>[0];
type CreateIntegrationsTourInput = Parameters<typeof createIntegrationsTour>[0];
type CreateSettingsTourInput = Parameters<typeof createSettingsTour>[0];
type CreateAdminTourInput = Parameters<typeof createAdminTour>[0];

export interface TourTextsMap {
  customTables: TourTextContent;
  reports: TourTextContent;
  categories: TourTextContent;
  integrations: TourTextContent;
  settings: TourTextContent;
  admin: TourTextContent;
}

export function buildAllTours(texts: TourTextsMap, statementsTexts: unknown): TourConfig[] {
  return [
    createStatementsTour(statementsTexts as Parameters<typeof createStatementsTour>[0]),
    createCustomTablesTour(getTypedTourInput<CreateCustomTablesTourInput>(texts.customTables)),
    createReportsTour(getTypedTourInput<CreateReportsTourInput>(texts.reports)),
    createCategoriesTour(getTypedTourInput<CreateCategoriesTourInput>(texts.categories)),
    createIntegrationsTour(getTypedTourInput<CreateIntegrationsTourInput>(texts.integrations)),
    createSettingsTour(getTypedTourInput<CreateSettingsTourInput>(texts.settings)),
    createAdminTour(getTypedTourInput<CreateAdminTourInput>(texts.admin)),
  ];
}

export interface TourRegistrationOptions {
  statementsTexts: unknown;
  tourTexts: TourTextsMap;
}

export function useTourRegistration(options: TourRegistrationOptions): void {
  const { statementsTexts, tourTexts } = options;
  useEffect(() => {
    const tourManager = getTourManager();
    const allTours = buildAllTours(tourTexts, statementsTexts);
    allTours.forEach(tour => {
      tourManager.registerTour(tour);
    });
  }, [statementsTexts, tourTexts]);
}

export interface TourCompletedState {
  tours: TourConfig[];
  completedTours: Set<string>;
}

export function useTourCompletedState(open: boolean): TourCompletedState {
  const [tours, setTours] = useState<TourConfig[]>([]);
  const [completedTours, setCompletedTours] = useState<Set<string>>(new Set());

  useEffect(() => {
    const tourManager = getTourManager();
    const registeredTours = tourManager.getAllTours();
    setTours(registeredTours);

    const updateCompleted = (): void => {
      const completed = new Set<string>();
      registeredTours.forEach(tour => {
        if (tourManager.isTourCompleted(tour.id)) {
          completed.add(tour.id);
        }
      });
      // Polled twice a second while the menu is open: keep the previous Set
      // when nothing changed so the menu does not re-render on every tick.
      setCompletedTours(prev =>
        prev.size === completed.size && [...completed].every(id => prev.has(id)) ? prev : completed,
      );
    };

    updateCompleted();

    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === 'seneca_tour_state') {
        updateCompleted();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = open ? setInterval(updateCompleted, 500) : null;

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [open]);

  return { tours, completedTours };
}
