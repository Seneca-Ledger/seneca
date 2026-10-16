import { HttpStatus, Injectable } from '@nestjs/common';
import { type Cause, Data, Effect, Schedule, Schema } from 'effect';
import {
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from 'effect/http';
import { DomainError } from '../../common/effect/domain-error';
import { EffectRuntime } from '../../common/effect/effect-runtime';

/**
 * Recommand's Peppol API (https://docs.recommand.eu, OpenAPI at
 * https://app.recommand.eu/openapi): a certified Peppol access point the
 * user signs up with, so each Lumio install sends with its own key and
 * secret (HTTP Basic). Only the calls Lumio makes, and only the fields it
 * reads, are described here.
 */
export const RECOMMAND_API_URL = 'https://app.recommand.eu';

const REQUEST_TIMEOUT = '30 seconds';

export interface RecommandCredentials {
  apiKeyId: string;
  apiSecret: string;
}

const Text = Schema.optional(Schema.NullOr(Schema.String));

const Company = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  country: Text,
  vatNumber: Text,
  enterpriseNumber: Text,
  enterpriseNumberScheme: Text,
  isVerified: Schema.optional(Schema.Boolean),
});
export type RecommandCompany = Schema.Schema.Type<typeof Company>;

const CompaniesResponse = Schema.Struct({ companies: Schema.Array(Company) });

const VerifyResponse = Schema.Struct({
  isValid: Schema.Boolean,
  companyName: Text,
  supportedDocuments: Schema.optional(
    Schema.Array(Schema.Struct({ docTypeId: Schema.String, name: Text })),
  ),
});
export type RecommandVerification = Schema.Schema.Type<typeof VerifyResponse>;

const Delivery = Schema.Struct({
  channel: Text,
  status: Text,
  failure: Schema.optional(Schema.Unknown),
});

const SendResponse = Schema.Struct({
  id: Schema.String,
  deliveryStatus: Text,
  deliveries: Schema.optional(Schema.Array(Delivery)),
});
export type RecommandSent = Schema.Schema.Type<typeof SendResponse>;

const DocumentSummary = Schema.Struct({
  id: Schema.String,
  type: Text,
  senderId: Text,
  docTypeId: Text,
});

const InboxResponse = Schema.Struct({ documents: Schema.Array(DocumentSummary) });
export type RecommandInboxEntry = Schema.Schema.Type<typeof DocumentSummary>;

const DocumentResponse = Schema.Struct({
  document: Schema.Struct({
    id: Schema.String,
    type: Text,
    senderId: Text,
    xml: Text,
    deliveryStatus: Text,
    deliveries: Schema.optional(Schema.Array(Delivery)),
  }),
});
export type RecommandDocument = Schema.Schema.Type<typeof DocumentResponse>['document'];

/** Recommand answered, but not with a success. */
class RecommandRefused extends Data.TaggedError('RecommandRefused')<{
  readonly status: number;
  readonly reason: string;
}> {}

