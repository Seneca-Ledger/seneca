import { describe, expect, it } from 'vitest';
import type { NotificationItem } from '@/app/lib/contracts';
import { mergePushedNotification } from './NotificationContext';

const item = (id: string, isRead: boolean, message = 'm') =>
  ({ id, isRead, message }) as unknown as NotificationItem;

describe('mergePushedNotification', () => {
  it('puts a new notification on top and counts it unread', () => {
    const next = mergePushedNotification({ items: [item('a', true)], unreadCount: 0 }, item('b', false));
    expect(next.items.map(entry => entry.id)).toEqual(['b', 'a']);
    expect(next.unreadCount).toBe(1);
  });

  it('replaces one the server updated in place, without counting it twice', () => {
    const previous = { items: [item('a', true), item('sub', false, 'Dropbox')], unreadCount: 1 };
    const next = mergePushedNotification(previous, item('sub', false, 'Dropbox and Adobe'));

    expect(next.items.map(entry => entry.id)).toEqual(['sub', 'a']);
    expect((next.items[0] as unknown as { message: string }).message).toBe('Dropbox and Adobe');
    expect(next.unreadCount).toBe(1);
  });

  it('counts a read notification that came back unread', () => {
    const next = mergePushedNotification({ items: [item('sub', true)], unreadCount: 0 }, item('sub', false));
    expect(next.unreadCount).toBe(1);
  });
});
