import { type ArgumentsHost, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';

const queryFailed = (code: string, message: string) =>
  new QueryFailedError(
    'INSERT INTO t VALUES ($1)',
    [],
    Object.assign(new Error(message), { code }),
  );

function respond(exception: unknown): { status: number; body: { error: Record<string, unknown> } } {
  const json = vi.fn();
  const status = vi.fn((_code: number) => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/probe', method: 'POST' }),
    }),
  } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('HttpExceptionFilter', () => {
  beforeAll(() => Logger.overrideLogger(false));

  it('answers a value Postgres refused with a 400, without the database message', () => {
    for (const [code, message] of [
      ['22003', 'numeric field overflow'],
      ['22001', 'value too long for type character varying(10)'],
      ['22P02', 'invalid input syntax for type uuid: "abc"'],
      ['22008', 'date/time field value out of range: "9392-25-97"'],
    ]) {
      const { status, body } = respond(queryFailed(code, message));
      expect(status).toBe(400);
      expect(body.error).toMatchObject({
        code: 'BAD_REQUEST',
        message: 'A value is out of range or malformed',
      });
      expect(JSON.stringify(body)).not.toContain(message);
    }
  });

  it('answers a foreign key the request broke: 409 on a delete, 400 on a write', () => {
    const inUse = respond(
      queryFailed(
        '23503',
        'update or delete on table "clients" violates foreign key constraint "FK_invoices_client" on table "invoices"',
      ),
    );
    expect(inUse.status).toBe(409);
    expect(inUse.body.error.message).toBe('The record is still in use');

    const missing = respond(
      queryFailed(
        '23503',
        'insert or update on table "budgets" violates foreign key constraint "FK_budgets_category"',
      ),
    );
    expect(missing.status).toBe(400);
    expect(missing.body.error.message).toBe('It refers to a record that does not exist');
  });

  it('still answers other database failures with a 500', () => {
    const { status, body } = respond(queryFailed('23505', 'duplicate key value'));
    expect(status).toBe(500);
    expect(body.error).toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });
});
