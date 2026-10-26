'use client';

import {
  Box,
  Button,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, type SxProps, type Theme } from '@mui/material/styles';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import { useCategoryName } from '@/app/lib/use-category-name';
import { formatLineRef, linesForCategory, suggestionEntries } from '../tax-declaration.helpers';
import type { MappingEntry, MappingStatus, MappingsResponse } from '../tax-declaration.types';

// A status is a detail of the row, not its headline: a small dot and muted text.
const STATUS_DOT: Record<MappingStatus, string> = {
  confirmed: 'success.main',
  suggested: 'warning.main',
  unmapped: 'text.disabled',
};

// Rows are separated by one hairline in the theme's divider colour.
const TABLE_SX = {
  '& .MuiTableCell-root': { borderBottomColor: 'divider' },
} satisfies SxProps<Theme>;

// Flat select: plain text on the row until hovered or focused, so a column of
// fifteen selects does not read as fifteen boxes. The chevron fades in on hover;
// touch screens have no hover, so there it stays visible.
const FLAT_SELECT_SX = {
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'transparent',
    transition: 'border-color 120ms ease',
  },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
  '& .MuiSelect-icon': { color: 'text.secondary', opacity: 0.35, transition: 'opacity 120ms ease' },
  '& .MuiOutlinedInput-root:hover .MuiSelect-icon, & .Mui-focused .MuiSelect-icon': { opacity: 1 },
  '@media (hover: none)': { '& .MuiSelect-icon': { opacity: 1 } },
} satisfies SxProps<Theme>;

interface MappingStepProps {
  mappings: MappingsResponse;
  saving: boolean;
  onSave: (entries: MappingEntry[]) => void;
}

/**
 * Category → form line. A suggestion is shown in the select but stays a
 * suggestion until the user saves it; only confirmed lines reach the draft.
 */
export function MappingStep({ mappings, saving, onSave }: MappingStepProps): React.ReactElement {
  const t = useIntlayer('taxDeclarationPage');
  const categoryName = useCategoryName();
  const suggestions = suggestionEntries(mappings.categories);
  const statusLabel: Record<MappingStatus, React.ReactNode> = {
    confirmed: t.statusConfirmed,
    suggested: t.statusSuggested,
    unmapped: t.statusUnmapped,
  };

  // Categories that actually carry transactions this year come first.
  const categories = [...mappings.categories].sort(
    (a, b) => b.transactionCount - a.transactionCount || a.name.localeCompare(b.name),
  );

  return (
    <Stack spacing={2}>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', maxWidth: 820 }}>
        {t.mappingIntro}
      </Typography>

      <Box>
        <Button
          variant="outlined"
          disabled={suggestions.length === 0 || saving}
          onClick={() => onSave(suggestions)}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {t.acceptSuggestions} ({suggestions.length})
        </Button>
      </Box>

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={TABLE_SX}>
          <TableHead>
            <TableRow>
              <TableCell>{t.mappingCategory}</TableCell>
              <TableCell align="right">{t.transactionsLabel}</TableCell>
              <TableCell>{t.mappingLine}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map(category => (
              <TableRow key={category.categoryId}>
                <TableCell>{categoryName(category.name)}</TableCell>
                <TableCell align="right">{category.transactionCount}</TableCell>
                <TableCell sx={{ minWidth: 300 }}>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    disabled={saving}
                    sx={FLAT_SELECT_SX}
                    value={category.lineKey ?? ''}
                    onChange={event =>
                      onSave([
                        { categoryId: category.categoryId, lineKey: event.target.value || null },
                      ])
                    }
                    slotProps={{
                      htmlInput: {
                        'aria-label': `${t.mappingLine.value}: ${categoryName(category.name)}`,
                      },

                      select: { displayEmpty: true },
                    }}
                  >
                    <MenuItem value="">{t.notAssigned}</MenuItem>
                    {linesForCategory(mappings.lines, category.type).map(line => (
                      <MenuItem key={line.key} value={line.key}>
                        {line.lineNo ? `${formatLineRef(line.lineNo, line.fieldNo)} — ` : ''}
                        {line.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      fontSize: 12,
                      color: theme => alpha(theme.palette.text.primary, 0.7),
                    }}
                  >
                    <Box
                      component="span"
                      aria-hidden
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: STATUS_DOT[category.status],
                      }}
                    />
                    {statusLabel[category.status]}
                  </Box>
                  {category.status === 'suggested' && category.lineKey ? (
                    <Button
                      size="small"
                      disabled={saving}
                      onClick={() =>
                        onSave([{ categoryId: category.categoryId, lineKey: category.lineKey }])
                      }
                      sx={{ ml: 1, textTransform: 'none' }}
                    >
                      {t.save}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Stack>
  );
}
