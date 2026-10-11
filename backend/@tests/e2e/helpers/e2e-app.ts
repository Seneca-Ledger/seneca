import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request, { type Response } from 'supertest';
import type { DataSource } from 'typeorm';
import { ACCESS_TOKEN_COOKIE } from '../../../src/modules/auth/auth-cookies';
import {
  REFERENCE_FETCH,
  type ReferenceFetch,
} from '../../../src/modules/reference-data/reference-fetch';

/**
 * A throttler store that never counts. Every e2e suite reaches the API from the
 * same address and, in CI, through one shared Redis store, so the 5-per-minute
 * auth limits trip across suites and turn unrelated tests into 429s. The limits
 * themselves are checked in auth.e2e-spec against a real in-memory store.
 */
const unlimitedStorage: ThrottlerStorage = {
  increment: async () => ({
    totalHits: 1,
    timeToExpire: 60,
    isBlocked: false,
    timeToBlockExpire: 0,
  }),
};

/**
 * What reference data (holidays, EU VAT rates, VIES) gets instead of the
 * internet. By default every call fails, as on an instance without network,
 * so no suite depends on outside services; a suite that needs an answer sets
 * `referenceFetch.handler` and resets it afterwards.
 */
export const referenceFetch: { handler: ReferenceFetch | null } = { handler: null };

const offlineFetch: ReferenceFetch = async (input, init) => {
  if (referenceFetch.handler) {
    return referenceFetch.handler(input, init);
  }
  throw new Error('No network in e2e tests');
};

export function e2eTestingModule(metadata: ModuleMetadata): TestingModuleBuilder {
  return Test.createTestingModule(metadata)
    .overrideProvider(ThrottlerStorage)
    .useValue(unlimitedStorage)
    .overrideProvider(REFERENCE_FETCH)
    .useValue(offlineFetch);
}

/** A cookie the response set. Tokens travel only as HttpOnly cookies, never in the body. */
export function responseCookie(res: Response, name: string): string | undefined {
  return ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .map(cookie => cookie.split(';')[0])
    .find(pair => pair.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export interface E2eAccount {
  email: string;
  token: string;
  userId: string;
  /** The personal workspace registration creates. */
  workspaceId: string;
}

/** Registers a user: the body carries the user and its workspace, the cookie the token. */
export async function registerAccount(
  app: INestApplication,
  email: string,
  name: string,
): Promise<E2eAccount> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'Test123!@#', name });
  if (res.status !== 201) {
    throw new Error(`Registering ${email} failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return {
    email,
    token: accessTokenOf(res),
    userId: res.body.user.id,
    workspaceId: res.body.user.workspaceId,
  };
}

/**
 * Removes an e2e user with the rows that block it: registration seeds categories
 * and these tables reference users without ON DELETE CASCADE.
 */
export async function deleteUserByEmail(dataSource: DataSource, email: string): Promise<void> {
  const users: Array<{ id: string }> = await dataSource.query(
    'SELECT id FROM users WHERE email = $1',
    [email],
  );
  for (const { id } of users) {
    await dataSource.query(
      'DELETE FROM transactions WHERE statement_id IN (SELECT id FROM statements WHERE user_id = $1)',
      [id],
    );
    for (const table of ['statements', 'categories', 'branches', 'wallets']) {
      await dataSource.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]);
    }
    await dataSource.query('DELETE FROM users WHERE id = $1', [id]);
  }
}

/** The access token a login or registration set; fails with the response when it did not. */
export function accessTokenOf(res: Response): string {
  const token = responseCookie(res, ACCESS_TOKEN_COOKIE);
  if (!token) {
    throw new Error(
      `No ${ACCESS_TOKEN_COOKIE} cookie in the ${res.status} response: ${JSON.stringify(res.body)}`,
    );
  }
  return token;
}
