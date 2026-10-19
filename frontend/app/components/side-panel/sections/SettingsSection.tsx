'use client';

import { Select } from '@/app/components/ui/select';
import { tokens } from '@/lib/theme-tokens';
import type { SettingsSection, SettingsSelectItem, SettingsToggleItem } from '../types';
import { RenderIcon } from './components/RenderIcon';
import { SectionWrapper } from './components/SectionWrapper';

function isToggleItem(item: SettingsToggleItem | SettingsSelectItem): item is SettingsToggleItem {
  return 'checked' in item;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-lines-per-function, complexity
function SettingsToggleComponent({ item }: { item: SettingsToggleItem }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        {item.icon && <RenderIcon icon={item.icon} size={16} />}
        <div style={{ minWidth: 0 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--foreground)',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </span>
          {item.description && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--muted-foreground)',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.description}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={item.checked}
        onClick={() => !item.disabled && item.onChange(!item.checked)}
        disabled={item.disabled}
        style={{
          position: 'relative',
          display: 'inline-flex',
          width: 36,
          height: 20,
          borderRadius: tokens.radius.full,
          flexShrink: 0,
          cursor: item.disabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 200ms',
          border: 'none',
          backgroundColor: item.checked ? 'var(--primary)' : 'var(--border-color)',
          opacity: item.disabled ? 0.5 : 1,
          padding: 0,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 16,
            height: 16,
            borderRadius: tokens.radius.full,
            backgroundColor: 'var(--card-bg)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'transform 200ms',
            transform: `translate(${item.checked ? '18px' : '2px'}, 2px)`,
          }}
        />
      </button>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-lines-per-function
function SettingsSelectComponent({ item }: { item: SettingsSelectItem }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {item.icon && <RenderIcon icon={item.icon} size={16} />}
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
          {item.label}
        </span>
      </div>
      {item.description && (
        <p
          style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8, marginTop: 0 }}
        >
          {item.description}
        </p>
      )}
      <Select
        fullWidth
        value={item.value}
        onChange={item.onChange}
        disabled={item.disabled}
        options={item.options}
        sx={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
export function SettingsSectionRenderer({ section }: { section: SettingsSection }) {
  return (
    <SectionWrapper section={section}>
      <div>
        {section.items.map(item =>
          isToggleItem(item) ? (
            <SettingsToggleComponent key={item.id} item={item} />
          ) : (
            <SettingsSelectComponent key={item.id} item={item} />
          ),
        )}
      </div>
    </SectionWrapper>
  );
}
