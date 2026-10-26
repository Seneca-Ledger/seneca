import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { type E2eAccount, e2eTestingModule, registerAccount } from './e2e-app';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface ContractApp {
  app: INestApplication;
  dataSource: DataSource;
  owner: E2eAccount;
  /** A request as the owner, in the owner's workspace. */
  call: (method: Method, url: string, body?: object) => request.Test;
  /** The answer after a 2xx, decoded by its contract. */
  answer: <S extends Schema.Top>(schema: S, pending: request.Test) => Promise<S['Type']>;
}

/** The whole app with one registered owner, for the contract specs. */
export async function startContractApp(email: string, name: string): Promise<ContractApp> {
  const moduleFixture = await e2eTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  const owner = await registerAccount(app, email, name);

  const call = (method: Method, url: string, body?: object) => {
    const req = request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId);
    return body ? req.send(body) : req;
  };
  const answer = async <S extends Schema.Top>(schema: S, pending: request.Test) => {
    const res = await pending;
    if (res.status >= 300) {
      throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
    }
    const decode = Schema.decodeUnknownSync(schema as unknown as Schema.Codec<S['Type'], unknown>);
    return decode(res.body);
  };
  return { app, dataSource: moduleFixture.get(DataSource), owner, call, answer };
}

/** Records the manual expense the import and source specs read back. */
export async function seedManualExpense({ call }: ContractApp, merchant: string): Promise<void> {
  const categories = await call('get', '/categories?type=expense').expect(200);
  await call('post', '/statements/manual-expense')
    .field('amount', '42.50')
    .field('currency', 'USD')
    .field('merchant', merchant)
    .field('categoryId', categories.body[0].id)
    .field('date', new Date().toISOString().slice(0, 10))
    .expect(201);
}
