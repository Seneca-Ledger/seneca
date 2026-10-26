import { describe, expect, it } from 'vitest';
import { findLargeSpinners, scanSource } from '../../scripts/find-large-spinners.mjs';

// Pages and blocks load with SnapshotSkeleton (the layout seen last time), not
// a spinner. A hit lists file:line; use SnapshotSkeleton there, or add the file
// to ALLOWED in the script with a reason.
describe('no page- or block-level spinners', () => {
  it('finds none under app/, components/ and lib/', { timeout: 60_000 }, () => {
    const hits = findLargeSpinners().map(hit => `${hit.file}:${hit.line} [${hit.size}px] ${hit.text}`);
    expect(hits).toEqual([]);
  });
});

describe('scanSource', () => {
  const scan = (body: string) => scanSource('probe.tsx', `const X = () => (${body});`);

  it.each([
    ['a large Spinner', '<Spinner size={40} />'],
    ['a CircularProgress at its 40px default', '<CircularProgress />'],
    ['a Tailwind-sized Spinner', '<Spinner className="h-8 w-8" />'],
    ['a Spinner sized by style', '<Spinner style={{ height: 80, width: 80 }} />'],
    [
      'a small spinner alone in a centring box',
      "<Box sx={{ display: 'flex', justifyContent: 'center' }}><Spinner size={16} /></Box>",
    ],
  ])('flags %s', (_case, body) => {
    expect(scan(body)).toHaveLength(1);
  });

  it.each([
    ['a small inline spinner', '<span><Spinner size={14} /> Saving</span>'],
    ['a spinner inside a button', '<Button>{busy ? <CircularProgress size={24} /> : null}</Button>'],
    ['a spinner as a start icon', '<Button startIcon={<Spinner size={24} />}>Go</Button>'],
  ])('lets %s pass', (_case, body) => {
    expect(scan(body)).toEqual([]);
  });
});
