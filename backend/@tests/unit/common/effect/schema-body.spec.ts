import {
  Controller,
  HttpStatus,
  type INestApplication,
  NotFoundException,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Effect, Schema } from 'effect';
import request from 'supertest';
import { DomainError } from '@/common/effect/domain-error';
import { EffectRuntime, EffectRuntimeModule } from '@/common/effect/effect-runtime';
import { SchemaBody } from '@/common/effect/schema-body';
import { appError } from '@/common/errors/app-error';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';

// Same name for the schema and its type, as in packages/contracts: under
// Babel the parameter's design type then resolves to the schema object.
const Body = Schema.Struct({
  name: Schema.String.check(Schema.isBetweenLength(1, 5)),
  amount: Schema.optional(Schema.NullOr(Schema.Number)),
});
type Body = typeof Body.Type;

const OptionalBody = Schema.Struct({ note: Schema.optional(Schema.String) });
type OptionalBody = typeof OptionalBody.Type;

@Controller('probe')
class ProbeController {
  constructor(private readonly effects: EffectRuntime) {}

  @Post('body')
  echo(@SchemaBody(Body) body: Body) {
    return body;
  }

  @Post('optional')
  optional(@SchemaBody(OptionalBody) body: OptionalBody) {
    return body;
  }

  @Post('domain-error')
  domainError() {
    return this.effects.run(
      Effect.fail(new DomainError({ status: HttpStatus.NOT_FOUND, code: 'TABLE_NOT_FOUND' })),
    );
  }

  @Post('thrown-error')
  thrownError() {
    throw new NotFoundException(appError('TABLE_NOT_FOUND'));
  }

  @Post('defect')
  defect() {
    return this.effects.run(Effect.die(new Error('boom')));
  }
}

describe('Effect bridge', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EffectRuntimeModule],
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // Same global setup as main.ts: the schema has to win over class-validator.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(() => app.close());

  describe('SchemaBody', () => {
    it('passes a valid body through decoded', async () => {
      const res = await request(app.getHttpServer())
        .post('/probe/body')
        .send({ name: 'rent', amount: null })
        .expect(201);
      expect(res.body).toEqual({ name: 'rent', amount: null });
    });

    it('rejects unknown properties and invalid values with the class-validator 400 shape', async () => {
      const res = await request(app.getHttpServer())
        .post('/probe/body')
        .send({ name: 'too long', amount: '1', extra: true })
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBe('Bad request');
      expect(res.body.error.details.statusCode).toBe(400);
      expect(res.body.error.details.message).toEqual([
        expect.stringMatching(/^extra: /),
        expect.stringMatching(/^name: .*between 1 and 5/),
        expect.stringMatching(/^amount: /),
      ]);
    });

    it('rejects a missing body when it has required fields', async () => {
      const res = await request(app.getHttpServer()).post('/probe/body').expect(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('takes a missing body as an empty one, as the DTOs did', async () => {
      const res = await request(app.getHttpServer()).post('/probe/optional').expect(201);
      expect(res.body).toEqual({});
    });
  });

  describe('EffectRuntime.run', () => {
    it('answers a DomainError exactly like the thrown HttpException', async () => {
      const typed = await request(app.getHttpServer()).post('/probe/domain-error').expect(404);
      const thrown = await request(app.getHttpServer()).post('/probe/thrown-error').expect(404);

      const strip = ({ requestId, traceId, timestamp, path, ...rest }: Record<string, unknown>) =>
        rest;
      expect(strip(typed.body)).toEqual(strip(thrown.body));
      expect(typed.body.error).toEqual({ code: 'TABLE_NOT_FOUND', message: 'Table not found' });
    });

    it('turns a defect into a 500', async () => {
      const res = await request(app.getHttpServer()).post('/probe/defect').expect(500);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
