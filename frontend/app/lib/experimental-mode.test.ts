import { afterEach, describe, expect, it } from 'vitest';
import { isExperimentalModeEnabled, setExperimentalModeEnabled } from './experimental-mode';

afterEach(() => {
  window.localStorage.clear();
});

describe('experimental mode', () => {
  it('is off until it is switched on', () => {
    expect(isExperimentalModeEnabled()).toBe(false);

    setExperimentalModeEnabled(true);

    expect(isExperimentalModeEnabled()).toBe(true);
  });

  it('clears the flag when switched off', () => {
    setExperimentalModeEnabled(true);
    setExperimentalModeEnabled(false);

    expect(isExperimentalModeEnabled()).toBe(false);
    expect(window.localStorage.getItem('seneca-experimental-mode')).toBeNull();
  });
});
