'use client';

import { Box, Typography } from '@mui/material';
import { type ChangeEvent, type KeyboardEvent, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/hooks/useAuth';
import {
  type Note,
  type NoteEntityType,
  useNotes,
  useWorkspaceMembers,
} from '@/app/hooks/useNotes';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { formatStoredDateTime } from '@/app/lib/user-format-store';
import {
  applyMention,
  collectMentionedIds,
  filterCandidates,
  findActiveMention,
  type MentionCandidate,
  splitByMentions,
} from './mentions.utils';

/** Тот же предел, что и в CreateNoteDto: обрезаем в поле, а не ошибкой с сервера. */
const MAX_BODY_LENGTH = 4000;

interface NotesPanelProps {
  entityType: NoteEntityType;
  entityId: string;
  /** Off where a tab already says "Notes" above the panel. */
  showTitle?: boolean;
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

interface SuggestionKeyHandlers {
  suggestions: MentionCandidate[];
  highlighted: number;
  onHighlight: (index: number) => void;
  onPick: (candidate: MentionCandidate) => void;
  onDismiss: () => void;
}

/** Пока открыт список подсказок, стрелки и Enter принадлежат ему. true — событие поглощено. */
function handleSuggestionKey(key: string, handlers: SuggestionKeyHandlers): boolean {
  const { suggestions, highlighted, onHighlight, onPick, onDismiss } = handlers;
  if (!suggestions.length) {
    return false;
  }
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    const step = key === 'ArrowDown' ? 1 : suggestions.length - 1;
    onHighlight((highlighted + step) % suggestions.length);
    return true;
  }
  if (key === 'Enter' || key === 'Tab') {
    const candidate = suggestions[highlighted];
    if (candidate) {
      onPick(candidate);
    }
    return true;
  }
  if (key === 'Escape') {
    onDismiss();
    return true;
  }
  return false;
}

/** Общее обсуждение выписки или чека: заметки, @упоминания и отметка «решено». */
export function NotesPanel({ entityType, entityId, showTitle = true }: NotesPanelProps) {
  const t = useIntlayer('notes');
  const { user } = useAuth();
  const members = useWorkspaceMembers();
  // Alone in the workspace there is no team to write for and nobody to mention.
  const solo = members.length <= 1;
  const placeholder = solo ? t.placeholderSolo.value : t.placeholder.value;
  const { notes, isPending, addNote, isAdding, setResolved, deleteNote } = useNotes({
    entityType,
    entityId,
  });

  const [draft, setDraft] = useState('');
  const [caret, setCaret] = useState(0);
  const [highlighted, setHighlighted] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const candidates: MentionCandidate[] = useMemo(
    () => members.filter(member => member.id !== user?.id),
    [members, user?.id],
  );
  const memberNames = useMemo(() => members.map(member => member.name), [members]);

  const activeMention = findActiveMention(draft, caret);
  const suggestions = activeMention ? filterCandidates(candidates, activeMention.query) : [];

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    setDraft(event.target.value);
    setCaret(event.target.selectionStart ?? event.target.value.length);
    setHighlighted(0);
  };

  const pickSuggestion = (candidate: MentionCandidate): void => {
    if (!activeMention) {
      return;
    }
    const next = applyMention(draft, activeMention, candidate.name);
    setDraft(next.text);
    setCaret(next.caret);
    setHighlighted(0);
    // Каретка ставится после перерисовки, иначе браузер вернёт её в конец текста.
    requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (element) {
        element.focus();
        element.setSelectionRange(next.caret, next.caret);
      }
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    const consumed = handleSuggestionKey(event.key, {
      suggestions,
      highlighted,
      onHighlight: setHighlighted,
      onPick: pickSuggestion,
      // Escape закрывает подсказки: caret здесь — только позиция для разбора
      // упоминания, реальную каретку в textarea это не двигает.
      onDismiss: () => setCaret(0),
    });
    if (consumed) {
      event.preventDefault();
      return;
    }

    // Enter переносит строку, отправка — Ctrl/Cmd+Enter: заметки бывают многострочными.
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  const submit = async (): Promise<void> => {
    const body = draft.trim();
    if (!body || isAdding) {
      return;
    }
    try {
      await addNote({ body, mentionedUserIds: collectMentionedIds(body, candidates) });
      setDraft('');
      setCaret(0);
    } catch (error) {
      // Причина бывает содержательной («упомянутого нет в воркспейсе») —
      // общая заглушка её бы съела.
      toast.error(getApiErrorMessage(error, t.addFailed.value));
    }
  };

  const runAction = async (action: Promise<unknown>): Promise<void> => {
    try {
      await action;
    } catch (error) {
      toast.error(getApiErrorMessage(error, t.actionFailed.value));
    }
  };

  const canDelete = (note: Note): boolean => note.author?.id === user?.id || user?.role === 'admin';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {showTitle && (
        <Typography
          component="h3"
          sx={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', m: 0 }}
        >
          {t.title.value}
          {notes.length > 0 && (
            <Box component="span" sx={{ ml: 1, color: 'var(--muted-foreground)', fontWeight: 400 }}>
              {notes.length}
            </Box>
          )}
        </Typography>
      )}

      <Box sx={{ position: 'relative' }}>
        <Box
          component="textarea"
          ref={textareaRef}
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={(event: React.SyntheticEvent<HTMLTextAreaElement>) =>
            setCaret(event.currentTarget.selectionStart ?? 0)
          }
          rows={3}
          maxLength={MAX_BODY_LENGTH}
          placeholder={placeholder}
          aria-label={placeholder}
          sx={{
            width: '100%',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--card-bg)',
            color: 'var(--foreground)',
            p: 1.5,
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'none',
            '&:focus': { outline: 'none', borderColor: 'var(--primary)' },
          }}
        />

        {suggestions.length > 0 && (
          <Box
            role="listbox"
            sx={{
              position: 'absolute',
              zIndex: 20,
              left: 8,
              right: 8,
              top: '100%',
              mt: 0.5,
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--card-bg)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
            }}
          >
            {suggestions.map((candidate, index) => (
              <Box
                key={candidate.id}
                role="option"
                aria-selected={index === highlighted}
                onMouseDown={(event: React.MouseEvent) => {
                  // mousedown, а не click: иначе textarea теряет фокус раньше выбора.
                  event.preventDefault();
                  pickSuggestion(candidate);
                }}
                sx={{
                  px: 1.5,
                  py: 1,
                  fontSize: 14,
                  cursor: 'pointer',
                  color: 'var(--foreground)',
                  background: index === highlighted ? 'var(--muted)' : 'transparent',
                  '&:hover': { background: 'var(--muted)' },
                }}
              >
                {candidate.name}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* A text button that turns sage once there is something to send. */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1 }}>
        <Box
          component="button"
          type="button"
          onClick={() => void submit()}
          disabled={isAdding || !draft.trim()}
          sx={{
            border: 'none',
            background: 'none',
            p: 0,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            color: 'var(--primary)',
            '&:disabled': { color: 'var(--text-muted)', cursor: 'default' },
          }}
        >
          {t.submit.value}
        </Box>
      </Box>
      <Typography sx={{ fontSize: 13, color: 'var(--text-muted)', mt: -1 }}>
        {solo ? t.sendHint.value : t.mentionHint.value}
      </Typography>

      {isPending && (
        <Typography sx={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
          {t.loading.value}
        </Typography>
      )}

      {notes.map(note => (
        <Box
          key={note.id}
          sx={{
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--card-bg)',
            p: 1.5,
            // Решённые уходят на второй план, но остаются видимыми.
            opacity: note.resolvedAt ? 0.6 : 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box
              aria-hidden
              sx={{
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-full)',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {initialOf(note.author?.name ?? '')}
            </Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {note.author?.name ?? t.unknownAuthor.value}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'var(--muted-foreground)', ml: 'auto' }}>
              {formatStoredDateTime(note.createdAt)}
            </Typography>
          </Box>

          <Box sx={{ fontSize: 14, color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>
            {splitByMentions(note.body, memberNames).map((segment, index) => (
              <Box
                component="span"
                // Сегменты — производная от текста и не переупорядочиваются.
                key={`${note.id}-${index}`}
                sx={segment.isMention ? { color: 'var(--primary)', fontWeight: 600 } : undefined}
              >
                {segment.text}
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Box
              component="button"
              type="button"
              onClick={() =>
                void runAction(setResolved({ id: note.id, resolved: !note.resolvedAt }))
              }
              sx={{
                border: 'none',
                background: 'none',
                p: 0,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--primary)',
              }}
            >
              {note.resolvedAt ? t.reopen.value : t.markResolved.value}
            </Box>
            {canDelete(note) && (
              <Box
                component="button"
                type="button"
                onClick={() => void runAction(deleteNote(note.id))}
                sx={{
                  border: 'none',
                  background: 'none',
                  p: 0,
                  fontSize: 12,
                  cursor: 'pointer',
                  color: 'var(--muted-foreground)',
                }}
              >
                {t.delete.value}
              </Box>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
