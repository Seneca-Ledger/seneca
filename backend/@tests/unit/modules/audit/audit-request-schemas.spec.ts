import { BadRequestException } from '@nestjs/common';
import { EffectSchemaQueryPipe } from '../../../../src/common/effect/schema-query';
import {
  AuditEntityParams,
  AuditEventsQuery,
} from '../../../../src/contracts/requests/audit';

const eventId = '7d0f3a52-1c4e-4b8a-9f00-2a6c1b9d4e11';

describe('audit route params and query', () => {
  const query = new EffectSchemaQueryPipe(AuditEventsQuery, 'query');
  const params = new EffectSchemaQueryPipe(AuditEntityParams, 'route parameters');

  it('reads page and limit as numbers and drops empty filters', () => {
    expect(query.transform({ page: '2', limit: '50', entityType: 'receipt', actorLabel: '' })).toEqual({
      page: 2,
      limit: 50,
      entityType: 'receipt',
    });
  });

  it('accepts an ISO timestamp as the date filter', () => {
    const dateFrom = '2026-10-01T00:00:00.000Z';
    expect(query.transform({ dateFrom })).toEqual({ dateFrom });
  });

  it.each([
    { entityId: 'not-a-uuid' },
    { entityType: 'spaceship' },
    { severity: 'loud' },
    { page: 'two' },
    { dateTo: 'yesterday' },
    { workspaceId: eventId },
  ])('rejects %o before it reaches the database', input => {
    expect(() => query.transform(input)).toThrow(BadRequestException);
  });

  it('takes an entity type and a uuid from the path', () => {
    expect(params.transform({ entityType: 'transaction', entityId: eventId })).toEqual({
      entityType: 'transaction',
      entityId: eventId,
    });
    expect(() => params.transform({ entityType: 'transaction', entityId: '42' })).toThrow(
      BadRequestException,
    );
  });
});
