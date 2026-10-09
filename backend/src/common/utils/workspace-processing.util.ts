/**
 * Per-workspace defaults for how incoming data is processed.
 *
 * These used to be constants buried in the classification and import services
 * (`0.7`, `'skip'`). The defaults below reproduce that behaviour exactly, so a
 * workspace that never touches the settings sees no change.
 */

export const duplicateResolutions = ['skip', 'mark_duplicate', 'force_import'] as const;
export type DuplicateResolution = (typeof duplicateResolutions)[number];

export type WorkspaceProcessingSettings = {
  /** Minimum weighted score for a learned pattern to categorise a transaction. */
  categorizationThreshold: number;
  /** What to do with a row that looks like an existing transaction. */
  duplicateResolution: DuplicateResolution;
  /** Ask the configured model for categories during import, and reuse what it taught. */
  aiCategorization: boolean;
  /** Keep the model's normalised merchant name next to the raw one. */
  aiMerchantNormalization: boolean;
  /** Remember manual corrections and reuse them on later imports. */
  merchantLearning: boolean;
};

export const DEFAULT_PROCESSING_SETTINGS: WorkspaceProcessingSettings = {
  categorizationThreshold: 0.7,
  duplicateResolution: 'skip',
  aiCategorization: true,
  aiMerchantNormalization: true,
  merchantLearning: true,
};

const PROCESSING_KEY = 'processing';

const clampThreshold = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  // A threshold outside 0..1 would either categorise everything or nothing.
  return Math.min(1, Math.max(0, parsed));
};

const readFlag = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/** Reads the settings off a workspace, falling back to today's behaviour. */
export const readProcessingSettings = (
  workspace?: { settings?: Record<string, unknown> | null } | null,
): WorkspaceProcessingSettings => {
  const raw = workspace?.settings?.[PROCESSING_KEY];
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_PROCESSING_SETTINGS;
  }

  const stored = raw as Partial<Record<keyof WorkspaceProcessingSettings, unknown>>;
  const resolution = stored.duplicateResolution;

  return {
    categorizationThreshold: clampThreshold(
      stored.categorizationThreshold,
      DEFAULT_PROCESSING_SETTINGS.categorizationThreshold,
    ),
    duplicateResolution: duplicateResolutions.includes(resolution as DuplicateResolution)
      ? (resolution as DuplicateResolution)
      : DEFAULT_PROCESSING_SETTINGS.duplicateResolution,
    aiCategorization: readFlag(
      stored.aiCategorization,
      DEFAULT_PROCESSING_SETTINGS.aiCategorization,
    ),
    aiMerchantNormalization: readFlag(
      stored.aiMerchantNormalization,
      DEFAULT_PROCESSING_SETTINGS.aiMerchantNormalization,
    ),
    merchantLearning: readFlag(
      stored.merchantLearning,
      DEFAULT_PROCESSING_SETTINGS.merchantLearning,
    ),
  };
};

/** Merges a patch into the workspace settings blob without touching other keys. */
export const mergeProcessingSettings = (
  current: Record<string, unknown> | null | undefined,
  patch: Partial<WorkspaceProcessingSettings>,
): Record<string, unknown> => {
  const existing = readProcessingSettings({ settings: current });

  return {
    ...(current ?? {}),
    [PROCESSING_KEY]: readProcessingSettings({
      settings: { [PROCESSING_KEY]: { ...existing, ...patch } },
    }),
  };
};
