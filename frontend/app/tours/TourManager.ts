/**
 * Tour Manager - manages launching, navigation and state of tours
 */

import { type Driver, type DriveStep, driver } from 'driver.js';
import {
  buildDriverConfig,
  createDismissListeners,
  getAnalyticsTracker,
  loadTourState,
  markTourCompleted,
  saveTourStartProgress,
  saveTourState,
  TOUR_STORAGE_KEY,
  updateTourProgress,
} from './TourManagerHelpers';
import { cleanupStableTourPopoverPositioning } from './TourPopoverPositioning';
import { buildDriveStep, type StepContext } from './TourStepBuilder';
import {
  type TourConfig,
  type TourDriverConfig,
  type TourProgress,
  type TourState,
  type TourStep,
} from './types';

export class TourManager {
  private driverInstance!: Driver;
  private currentTour: TourConfig | null = null;
  private registeredTours: Map<string, TourConfig> = new Map();
  private onNavigate?: (url: string) => Promise<void>;
  private isDestroying = false;
  private lastStepIndex = -1;
  private actualStepsCount = 0;
  private dismissOnClick?: (event: MouseEvent) => void;
  private dismissOnVisibilityChange?: () => void;

  constructor(options?: { onNavigate?: (url: string) => Promise<void> }) {
    this.onNavigate = options?.onNavigate;
    this.resetDriver();
  }

  private resetDriver(overrides?: TourDriverConfig): void {
    cleanupStableTourPopoverPositioning();
    if (this.driverInstance?.isActive()) {
      this.driverInstance.destroy();
    }
    const config = buildDriverConfig(
      overrides,
      () => {
        this.lastStepIndex = this.driverInstance.getActiveIndex() ?? -1;
      },
      () => {
        this.handleTourDestroyed();
      },
    );
    this.driverInstance = driver(config);
  }

  registerTour(tour: TourConfig): void {
    this.registeredTours.set(tour.id, tour);
  }

  registerTours(tours: TourConfig[]): void {
    tours.forEach(tour => {
      this.registerTour(tour);
    });
  }

  getTour(tourId: string): TourConfig | undefined {
    return this.registeredTours.get(tourId);
  }

  getAllTours(): TourConfig[] {
    return Array.from(this.registeredTours.values());
  }

  resumeTour(): boolean {
    const state = this.loadState();
    if (!state?.currentProgress || state.currentProgress.completed) {
      return false;
    }
    const { tourId, currentStep } = state.currentProgress;
    void this.startTour(tourId, currentStep);
    this.trackEvent('tour_resumed', { tourId });
    return true;
  }

  stopTour(): void {
    if (this.currentTour) {
      this.trackEvent('tour_abandoned', {
        tourId: this.currentTour.id,
        stepIndex: this.lastStepIndex,
      });
    }
    try {
      if (this.driverInstance.isActive()) {
        this.detachDismissListeners();
        cleanupStableTourPopoverPositioning();
        this.driverInstance.destroy();
      }
    } catch (error) {
      console.error('Error destroying driver:', error);
    }
    this.currentTour = null;
    this.isDestroying = false;
    this.lastStepIndex = -1;
    this.actualStepsCount = 0;
  }

  nextStep(): void {
    this.driverInstance.moveNext();
  }
  previousStep(): void {
    this.driverInstance.movePrevious();
  }
  isActive(): boolean {
    return this.driverInstance.isActive();
  }

  getActiveStepIndex(): number | null {
    const index = this.driverInstance.getActiveIndex();
    return index !== undefined ? index : null;
  }

  isTourCompleted(tourId: string): boolean {
    const state = this.loadState();
    return state?.completedTours.includes(tourId) ?? false;
  }

  resetTour(tourId: string): void {
    const state = this.loadState();
    if (!state) {
      return;
    }
    state.completedTours = state.completedTours.filter(id => id !== tourId);
    if (state.currentProgress?.tourId === tourId) {
      state.currentProgress = undefined;
    }
    this.saveState(state);
  }

  clearAllData(): void {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  }

  private buildStepContext(): StepContext {
    const lastStepRef = { value: this.lastStepIndex };
    return {
      lastStepIndex: lastStepRef,
      moveNext: () => this.driverInstance.moveNext(),
      movePrevious: () => this.driverInstance.movePrevious(),
      updateProgress: (index: number) => this.updateProgress(index),
      trackStep: (index: number) => {
        this.lastStepIndex = lastStepRef.value;
        this.trackEvent('tour_step_viewed', {
          tourId: this.currentTour?.id ?? '',
          stepIndex: index,
        });
      },
    };
  }

  private convertToDriverSteps(steps: TourStep[]): DriveStep[] {
    const ctx = this.buildStepContext();
    return steps.map((step, index) => buildDriveStep(step, index, ctx));
  }

