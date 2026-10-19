import {
  DEFAULT_PLUGIN_SETTINGS,
  mergePluginSettings,
  readPluginSettings,
} from '@/common/utils/workspace-plugins.util';

describe('readPluginSettings', () => {
  it('treats a workspace without switches as having every plugin off', () => {
    expect(readPluginSettings(null)).toEqual(DEFAULT_PLUGIN_SETTINGS);
    expect(readPluginSettings({ settings: null })).toEqual({
      webhooks: false,
      mcp: false,
      aiAssistant: false,
    });
    expect(readPluginSettings({ settings: { plugins: 'on' } })).toEqual(DEFAULT_PLUGIN_SETTINGS);
  });

  it('reads stored switches and ignores anything that is not a boolean', () => {
    const settings = { plugins: { webhooks: true, mcp: 'yes', aiAssistant: 1, other: true } };

    expect(readPluginSettings({ settings })).toEqual({
      webhooks: true,
      mcp: false,
      aiAssistant: false,
    });
  });
});

describe('mergePluginSettings', () => {
  it('changes only the patched switch and keeps the rest of the settings', () => {
    const current = {
      profile: 'home',
      processing: { merchantLearning: false },
      plugins: { webhooks: true, mcp: false, aiAssistant: true },
    };

    expect(mergePluginSettings(current, { mcp: true })).toEqual({
      profile: 'home',
      processing: { merchantLearning: false },
      plugins: { webhooks: true, mcp: true, aiAssistant: true },
    });
  });

  it('starts from all-off on a workspace that never stored settings', () => {
    expect(mergePluginSettings(null, { webhooks: true })).toEqual({
      plugins: { webhooks: true, mcp: false, aiAssistant: false },
    });
  });
});
