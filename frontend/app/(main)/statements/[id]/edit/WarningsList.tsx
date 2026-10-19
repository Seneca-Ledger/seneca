import { Box, Button, List, ListItem, ListItemIcon, ListItemText, Typography } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import { TriangleAlert } from '@/app/components/icons';

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
  extractTxKey: (value: string) => string | null;
  onSelectWarning: (args: { entryKey: string; warning: string; warningIndex: number }) => void;
  onResolve: (args: { warning: string; warningIndex: number }) => void;
}

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

const ACTION_TOOLTIP: Record<
  'resolve' | 'convert',
  'resolveBalanceTooltipLabel' | 'fixTooltipLabel'
> = {
  resolve: 'resolveBalanceTooltipLabel',
  convert: 'fixTooltipLabel',
};

const BUTTON_SX = {
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  gap: 1,
  px: 1,
  py: 1,
  mx: -1,
  minWidth: 0,
  width: 'calc(100% + 16px)',
  color: 'warning.dark',
  textTransform: 'none',
  cursor: 'pointer',
  transition: 'background-color 150ms ease',
  '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.08)' },
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '1px' },
} as const;

type WarningItemProps = {
  warning: string;
  warningIndex: number;
  editableEntryByReason: Map<string, EditableWarningEntry>;
  editableEntryByTxKey: Map<string, EditableWarningEntry>;
  fixTooltipLabel: string;
  resolveBalanceTooltipLabel: string;
  extractTxKey: (v: string) => string | null;
  onSelectWarning: (args: { entryKey: string; warning: string; warningIndex: number }) => void;
  onResolve: (args: { warning: string; warningIndex: number }) => void;
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
  const tooltipTitle = matchedEntry
    ? ACTION_TOOLTIP[matchedEntry.action] === 'resolveBalanceTooltipLabel'
      ? resolveBalanceTooltipLabel
      : fixTooltipLabel
    : '';
  return (
    <ListItem key={`${warningIndex}-${warning}`} disableGutters alignItems="flex-start">
      {matchedEntry ? (
        <Tooltip title={tooltipTitle} placement="top" enterDelay={150}>
          <Button
            variant="text"
            onClick={() => {
              if (matchedEntry.action === 'resolve') {
                onResolve({ warning, warningIndex });
                return;
              }
              onSelectWarning({ entryKey: matchedEntry.key, warning, warningIndex });
            }}
            sx={BUTTON_SX}
          >
            <TriangleAlert size={16} style={{ color: '#ed6c02', marginTop: 2, flexShrink: 0 }} />
            <Typography variant="body2">{warning}</Typography>
          </Button>
        </Tooltip>
      ) : (
        <>
          <ListItemIcon sx={{ minWidth: 28, mt: 0.25 }}>
            <TriangleAlert size={16} style={{ color: '#ed6c02' }} />
          </ListItemIcon>
          <ListItemText primary={warning} primaryTypographyProps={{ variant: 'body2' }} />
        </>
      )}
    </ListItem>
  );
}

export function WarningsList({
  warnings,
  editableEntryByReason,
  editableEntryByTxKey,
  fixTooltipLabel,
  resolveBalanceTooltipLabel,
  extractTxKey,
  onSelectWarning,
  onResolve,
}: WarningsListProps): React.ReactElement | null {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <Box sx={{ bgcolor: 'warning.50', px: 1.5, py: 0.5 }}>
      <List dense disablePadding>
        {[...warnings.entries()].map(([index, warning]) => (
          <WarningItem
            key={`${index}-${warning}`}
            warning={warning}
            warningIndex={index}
            editableEntryByReason={editableEntryByReason}
            editableEntryByTxKey={editableEntryByTxKey}
            fixTooltipLabel={fixTooltipLabel}
            resolveBalanceTooltipLabel={resolveBalanceTooltipLabel}
            extractTxKey={extractTxKey}
            onSelectWarning={onSelectWarning}
            onResolve={onResolve}
          />
        ))}
      </List>
    </Box>
  );
}
