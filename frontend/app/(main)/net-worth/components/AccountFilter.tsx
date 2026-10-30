'use client';

import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';
import { SlidersHorizontal } from '@/app/components/icons';
import type { NetWorthAssetLine } from '../hooks/useNetWorth';

interface AccountFilterProps {
  /** Null while the page loads: the button holds its place, disabled. */
  lines: NetWorthAssetLine[] | null;
  excluded: string[];
  onChange: (ids: string[]) => void;
  labels: { accounts: string; showAll: string };
}

/**
 * Which lines the page counts.
 *
 * A flat or a pension locked away for twenty years is most of the number and
 * none of the movement; taking it off is the difference between a chart that
 * answers "how am I doing this month" and one that only says "I own a house".
 */
export function AccountFilter({
  lines,
  excluded,
  onChange,
  labels,
}: AccountFilterProps): React.JSX.Element | null {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (lines?.length === 0) {
    return null;
  }

  const toggle = (id: string): void =>
    onChange(excluded.includes(id) ? excluded.filter(other => other !== id) : [...excluded, id]);

  return (
    <>
      <Badge badgeContent={excluded.length} color="primary">
        <Button
          size="small"
          variant="outlined"
          startIcon={<SlidersHorizontal size={16} />}
          sx={{ textTransform: 'none' }}
          disabled={lines === null}
          onClick={event => setAnchor(event.currentTarget)}
        >
          {labels.accounts}
        </Button>
      </Badge>

      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {(lines ?? []).map(line => (
          <MenuItem key={line.id} dense onClick={() => toggle(line.id)}>
            <Checkbox
              size="small"
              checked={!excluded.includes(line.id)}
              tabIndex={-1}
              disableRipple
            />
            <ListItemText primary={line.name} />
          </MenuItem>
        ))}
        {excluded.length > 0 && (
          <MenuItem dense onClick={() => onChange([])}>
            <ListItemText primary={labels.showAll} />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
