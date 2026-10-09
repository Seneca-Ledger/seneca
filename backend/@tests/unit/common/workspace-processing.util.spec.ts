import {
  DEFAULT_PROCESSING_SETTINGS,
  mergeProcessingSettings,
  readProcessingSettings,
} from '@/common/utils/workspace-processing.util';

describe('readProcessingSettings', () => {
  it('reproduces the previously hardcoded behaviour when nothing is set', () => {
    expect(readProcessingSettings(null)).toEqual({
      categorizationThreshold: 0.7,
      duplicateResolution: 'skip',
      aiCategorization: true,
      aiMerchantNormalization: true,
      merchantLearning: true,
    });
    expect(readProcessingSettings({ settings: null })).toEqual(DEFAULT_PROCESSING_SETTINGS);
    expect(readProcessingSettings({ settings: {} })).toEqual(DEFAULT_PROCESSING_SETTINGS);
  });

  it('reads stored values', () => {
    const settings = {
      processing: {
        categorizationThreshold: 0.4,
        duplicateResolution: 'skip',
        aiCategorization: false,
        merchantLearning: false,
      },
    };

    expect(readProcessingSettings({ settings })).toEqual({
      categorizationThreshold: 0.4,
      duplicateResolution: 'skip',
      aiCategorization: false,
      aiMerchantNormalization: true,
      merchantLearning: false,
    });
  });

  it('clamps a threshold outside 0..1 instead of categorising everything or nothing', () => {
    expect(
      readProcessingSettings({ settings: { processing: { categorizationThreshold: 5 } } })
        .categorizationThreshold,
    ).toBe(1);
    expect(
      readProcessingSettings({ settings: { processing: { categorizationThreshold: -2 } } })
        .categorizationThreshold,
    ).toBe(0);
  });

  it('falls back for junk values rather than trusting the blob', () => {
    const settings = {
      processing: { categorizationThreshold: 'high', duplicateResolution: 'delete_everything' },
    };

    expect(readProcessingSettings({ settings })).toEqual(DEFAULT_PROCESSING_SETTINGS);
  });

  it('ignores a processing key that is not an object', () => {
    expect(readProcessingSettings({ settings: { processing: 'yes' } })).toEqual(
      DEFAULT_PROCESSING_SETTINGS,
    );
  });
});

describe('mergeProcessingSettings', () => {
  it('keeps unrelated settings keys intact', () => {
    const current = { theme: 'blue', processing: { categorizationThreshold: 0.5 } };

    const merged = mergeProcessingSettings(current, { duplicateResolution: 'mark_duplicate' });

    expect(merged.theme).toBe('blue');
    expect(merged.processing).toEqual({
      categorizationThreshold: 0.5,
      duplicateResolution: 'mark_duplicate',
      aiCategorization: true,
      aiMerchantNormalization: true,
      merchantLearning: true,
    });
  });

  it('starts from the defaults when the workspace has no settings yet', () => {
    expect(mergeProcessingSettings(null, { categorizationThreshold: 0.9 }).processing).toEqual({
      categorizationThreshold: 0.9,
      duplicateResolution: 'skip',
      aiCategorization: true,
      aiMerchantNormalization: true,
      merchantLearning: true,
    });
  });

  it('sanitises the patch on the way in', () => {
    const merged = mergeProcessingSettings(null, {
      categorizationThreshold: 42,
    } as never);

    expect((merged.processing as { categorizationThreshold: number }).categorizationThreshold).toBe(
      1,
    );
  });
});
