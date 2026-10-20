import { describe, expect, it } from 'vitest';
import { guessVendorDomain, toVendorDomain } from './vendor-domain.utils';

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

describe('toVendorDomain', () => {
  it('reduces a pasted address to the bare domain the API accepts', () => {
    expect(toVendorDomain('https://example.co.il/')).toBe('example.co.il');
    expect(toVendorDomain(' HTTP://Www.Figma.com:443/pricing?x=1#top ')).toBe('www.figma.com');
    expect(toVendorDomain('user@example.com/path')).toBe('example.com');
  });

  it('keeps a bare domain and an empty field as they are', () => {
    expect(toVendorDomain('netflix.com')).toBe('netflix.com');
    expect(toVendorDomain('   ')).toBe('');
  });
});
