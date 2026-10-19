import { describe, expect, it } from 'vitest';
import { resolveMapStyleId } from './map-style';

const config = {
  styles: [
    { id: 'osm-bright', name: 'OSM Bright' },
    { id: 'positron', name: 'Positron' },
    { id: 'dark-matter', name: 'Dark Matter' },
  ],
  defaultStyleId: 'positron',
};

describe('resolveMapStyleId', () => {
  it('uses the style the user picked', () => {
    expect(resolveMapStyleId(config, 'osm-bright', true)).toBe('osm-bright');
  });

  it('ignores a pick the tile server no longer offers', () => {
    expect(resolveMapStyleId(config, 'satellite', false)).toBe('positron');
  });

  it('follows a dark theme until the user picks a style', () => {
    expect(resolveMapStyleId(config, null, true)).toBe('dark-matter');
  });

  it('falls back to the server default, then to the first style', () => {
    expect(resolveMapStyleId(config, null, false)).toBe('positron');
    expect(resolveMapStyleId({ ...config, defaultStyleId: null }, null, false)).toBe('osm-bright');
  });

  it('has nothing to show without a tile server', () => {
    expect(resolveMapStyleId({ styles: [], defaultStyleId: null }, 'osm-bright', true)).toBeNull();
    expect(resolveMapStyleId(undefined, null, false)).toBeNull();
  });
});
