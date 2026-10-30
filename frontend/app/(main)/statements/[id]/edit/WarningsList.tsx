import { useState } from 'react';

interface EditableWarningEntry {
  key: string;
  reason: string;
  txKey: string | null;
  action: 'convert' | 'resolve';
}

interface WarningsListProps {
  warnings: string[];
  editableEntryByReason: Map<string, EditableWarningEntry>;
  editableEntryByTxKey: Map<string, EditableWarningEntry>;
  fixTooltipLabel: string;
  resolveBalanceTooltipLabel: string;
  showAllLabel: string;
  showLessLabel: string;
  extractTxKey: (value: string) => string | null;
  onSelectWarning: (args: { entryKey: string; warning: string; warningIndex: number }) => void;
  onResolve: (args: { warning: string; warningIndex: number }) => void;
}

/** Twenty identical lines say less than five and a way to see the rest. */
const FOLDED_COUNT = 5;

const resolveMatchedEntry = ({
  warning,
  editableEntryByReason,
  editableEntryByTxKey,
  extractTxKey,
}: {
  warning: string;
  editableEntryByReason: Map<string, EditableWarningEntry>;
  editableEntryByTxKey: Map<string, EditableWarningEntry>;
  extractTxKey: (v: string) => string | null;
}): EditableWarningEntry | undefined => {
  const txKey = extractTxKey(warning);
  return (
    editableEntryByReason.get(warning) ?? (txKey ? editableEntryByTxKey.get(txKey) : undefined)
  );
};

/**
 * "tx#7: skipped (no debit/credit amount)" → "#7" and "Skipped (no debit/credit
 * amount)": the row number goes in its own quiet column, so the reasons line up.
 */
export const splitWarning = (warning: string): { row: string | null; message: string } => {
  const match = warning.match(/^\s*tx#(\d+)\s*:?\s*/i);
  const message = match ? warning.slice(match[0].length) : warning;
  return {
    row: match ? `#${match[1]}` : null,
    message: message.charAt(0).toUpperCase() + message.slice(1),
  };
};

type WarningItemProps = Omit<WarningsListProps, 'warnings' | 'showAllLabel' | 'showLessLabel'> & {
  warning: string;
  warningIndex: number;
};

function WarningItem({
  warning,
  warningIndex,
  editableEntryByReason,
  editableEntryByTxKey,
  fixTooltipLabel,
  resolveBalanceTooltipLabel,
  extractTxKey,
  onSelectWarning,
  onResolve,
}: WarningItemProps): React.ReactElement {
  const matchedEntry = resolveMatchedEntry({
    warning,
    editableEntryByReason,
    editableEntryByTxKey,
    extractTxKey,
  });
  const { row, message } = splitWarning(warning);
  const content = (
    <>
      <span className="seneca-parse-warnings__row">{row}</span>
      <span className="seneca-parse-warnings__message">{message}</span>
    </>
  );
  if (!matchedEntry) {
    return <li className="seneca-parse-warnings__item">{content}</li>;
  }
  return (
    <li>
      <button
        type="button"
        className="seneca-parse-warnings__item seneca-parse-warnings__item--action"
        onClick={() => {
          if (matchedEntry.action === 'resolve') {
            onResolve({ warning, warningIndex });
            return;
          }
          onSelectWarning({ entryKey: matchedEntry.key, warning, warningIndex });
        }}
      >
        {content}
        <span className="seneca-parse-warnings__fix">
          {matchedEntry.action === 'resolve' ? resolveBalanceTooltipLabel : fixTooltipLabel}
        </span>
      </button>
    </li>
  );
}

export function WarningsList({
  warnings,
  showAllLabel,
  showLessLabel,
  ...itemProps
}: WarningsListProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  if (warnings.length === 0) {
    return null;
  }
  const folds = warnings.length > FOLDED_COUNT + 1;
  const shown = folds && !expanded ? warnings.slice(0, FOLDED_COUNT) : warnings;
  return (
    <>
      <ul className="seneca-parse-warnings__list">
        {shown.map((warning, index) => (
          <WarningItem
            key={`${index}-${warning}`}
            warning={warning}
            warningIndex={index}
            {...itemProps}
          />
        ))}
      </ul>
      {folds ? (
        <button
          type="button"
          className="seneca-parse-warnings__more"
          aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}
        >
          {expanded ? showLessLabel : showAllLabel.replace('{{count}}', String(warnings.length))}
        </button>
      ) : null}
    </>
  );
}
