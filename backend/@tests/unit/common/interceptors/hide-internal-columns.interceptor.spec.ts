import { StreamableFile } from '@nestjs/common';
import { hideInternalColumns } from '@/common/interceptors/hide-internal-columns.interceptor';
import { User } from '@/entities/user.entity';

describe('hideInternalColumns', () => {
  const owner = Object.assign(new User(), {
    id: 'u-1',
    email: 'owner@example.com',
    name: 'Owner',
    avatarUrl: null,
    googleId: 'google-1',
    telegramChatId: 'chat-1',
    tokenVersion: 3,
    lastLogin: new Date('2026-10-01T00:00:00.000Z'),
  });

  it('drops server paths and file hashes at any depth, and reduces users to the person', () => {
    const answer = {
      data: [
        {
          id: 's-1',
          fileName: 'bank.pdf',
          filePath: '/app/uploads/abc.pdf',
          fileHash: 'deadbeef',
          createdAt: new Date('2026-10-02T00:00:00.000Z'),
          user: owner,
          transactions: [{ id: 't-1', statement: { filePath: '/app/uploads/abc.pdf' } }],
        },
      ],
      total: 1,
    };

    expect(hideInternalColumns(answer)).toEqual({
      data: [
        {
          id: 's-1',
          fileName: 'bank.pdf',
          createdAt: new Date('2026-10-02T00:00:00.000Z'),
          user: { id: 'u-1', email: 'owner@example.com', name: 'Owner', avatarUrl: null },
          transactions: [{ id: 't-1', statement: {} }],
        },
      ],
      total: 1,
    });
  });

  it('leaves files, buffers and plain values alone', () => {
    const file = new StreamableFile(Buffer.from('x'));
    const buffer = Buffer.from('y');

    expect(hideInternalColumns(file)).toBe(file);
    expect(hideInternalColumns(buffer)).toBe(buffer);
    expect(hideInternalColumns(null)).toBeNull();
    expect(hideInternalColumns('text')).toBe('text');
  });
});
