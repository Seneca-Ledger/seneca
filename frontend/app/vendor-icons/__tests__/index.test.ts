import { describe, expect, it } from 'vitest';
import { resolveVendorIcon } from '../index';

describe('resolveVendorIcon', () => {
  it('matches a plain vendor name', () => {
    expect(resolveVendorIcon('Netflix')?.slug).toBe('netflix');
  });

  it('ignores case, padding and separators', () => {
    expect(resolveVendorIcon('  NETFLIX ')?.slug).toBe('netflix');
    expect(resolveVendorIcon('Net-flix')).toBeNull();
    expect(resolveVendorIcon('GitHub')?.slug).toBe('github');
  });

  it('matches a vendor name carrying a plan suffix', () => {
    expect(resolveVendorIcon('Netflix Premium Family')?.slug).toBe('netflix');
    expect(resolveVendorIcon('Claude Pro')?.slug).toBe('claude');
  });

  it('prefers the more specific keyword', () => {
    expect(resolveVendorIcon('Google Drive')?.slug).toBe('googledrive');
    expect(resolveVendorIcon('Google Workspace')?.slug).toBe('google');
  });

  it('returns null for an unknown vendor', () => {
    expect(resolveVendorIcon('BVG')).toBeNull();
    expect(resolveVendorIcon('WeWork')).toBeNull();
  });

  it('returns null for an empty name', () => {
    expect(resolveVendorIcon('')).toBeNull();
    expect(resolveVendorIcon(null)).toBeNull();
  });
});
