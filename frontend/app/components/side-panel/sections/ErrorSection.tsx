'use client';

import { X } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import type { ErrorItem, ErrorSection } from '../types';
import { SectionWrapper } from './components/SectionWrapper';
import { ERROR_BG, ERROR_BORDER, ERROR_ICON_COLOR, ERROR_ICONS } from './helpers/section-constants';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-lines-per-function
function ErrorItemComponent({ item }: { item: ErrorItem }) {
  const IconComponent = ERROR_ICONS[item.severity];

  return (
    <div
      style={{
        padding: 12,
        border: '1px solid',
        borderColor: ERROR_BORDER[item.severity],
        backgroundColor: ERROR_BG[item.severity],
        borderRadius: tokens.radius.lg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <IconComponent
          size={18}
          style={{ flexShrink: 0, marginTop: 2, color: ERROR_ICON_COLOR[item.severity] }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)', margin: 0 }}>
              {item.title}
            </p>
            {item.dismissible && item.onDismiss && (
              <button
                type="button"
                onClick={item.onDismiss}
                style={{
                  color: 'var(--muted-foreground)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <p
            style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}
          >
            {item.message}
          </p>
          {item.action && (
            <button
              type="button"
              onClick={item.action.onClick}
              style={{
                marginTop: 8,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              {item.action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
export function ErrorSectionRenderer({ section }: { section: ErrorSection }) {
  const t = useIntlayer('sidePanel');
  const displayItems = section.maxItems ? section.items.slice(0, section.maxItems) : section.items;

  return (
    <SectionWrapper section={section}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {displayItems.map(item => (
          <ErrorItemComponent key={item.id} item={item} />
        ))}
        {section.maxItems && section.items.length > section.maxItems && (
          <p
            style={{
              fontSize: 12,
              color: 'var(--muted-foreground)',
              textAlign: 'center',
              padding: '4px 0',
              margin: 0,
            }}
          >
            {t.moreCount.value.replace('{count}', String(section.items.length - section.maxItems))}
          </p>
        )}
      </div>
    </SectionWrapper>
  );
}
