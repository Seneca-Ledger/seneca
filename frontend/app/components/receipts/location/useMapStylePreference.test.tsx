// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMapStylePreference } from './useMapStylePreference';

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  setUser: vi.fn(),
  toastError: vi.fn(),
  user: { id: 'user-1', email: 'a@b.c', name: 'A', role: 'user', mapStylePreference: 'positron' } as {
    id: string;
    email: string;
    name: string;
    role: string;
    mapStylePreference?: string | null;
  } | null,
}));

const i18nMocks = vi.hoisted(() => ({
  en: {
    title: 'Location',
    sourceMerchantAddress: 'From merchant address',
    sourceExif: 'From photo',
    sourceDevice: 'From device',
    sourceManual: 'Set manually',
    sourceFiscalQr: 'From tax receipt',
    unsavedPoint: 'Unsaved point',
    noLocation: 'No location yet',
    cancel: 'Cancel',
    saveLocation: 'Save location',
    resetToAutomatic: 'Reset to automatic',
    mapUnavailable: 'Map is unavailable right now',
    tilesNotConfigured: 'Map tiles are not configured',
    moveHint: 'Drag the pin or click the map to move it.',
    placeHint: 'Click the map to place the point where this purchase was made.',
    saveFailed: 'Failed to save location',
    resetFailed: 'Failed to reset location',
    mapStyle: 'Map style',
    styleSaveFailed: 'Failed to save map style',
  } as Record<string, string>,
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    Object.fromEntries(
      Object.entries(i18nMocks.en).map(([key, value]) => [key, { value }]),
    ),
}));

vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user, setUser: mocks.setUser }),
}));

vi.mock('@/app/lib/api', () => ({ default: { patch: mocks.patch } }));

vi.mock('react-hot-toast', () => ({ default: { error: mocks.toastError } }));

describe('useMapStylePreference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.user = {
      id: 'user-1',
      email: 'a@b.c',
      name: 'A',
      role: 'user',
      mapStylePreference: 'positron',
    };
  });

  it('exposes the stored preference', () => {
    const { result } = renderHook(() => useMapStylePreference());

    expect(result.current.preference).toBe('positron');
  });

  it('applies the new style at once and saves it to the profile', async () => {
    mocks.patch.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useMapStylePreference());

    await act(async () => {
      await result.current.setPreference('dark-matter');
    });

    expect(mocks.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ mapStylePreference: 'dark-matter' }),
    );
    expect(mocks.patch).toHaveBeenCalledWith('/users/me/preferences', {
      mapStylePreference: 'dark-matter',
    });
    expect(JSON.parse(localStorage.getItem('user') ?? '{}').mapStylePreference).toBe('dark-matter');
  });

  it('rolls back when the save fails', async () => {
    mocks.patch.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useMapStylePreference());

    await act(async () => {
      await result.current.setPreference('dark-matter');
    });

    expect(mocks.setUser).toHaveBeenLastCalledWith(
      expect.objectContaining({ mapStylePreference: 'positron' }),
    );
    expect(mocks.toastError).toHaveBeenCalledWith('Failed to save map style');
  });

  it('does nothing when the style is already selected', async () => {
    const { result } = renderHook(() => useMapStylePreference());

    await act(async () => {
      await result.current.setPreference('positron');
    });

    expect(mocks.patch).not.toHaveBeenCalled();
  });
});
