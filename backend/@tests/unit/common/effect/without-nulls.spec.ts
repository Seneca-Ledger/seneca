import type { EntityMetadata } from 'typeorm';
import { withoutNullsOnRequired } from '@/common/effect/without-nulls';

describe('withoutNullsOnRequired', () => {
  const metadata = {
    findColumnWithPropertyName: (name: string) =>
      ({ name: { isNullable: false }, color: { isNullable: true } })[name],
  } as unknown as EntityMetadata;

  it('drops a null aimed at a NOT NULL column and keeps one that clears a nullable column', () => {
    expect(withoutNullsOnRequired(metadata, { name: null, color: null })).toEqual({ color: null });
  });

  it('keeps values, and keys that are not columns', () => {
    expect(withoutNullsOnRequired(metadata, { name: 'Rent', tags: null })).toEqual({
      name: 'Rent',
      tags: null,
    });
  });

  it('changes nothing without metadata', () => {
    expect(withoutNullsOnRequired(undefined, { name: null })).toEqual({ name: null });
  });
});
