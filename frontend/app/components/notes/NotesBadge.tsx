'use client';

import { MessageCircle } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { useNoteCount } from './NoteCountsContext';

/** Метка «здесь идёт обсуждение» для строки списка. Нерешённых нет — ничего не рисуем. */
export function NotesBadge({ entityId }: { entityId: string }) {
  const t = useIntlayer('notes');
  const count = useNoteCount(entityId);

  if (!count) {
    return null;
  }

  return (
    <span
      title={`${t.badgeLabel.value}: ${count}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        marginLeft: 6,
        color: 'var(--muted-foreground)',
        fontSize: 12,
        lineHeight: 1,
      }}
    >
      <MessageCircle size={13} />
      {count}
    </span>
  );
}
