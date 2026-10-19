import { describe, expect, it } from 'vitest';
import { guessVendorDomain } from './vendor-domain.utils';

describe('guessVendorDomain', () => {
  it('strips separators and appends .com', () => {
    expect(guessVendorDomain('Adobe Creative Cloud')).toBe('adobecreativecloud.com');
    expect(guessVendorDomain('ChatGPT Plus')).toBe('chatgptplus.com');
  });

  it('passes an existing domain through', () => {
    expect(guessVendorDomain('figma.com')).toBe('figma.com');
    expect(guessVendorDomain('  Sub.Example.CO.UK ')).toBe('sub.example.co.uk');
  });

  it('returns an empty string when there is nothing to guess from', () => {
    expect(guessVendorDomain('')).toBe('');
    expect(guessVendorDomain('   ')).toBe('');
    expect(guessVendorDomain('!!!')).toBe('');
  });
});
