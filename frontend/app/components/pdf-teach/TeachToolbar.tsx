'use client';

import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useIntlayer, useLocale } from '@/app/i18n';
import { TAG_TONE, TEACH_TAGS, type TeachPreview, type TeachTag } from './teach-utils';
import type { TeachSession } from './useTeachSession';

/** Checks a changed layout breaks; a failed one keeps the statement for review. */
const FORMAT_CHECKS = ['balance_chain', 'printed_totals', 'section_totals'];

/** Keys that take a tag (1–9) or drop the last area, unless the user is typing. */
function useTeachKeys(session: TeachSession) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }
      const tag = TEACH_TAGS[Number(event.key) - 1];
      if (/^[1-9]$/.test(event.key) && tag) {
        session.setActiveTag(tag);
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        session.removeRegion(session.regions.length - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session]);
}

function chainLine(
  preview: TeachPreview,
  text: { chainUnknown: string; chainOk: string; chainBroken: string },
) {
  const chain = preview.checks.find(check => check.code === 'balance_chain');
  if (!chain) {
    return text.chainUnknown;
  }
  return chain.passed ? text.chainOk : text.chainBroken.replace('{row}', String(chain.row ?? '?'));
}

/**
 * The marking toolbar under the pages: the tags (the one in hand drawn next),
 * what is still missing or how the file reads with the marks, and saving.
 */
export function TeachToolbar({ session, onDone }: { session: TeachSession; onDone: () => void }) {
  const t = useIntlayer('pdfTeach');
  const { locale } = useLocale();
  useTeachKeys(session);
  const label = (tag: TeachTag) => t.tags[tag].value;
  const money = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { preview } = session;
  const failed = preview?.checks.some(check => !check.passed && FORMAT_CHECKS.includes(check.code));

  const status = (() => {
    if (!session.words) {
      return t.status.loadingWords.value;
    }
    if (session.missing.length > 0) {
      const groups = session.missing.map(group => group.map(label).join(' / '));
      return t.status.markNext.value.replace('{tags}', groups.join(', '));
    }
    if (session.reading || !preview) {
      return t.status.reading.value;
    }
    return [
      t.status.found.value.replace('{count}', String(preview.transactions)),
      chainLine(preview, {
        chainUnknown: t.status.chainUnknown.value,
        chainOk: t.status.chainOk.value,
        chainBroken: t.status.chainBroken.value,
      }),
      t.status.totals.value
        .replace('{debit}', money(preview.totalDebit))
        .replace('{credit}', money(preview.totalCredit)),
    ].join(' · ');
  })();

  const save = async () => {
    if (await session.save()) {
      toast.success(t.saved.value);
      onDone();
    } else {
      toast.error(t.saveFailed.value);
    }
  };

  return (
    <div className="seneca-pdf-teach__toolbar" data-testid="teach-toolbar">
      <div className="seneca-pdf-teach__tags" role="radiogroup" aria-label={t.tagsLabel.value}>
        {TEACH_TAGS.map((tag, index) => (
          <button
            key={tag}
            type="button"
            role="radio"
            aria-checked={session.activeTag === tag}
            className={`seneca-pdf-teach__tag${session.activeTag === tag ? ' seneca-pdf-teach__tag--active' : ''}`}
            style={{ '--teach-tone': TAG_TONE[tag] } as React.CSSProperties}
            onClick={() => session.setActiveTag(tag)}
          >
            <span className="seneca-pdf-teach__tag-dot" aria-hidden />
            {label(tag)}
            {index < 9 ? <kbd className="seneca-pdf-teach__tag-key">{index + 1}</kbd> : null}
          </button>
        ))}
      </div>
      <div className="seneca-pdf-teach__footer">
        <p className="seneca-pdf-teach__status" aria-live="polite">
          {status}
          {failed ? (
            <span className="seneca-pdf-teach__warning">{t.status.checksFailed}</span>
          ) : null}
        </p>
        <button
          type="button"
          className="seneca-pdf-preview-modal__btn-accent"
          disabled={!preview || preview.transactions === 0 || session.saving || session.reading}
          onClick={save}
        >
          {session.saving ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}
