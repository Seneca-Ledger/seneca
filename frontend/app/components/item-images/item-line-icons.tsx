'use client';

/**
 * Things people sell that the category set has no drawing for. Lucide's
 * drawings (ISC licence, lucide.dev, v1.8.0 — copyright Lucide Contributors),
 * drawn with the category icons' 1.5px line helper.
 */
import { lineIcon } from '@/app/lib/category-line-icons';

export const Bike = lineIcon(
  [
    ['circle', { cx: '18.5', cy: '17.5', r: '3.5' }],
    ['circle', { cx: '5.5', cy: '17.5', r: '3.5' }],
    ['circle', { cx: '15', cy: '5', r: '1' }],
    ['path', { d: 'M12 17.5V14l-3-3 4-3 2 3h2' }],
  ],
  'Bike',
);

export const Watch = lineIcon(
  [
    ['path', { d: 'M12 10v2.2l1.6 1' }],
    ['path', { d: 'm16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05' }],
    ['path', { d: 'm7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05' }],
    ['circle', { cx: '12', cy: '12', r: '6' }],
  ],
  'Watch',
);

export const Headphones = lineIcon(
  [
    [
      'path',
      {
        d: 'M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3',
      },
    ],
  ],
  'Headphones',
);

export const Tv = lineIcon(
  [
    ['path', { d: 'm17 2-5 5-5-5' }],
    ['rect', { width: '20', height: '15', x: '2', y: '7', rx: '2' }],
  ],
  'Tv',
);

export const Sofa = lineIcon(
  [
    ['path', { d: 'M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3' }],
    [
      'path',
      {
        d: 'M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z',
      },
    ],
    ['path', { d: 'M4 18v2' }],
    ['path', { d: 'M20 18v2' }],
    ['path', { d: 'M12 4v9' }],
  ],
  'Sofa',
);

export const Tablet = lineIcon(
  [
    ['rect', { width: '16', height: '20', x: '4', y: '2', rx: '2', ry: '2' }],
    ['line', { x1: '12', x2: '12.01', y1: '18', y2: '18' }],
  ],
  'Tablet',
);

export const ImagePlus = lineIcon(
  [
    ['path', { d: 'M16 5h6' }],
    ['path', { d: 'M19 2v6' }],
    ['path', { d: 'M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5' }],
    ['path', { d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' }],
    ['circle', { cx: '9', cy: '9', r: '2' }],
  ],
  'ImagePlus',
);