  private initTourState(tour: TourConfig, startFromStep: number, stepsCount: number): void {
    this.actualStepsCount = stepsCount;
    this.saveProgress({
      tourId: tour.id,
      currentStep: startFromStep,
      totalSteps: stepsCount,
      completed: false,
      startedAt: new Date().toISOString(),
      skippedSteps: [],
    });
  }

  private driveSteps(tour: TourConfig, startFromStep: number): void {
    const driveSteps = this.convertToDriverSteps(tour.steps);
    this.driverInstance.setSteps(driveSteps);
    this.driverInstance.drive(startFromStep);
    this.attachDismissListeners();
    this.trackEvent('tour_started', { tourId: tour.id });
  }

  private prepareForTour(tourId: string, driverConfig?: TourDriverConfig): TourConfig | null {
    if (this.driverInstance.isActive()) {
      console.warn('Another tour is already active');
      return null;
    }
    const tour = this.registeredTours.get(tourId);
    if (!tour) {
      console.error(`Tour with id "${tourId}" not found`);
      return null;
    }
    this.isDestroying = false;
    this.lastStepIndex = -1;
    this.currentTour = tour;
    if (driverConfig) {
      this.resetDriver(driverConfig);
    }
    return tour;
  }

  async startTour(
    tourId: string,
    startFromStep = 0,
    driverConfig?: TourDriverConfig,
  ): Promise<void> {
    const tour = this.prepareForTour(tourId, driverConfig);
    if (!tour) {
      return;
    }

    const driveSteps = this.convertToDriverSteps(tour.steps);
    if (driveSteps.length === 0) {
      console.warn('No valid steps found for tour:', tourId);
      this.currentTour = null;
      return;
    }

    this.initTourState(tour, startFromStep, driveSteps.length);
    try {
      this.driveSteps(tour, startFromStep);
    } catch (error) {
      console.error('Failed to start tour:', error);
      this.currentTour = null;
    }
  }

  private getProgressIndex(tourId: string): number | undefined {
    const state = this.loadState();
    if (state?.currentProgress?.tourId !== tourId) {
      return undefined;
    }
    return state.currentProgress.currentStep;
  }

  private isTourFinished(tourId: string): boolean {
    if (this.actualStepsCount <= 0) {
      return false;
    }
    const lastStep = this.actualStepsCount - 1;
    if (this.lastStepIndex >= lastStep) {
      return true;
    }
    const progressIndex = this.getProgressIndex(tourId);
    return typeof progressIndex === 'number' && progressIndex >= lastStep;
  }

  private handleTourDestroyed(): void {
    if (!this.currentTour || this.isDestroying) {
      return;
    }
    this.isDestroying = true;
    const tourId = this.currentTour.id;
    this.detachDismissListeners();
    cleanupStableTourPopoverPositioning();
    if (this.isTourFinished(tourId)) {
      this.markTourCompleted(tourId);
      this.trackEvent('tour_completed', { tourId });
    }
    this.currentTour = null;
    this.isDestroying = false;
    this.lastStepIndex = -1;
    this.actualStepsCount = 0;
  }

  private attachDismissListeners(): void {
    if (this.dismissOnClick || this.dismissOnVisibilityChange) {
      return;
    }
    const listeners = createDismissListeners(
      () => this.driverInstance.isActive(),
      () => this.stopTour(),
    );
    this.dismissOnClick = listeners.onClick;
    this.dismissOnVisibilityChange = listeners.onVisibilityChange;
    document.addEventListener('click', this.dismissOnClick, true);
    document.addEventListener('visibilitychange', this.dismissOnVisibilityChange);
  }

  private detachDismissListeners(): void {
    if (this.dismissOnClick) {
      document.removeEventListener('click', this.dismissOnClick, true);
      this.dismissOnClick = undefined;
    }
    if (this.dismissOnVisibilityChange) {
      document.removeEventListener('visibilitychange', this.dismissOnVisibilityChange);
      this.dismissOnVisibilityChange = undefined;
    }
  }

  private markTourCompleted(tourId: string): void {
    markTourCompleted(tourId);
  }

  private updateProgress(stepIndex: number): void {
    if (this.currentTour) {
      updateTourProgress(this.currentTour.id, stepIndex);
    }
  }

  private saveProgress(progress: TourProgress): void {
    saveTourStartProgress(progress);
  }
  private loadState(): TourState | null {
    return loadTourState();
  }
  private saveState(state: TourState): void {
    saveTourState(state);
  }

  private trackEvent(event: string, data: Partial<{ tourId: string; stepIndex?: number }>): void {
    const analytics = getAnalyticsTracker();
    if (analytics) {
      analytics.track(event, { ...data, timestamp: new Date().toISOString() });
    }
  }
}

let tourManagerInstance: TourManager | null = null;

export function getTourManager(options?: {
  onNavigate?: (url: string) => Promise<void>;
}): TourManager {
  if (!tourManagerInstance) {
    tourManagerInstance = new TourManager(options);
  }
  return tourManagerInstance;
}
