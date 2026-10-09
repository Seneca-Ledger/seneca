'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useIntlayer } from '@/app/i18n';
import { PaletteRowView } from './PaletteRowView';
import type { PaletteRow, PaletteSection, SectionGroup } from './use-palette-sections';

function SectionHeading({ group }: { group: SectionGroup }): React.JSX.Element {
  const t = useIntlayer('commandPalette');
  const titles: Record<SectionGroup, React.ReactNode> = {
    actions: t.groupActions,
    navigation: t.groupNavigation,
    settings: t.groupSettings,
    help: t.groupHelp,
    results: t.groupResults,
    recent: t.groupRecent,
  };
  return (
    <Typography
      component="div"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        bgcolor: 'background.paper',
        px: 2.5,
        py: 0.75,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'text.secondary',
      }}
    >
      {titles[group]}
    </Typography>
  );
}

export function PaletteList({
  sections,
  rows,
  activeIndex,
  onHover,
  onSelect,
}: {
  sections: PaletteSection[];
  rows: PaletteRow[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (row: PaletteRow) => void;
}): React.JSX.Element {
  return (
    <Box
      id="command-palette-list"
      role="listbox"
      sx={{ maxHeight: '55vh', overflowY: 'auto', pb: 1 }}
    >
      {sections.map(section => (
        <Box key={section.group}>
          <SectionHeading group={section.group} />
          {section.rows.map(row => {
            const index = rows.indexOf(row);
            return (
              <PaletteRowView
                key={row.id}
                row={row}
                active={index === activeIndex}
                onHover={() => onHover(index)}
                onSelect={() => onSelect(row)}
              />
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
