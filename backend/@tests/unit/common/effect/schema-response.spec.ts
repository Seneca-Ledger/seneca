import { InternalServerErrorException } from '@nestjs/common';
import { Schema, SchemaAST } from 'effect';
import { lastValueFrom, of } from 'rxjs';
import {
  ContractResponseInterceptor,
  projectToContract,
} from '@/common/effect/schema-response';

const Person = Schema.Struct({ id: Schema.String, name: Schema.String });
const Row = Schema.Struct({
  id: Schema.String,
  createdAt: Schema.String,
  owner: Schema.NullOr(Person),
  tags: Schema.Array(Schema.Struct({ id: Schema.String })),
  meta: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  kind: Schema.Union([
    Schema.Struct({ type: Schema.Literal('a'), a: Schema.Number }),
    Schema.Struct({ type: Schema.Literal('b'), b: Schema.Number }),
  ]),
});
const project = (value: unknown) => projectToContract(SchemaAST.toEncoded(Row.ast), value);

describe('projectToContract', () => {
  it('keeps only declared keys at every depth, records whole', () => {
    expect(
      project({
        id: 'r1',
        createdAt: '2026-10-13T00:00:00.000Z',
        filePath: '/app/uploads/x.pdf',
        owner: { id: 'u1', name: 'Ann', googleId: 'g', tokenVersion: 3 },
        tags: [{ id: 't1', userId: 'u2' }],
        meta: { anything: { deep: true } },
        kind: { type: 'a', a: 1, secret: 'x' },
      }),
    ).toEqual({
      id: 'r1',
      createdAt: '2026-10-13T00:00:00.000Z',
      owner: { id: 'u1', name: 'Ann' },
      tags: [{ id: 't1' }],
      meta: { anything: { deep: true } },
      kind: { type: 'a', a: 1 },
    });
  });

  it('keeps the keys any member of a union of arrays declares', () => {
    const Lists = Schema.Union([
      Schema.Array(Schema.Struct({ id: Schema.String })),
      Schema.Array(Schema.Struct({ id: Schema.String, month: Schema.String })),
    ]);
    expect(
      projectToContract(SchemaAST.toEncoded(Lists.ast), [{ id: 'g1', month: '2026-10', ownerId: 'u1' }]),
    ).toEqual([{ id: 'g1', month: '2026-10' }]);
  });

  it('lets opaque values through whole', () => {
    const Loose = Schema.Struct({ data: Schema.Unknown });
    expect(projectToContract(SchemaAST.toEncoded(Loose.ast), { data: { any: { thing: 1 } }, x: 1 })).toEqual({
      data: { any: { thing: 1 } },
    });
  });

  it('never fails: a drifted value still loses its undeclared keys', () => {
    expect(project({ id: 7, owner: 'not an object', extra: 1 })).toEqual({ id: 7, owner: 'not an object' });
  });
});

describe('ContractResponseInterceptor', () => {
  const context = {
    getClass: () => ({ name: 'TestController' }),
    getHandler: () => ({ name: 'list' }),
  } as never;
  const answer = (value: unknown) =>
    lastValueFrom(new ContractResponseInterceptor(Row).intercept(context, { handle: () => of(value) }));

  it('sends the serialized, projected answer', async () => {
    await expect(
      answer({
        id: 'r1',
        createdAt: new Date('2026-10-13T00:00:00.000Z'),
        owner: null,
        tags: [],
        kind: { type: 'b', b: 2 },
        fileHash: 'deadbeef',
      }),
    ).resolves.toEqual({
      id: 'r1',
      createdAt: '2026-10-13T00:00:00.000Z',
      owner: null,
      tags: [],
      kind: { type: 'b', b: 2 },
    });
  });

  it('fails loudly outside production when the answer drifts', async () => {
    await expect(answer({ id: 'r1' })).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('in production logs the drift and still sends only declared keys', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(answer({ id: 'r1', filePath: '/x' })).resolves.toEqual({ id: 'r1' });
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
