'use client';

import MuiTooltip from '@mui/material/Tooltip';
import { HelpCircle } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';

/**
 * A "?" beside the Teach button: what teaching does, and where to teach the
 * statement again later (the preview's ⋮ menu), which is not obvious.
 */
export function TeachHelp(): React.JSX.Element {
  const t = useIntlayer('pdfTeach');
  return (
    <MuiTooltip
      title={
        <span className="seneca-pdf-teach__help-text">
          <span>{t.teachExplain}</span>
          <span>{t.teachAgainWhere}</span>
        </span>
      }
      placement="top"
      enterTouchDelay={0}
      leaveTouchDelay={6000}
    >
      <button
        type="button"
        className="seneca-pdf-teach__help"
        aria-label={t.helpLabel.value}
        data-testid="teach-help"
        // Keeps the row from opening the statement.
        onClick={event => event.stopPropagation()}
      >
        <HelpCircle size={14} aria-hidden />
      </button>
    </MuiTooltip>
  );
}
