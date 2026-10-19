'use client';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { ChevronDown, ChevronRight } from '@/app/components/icons';
import { sortedByPosition } from './balance-sheet-utils';

export type BalanceAccountNode = {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  nameKk: string | null;
  accountType: 'asset' | 'liability' | 'equity';
  isEditable: boolean;
  isAutoComputed: boolean;
  isExpandable: boolean;
  amount: number;
  children: BalanceAccountNode[];
  position: number;
};

export type EditableChangeArgs = { id: string; value: string };

type EditableAmountProps = {
  accountId: string;
  accountName: string;
  value: string;
  isSaving: boolean;
  onChange: (args: EditableChangeArgs) => void;
  onBlur: (id: string) => void;
};
const inputStyle: React.CSSProperties = {
  width: 112,
  border: '1px solid var(--border)',
  background: 'var(--muted)',
  padding: '4px 8px',
  textAlign: 'right',
  fontSize: 14,
  color: 'var(--foreground)',
};
export function EditableAmount({
  accountId,
  accountName,
  value,
  isSaving,
  onChange,
  onBlur,
}: EditableAmountProps): React.ReactElement {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void =>
    onChange({ id: accountId, value: e.target.value });
  const handleBlur = (): void => onBlur(accountId);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <input
        type="number"
        step="0.01"
        style={inputStyle}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        aria-label={accountName}
      />
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted-foreground)' }}>₸</span>
      {isSaving && <CircularProgress size={16} sx={{ color: 'var(--primary)' }} />}
    </Box>
  );
}

export type AccountRowProps = {
  account: BalanceAccountNode;
  level: number;
  expanded: Record<string, boolean>;
  editableValues: Record<string, string>;
  savingAccountId: string | null;
  formatCurrency: (value: number) => string;
  onToggleExpanded: (id: string) => void;
  onEditableChange: (args: EditableChangeArgs) => void;
  onBlur: (id: string) => void;
};
const toggleBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--muted-foreground)',
  flexShrink: 0,
};

type RowLabelProps = {
  account: BalanceAccountNode;
  level: number;
  isSection: boolean;
  isExpanded: boolean;
  canToggle: boolean;
  onToggleExpanded: (id: string) => void;
};
function RowLabel({
  account,
  level,
  isSection,
  isExpanded,
  canToggle,
  onToggleExpanded,
}: RowLabelProps): React.ReactElement {
  return (
    <Box
      sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 1 }}
      style={{ paddingLeft: `${level * 18}px` }}
    >
      {canToggle ? (
        <button type="button" style={toggleBtnStyle} onClick={() => onToggleExpanded(account.id)}>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ) : (
        <span style={{ width: 20, height: 20, flexShrink: 0, display: 'inline-block' }} />
      )}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: isSection ? 16 : 14,
          fontWeight: isSection ? 600 : 400,
          color: 'var(--foreground)',
        }}
      >
        {account.name}
      </span>
    </Box>
  );
}

type RowAmountProps = {
  account: BalanceAccountNode;
  isSection: boolean;
  editableValues: Record<string, string>;
  savingAccountId: string | null;
  formatCurrency: (v: number) => string;
  onEditableChange: (args: EditableChangeArgs) => void;
  onBlur: (id: string) => void;
};
function RowAmount({
  account,
  isSection,
  editableValues,
  savingAccountId,
  formatCurrency,
  onEditableChange,
  onBlur,
}: RowAmountProps): React.ReactElement {
  if (account.isEditable) {
    return (
      <EditableAmount
        accountId={account.id}
        accountName={account.name}
        value={editableValues[account.id] ?? '0.00'}
        isSaving={savingAccountId === account.id}
        onChange={onEditableChange}
        onBlur={onBlur}
      />
    );
  }
  return (
    <span style={{ fontSize: 14, fontWeight: isSection ? 600 : 500, color: 'var(--foreground)' }}>
      {formatCurrency(account.amount)}
    </span>
  );
}

export function AccountRow({
  account,
  level,
  expanded,
  editableValues,
  savingAccountId,
  formatCurrency,
  onToggleExpanded,
  onEditableChange,
  onBlur,
}: AccountRowProps): React.ReactElement {
  const hasChildren = account.children.length > 0;
  const isExpanded = expanded[account.id] ?? true;
  const canToggle = account.isExpandable || hasChildren;
  const isSection = level === 0;
  return (
    <Box sx={{ borderBottom: '1px solid var(--border)', '&:last-child': { borderBottom: 'none' } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          py: 1.5,
        }}
      >
        <RowLabel
          account={account}
          level={level}
          isSection={isSection}
          isExpanded={isExpanded}
          canToggle={canToggle}
          onToggleExpanded={onToggleExpanded}
        />
        <Box sx={{ flexShrink: 0 }}>
          <RowAmount
            account={account}
            isSection={isSection}
            editableValues={editableValues}
            savingAccountId={savingAccountId}
            formatCurrency={formatCurrency}
            onEditableChange={onEditableChange}
            onBlur={onBlur}
          />
        </Box>
      </Box>
      {hasChildren && isExpanded && (
        <Box>
          {sortedByPosition(account.children).map(child => (
            <AccountRow
              key={child.id}
              account={child}
              level={level + 1}
              expanded={expanded}
              editableValues={editableValues}
              savingAccountId={savingAccountId}
              formatCurrency={formatCurrency}
              onToggleExpanded={onToggleExpanded}
              onEditableChange={onEditableChange}
              onBlur={onBlur}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