/** What an error body says, as a user can read it: Recommand's `errors` lists messages per path. */
function reasonOf(body: unknown): string {
  if (body && typeof body === 'object') {
    const errors = (body as { errors?: unknown }).errors;
    if (errors && typeof errors === 'object') {
      const messages = Object.values(errors as Record<string, unknown>)
        .flatMap(value => (Array.isArray(value) ? value : [value]))
        .filter((value): value is string => typeof value === 'string');
      if (messages.length > 0) {
        return messages.slice(0, 5).join('; ');
      }
    }
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return 'no reason given';
}

/** The text of a delivery failure, whatever shape Recommand gives it. */
export function failureText(failure: unknown): string | null {
  if (!failure) {
    return null;
  }
  if (typeof failure === 'string') {
    return failure;
  }
  if (typeof failure === 'object') {
    const { message, reason, code } = failure as Record<string, unknown>;
    const text = [message, reason, code].find(value => typeof value === 'string');
    if (typeof text === 'string') {
      return text;
    }
  }
  return JSON.stringify(failure).slice(0, 500);
}

type Failure =
  | RecommandRefused
  | HttpClientError.HttpClientError
  | Schema.SchemaError
  | Cause.TimeoutError;

/** Into the error the user sees; every case says what to do, none leaks the request. */
function toDomainError(error: Failure): DomainError {
  switch (error._tag) {
    case 'RecommandRefused':
      if (error.status === 401 || error.status === 403) {
        return new DomainError({ status: HttpStatus.BAD_REQUEST, code: 'PEPPOL_AUTH_FAILED' });
      }
      if (error.status === 404) {
        return new DomainError({ status: HttpStatus.NOT_FOUND, code: 'PEPPOL_COMPANY_NOT_FOUND' });
      }
      if (error.status >= 500 || error.status === 429) {
        return new DomainError({ status: HttpStatus.BAD_GATEWAY, code: 'PEPPOL_UNAVAILABLE' });
      }
      return new DomainError({
        status: HttpStatus.BAD_REQUEST,
        code: 'PEPPOL_REJECTED',
        params: { reason: error.reason },
      });
    case 'TimeoutError':
    case 'HttpClientError':
    case 'SchemaError':
      return new DomainError({ status: HttpStatus.BAD_GATEWAY, code: 'PEPPOL_UNAVAILABLE' });
  }
}

@Injectable()
export class RecommandClient {
  constructor(private readonly effects: EffectRuntime) {}

  /** Throws PEPPOL_AUTH_FAILED when the key and secret are not accepted. */
  async verifyAuth(credentials: RecommandCredentials): Promise<void> {
    await this.call(credentials, 'GET', '/api/core/auth/verify', Schema.Unknown);
  }

  async companies(credentials: RecommandCredentials): Promise<readonly RecommandCompany[]> {
    return (await this.call(credentials, 'GET', '/api/v1/companies', CompaniesResponse)).companies;
  }

  /** Whether the participant is on the network, and the document types it registered. */
  async verify(
    credentials: RecommandCredentials,
    peppolId: string,
  ): Promise<RecommandVerification> {
    return this.call(credentials, 'POST', '/api/v1/verify', VerifyResponse, {
      peppolAddress: peppolId,
    });
  }

  /** Sends a document Lumio wrote as it is (`documentType: "xml"`), in the format named by `doctypeId`. */
  async sendXml(
    credentials: RecommandCredentials,
    companyId: string,
    document: { recipient: string; doctypeId: string; xml: string },
  ): Promise<RecommandSent> {
    return this.call(
      credentials,
      'POST',
      `/api/v1/${encodeURIComponent(companyId)}/send`,
      SendResponse,
      {
        recipient: document.recipient,
        documentType: 'xml',
        doctypeId: document.doctypeId,
        document: document.xml,
      },
    );
  }

  async document(
    credentials: RecommandCredentials,
    documentId: string,
  ): Promise<RecommandDocument> {
    return (
      await this.call(
        credentials,
        'GET',
        `/api/v1/documents/${encodeURIComponent(documentId)}`,
        DocumentResponse,
      )
    ).document;
  }

  /** Every unread incoming document of the company; not paginated, so read ones must be marked. */
  async inbox(
    credentials: RecommandCredentials,
    companyId: string,
  ): Promise<readonly RecommandInboxEntry[]> {
    return (
      await this.call(
        credentials,
        'GET',
        `/api/v1/inbox?companyId=${encodeURIComponent(companyId)}`,
        InboxResponse,
      )
    ).documents;
  }

  async markAsRead(credentials: RecommandCredentials, documentId: string): Promise<void> {
    await this.call(
      credentials,
      'POST',
      `/api/v1/documents/${encodeURIComponent(documentId)}/mark-as-read`,
      Schema.Unknown,
      { read: true },
    );
  }

  /**
   * One request. Reads are retried on network errors, 429 and 5xx; a send
   * is not, since a retried send could put the same invoice on the network
   * twice.
   */
  private call<A>(
    credentials: RecommandCredentials,
    method: 'GET' | 'POST',
    path: string,
    schema: Schema.Codec<A, unknown>,
    body?: unknown,
  ): Promise<A> {
    const authorization = `Basic ${Buffer.from(`${credentials.apiKeyId}:${credentials.apiSecret}`).toString('base64')}`;
    const url = `${RECOMMAND_API_URL}${path}`;
    const retry = method === 'GET' || !path.endsWith('/send');
    const request = (
      method === 'GET'
        ? HttpClientRequest.get(url)
        : HttpClientRequest.post(url).pipe(HttpClientRequest.bodyJsonUnsafe(body ?? {}))
    ).pipe(HttpClientRequest.setHeaders({ authorization, accept: 'application/json' }));

    const exchange = Effect.gen(function* () {
      const base = yield* HttpClient.HttpClient;
      const client = retry
        ? base.pipe(
            HttpClient.retryTransient({
              schedule: Schedule.exponential('500 millis').pipe(Schedule.jittered),
              times: 2,
            }),
          )
        : base;
      const response = yield* client.execute(request);
      if (response.status < 200 || response.status >= 300) {
        const errorBody = yield* response.json.pipe(Effect.orElseSucceed(() => null));
        return yield* Effect.fail(
          new RecommandRefused({ status: response.status, reason: reasonOf(errorBody) }),
        );
      }
      return yield* HttpClientResponse.schemaBodyJson(schema)(response);
    }).pipe(Effect.timeout(REQUEST_TIMEOUT), Effect.mapError(toDomainError));

    return this.effects.run(exchange);
  }
}
