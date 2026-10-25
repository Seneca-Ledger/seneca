'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Select } from '@/app/components/ui/select';
import { useLocale } from '@/app/i18n';
import { localizeStatementCategoryName } from '@/app/lib/statement-categories';
import {
  type CategoryJudgment,
  STOIC_CLASSES,
  type StoicCategory,
  type StoicClass,
} from '../hooks/useStoicBalance';
import { useClassText } from '../hooks/useStoicClassText';

function CategoryRow({
  category,
  busy,
  onJudge,
}: {
  category: StoicCategory;
  busy: boolean;
  onJudge: (changes: Omit<CategoryJudgment, 'categoryId'>) => void;
}): React.JSX.Element {
  const { t, names } = useClassText();
  const { locale } = useLocale();
  const name = localizeStatementCategoryName(category.name, locale);
  const options = [
    ...(category.stoicClass === null ? [{ value: '', label: t.chooseClass.value }] : []),
    ...STOIC_CLASSES.map(stoicClass => ({ value: stoicClass, label: names[stoicClass] })),
  ];

  return (
    <Box
      data-attention={`category:${category.id}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        py: 0.75,
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>
          {name}
        </Typography>
        {/* A quiet note, gone once the user picks a class themselves. */}
        {category.source === 'suggested' && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {t.suggested.value}
          </Typography>
        )}
      </Box>
      {/* Only virtue can be help given to others; the Stoic advice reads this
          flag to notice earning well while giving little. */}
      {category.stoicClass === 'virtue' && (
        <Tooltip title={t.helpsOthersHint.value}>
          <FormControlLabel
            sx={{ ml: 'auto', mr: 0 }}
            control={
              <Switch
                size="small"
                checked={category.helpsOthers}
                disabled={busy}
                onChange={event => onJudge({ helpsOthers: event.target.checked })}
                slotProps={{
                  input: { 'aria-label': `${t.helpsOthers.value}: ${name}` },
                }}
              />
            }
            label={<Typography variant="caption">{t.helpsOthers.value}</Typography>}
          />
        </Tooltip>
      )}
      <Select
        size="small"
        value={category.stoicClass ?? ''}
        options={options}
        disabled={busy}
        inputProps={{ 'aria-label': `${t.classLabel.value}: ${name}` }}
        onChange={value => {
          if (value) {
            onJudge({ stoicClass: value as StoicClass });
          }
        }}
        sx={{ minWidth: 180 }}
      />
    </Box>
  );
}

/**
 * Where the user judges each expense category. Undecided ones come first —
 * they are what the Stoic advice asks about — then the rest by spending.
 * Categories with nothing spent in the window stay folded away.
 */
export function StoicClassifyList({
  categories,
  classifying,
  onJudge,
}: {
  categories: StoicCategory[];
  classifying: string | null;
  onJudge: (judgment: CategoryJudgment) => void;
}): React.JSX.Element {
  const { t } = useClassText();
  const [showInactive, setShowInactive] = useState(false);

  const visible = categories
    .filter(category => showInactive || category.active)
    .sort(
      (a, b) =>
        Number(a.stoicClass !== null) - Number(b.stoicClass !== null) ||
        b.spent - a.spent ||
        a.name.localeCompare(b.name),
    );
  const hiddenCount = categories.filter(category => !category.active).length;

  return (
    // Kept narrow so each class picker sits near its category name, not across the card.
    <Box data-attention="stoic:unclassified" sx={{ maxWidth: 720 }}>
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
        }}
      >
        {t.classifyTitle.value}
      </Typography>
      <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mb: 1 }}>
        {t.classifyHint.value}
      </Typography>
      {visible.map(category => (
        <CategoryRow
          key={category.id}
          category={category}
          busy={classifying === category.id}
          onJudge={changes => onJudge({ categoryId: category.id, ...changes })}
        />
      ))}
      {hiddenCount > 0 && (
        <Button
          size="small"
          onClick={() => setShowInactive(value => !value)}
          sx={{
            mt: 1,
            p: 0,
            minWidth: 0,
            fontWeight: 400,
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          {showInactive ? t.hideInactive.value : `${t.showInactive.value} (${hiddenCount})`}
        </Button>
      )}
    </Box>
  );
}
