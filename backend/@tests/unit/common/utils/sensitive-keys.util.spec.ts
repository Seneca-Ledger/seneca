import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { Readable } from 'node:stream';
import { StreamableFile } from '@nestjs/common';
import {
  ACCOUNT_KEYS,
  SERVER_ONLY_KEYS,
  withoutKeys,
} from '@/common/utils/sensitive-keys.util';

describe('withoutKeys', () => {
  it('drops file internals and credentials at any depth, and copies', () => {
    const row = {
      id: 's1',
      fileHash: 'deadbeef',
      fileData: Buffer.from('pdf'),
      createdAt: new Date('2026-10-13T00:00:00.000Z'),
      user: { id: 'u1', passwordHash: 'x', tokenVersion: 2, name: 'Ann' },
      attachments: [{ id: 'a1', storedFileName: 'abc.pdf' }],
    };

    expect(withoutKeys(row, SERVER_ONLY_KEYS)).toEqual({
      id: 's1',
      createdAt: new Date('2026-10-13T00:00:00.000Z'),
      user: { id: 'u1', name: 'Ann' },
      attachments: [{ id: 'a1' }],
    });
    // The input is left as it was.
    expect(row.fileHash).toBe('deadbeef');
  });

  it('keeps account details unless asked to drop them too', () => {
    const user = { id: 'u1', googleId: 'g', telegramChatId: 't', lastLogin: '2026-10-01' };
    expect(withoutKeys(user, SERVER_ONLY_KEYS)).toEqual(user);
    expect(withoutKeys(user, ACCOUNT_KEYS)).toEqual({ id: 'u1' });
  });

  it('passes files, buffers and self-serializing values through', () => {
    const file = new StreamableFile(Buffer.from('x'));
    const money = { amount: 1, toJSON: () => '1.00' };
    expect(withoutKeys(file, SERVER_ONLY_KEYS)).toBe(file);
    expect(withoutKeys(money, SERVER_ONLY_KEYS)).toBe(money);
    expect(withoutKeys('text', SERVER_ONLY_KEYS)).toBe('text');
  });

  it('passes the response a @Res() handler returns through, cycles and all', () => {
    const response = new ServerResponse(new IncomingMessage(new Socket()));
    expect(withoutKeys(response, SERVER_ONLY_KEYS)).toBe(response);
    const stream = Readable.from(['x']);
    expect(withoutKeys({ stream }, SERVER_ONLY_KEYS)).toEqual({ stream });
  });
});
