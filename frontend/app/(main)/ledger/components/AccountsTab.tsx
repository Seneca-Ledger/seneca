'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useState } from 'react';
import { Trash2 } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { NewAccountInput } from '../hooks/useLedger';
import { accountDisplayName, buildAccountTree } from '../ledger.helpers';
import type { AccountType, LedgerAccount, LedgerIntegrity } from '../ledger.types';

const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense'];

interface AccountsTabProps {
  accounts: LedgerAccount[];
  integrity: LedgerIntegrity | undefined;
  systemNames: Record<string, string>;
  canManage: boolean;
  creating: boolean;
  onCreate: (input: NewAccountInput) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onOpenAccount: (id: string) => void;
}

export function AccountsTab(props: AccountsTabProps): React.ReactElement {
  const { accounts, integrity, systemNames, canManage, onOpenAccount } = props;
  const t = useIntlayer('ledgerPage');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typeLabel: Record<AccountType, React.ReactNode> = {
    asset: t.typeAsset,
    liability: t.typeLiability,
    equity: t.typeEquity,
    income: t.typeIncome,
    expense: t.typeExpense,
  };

  const remove = (id: string): void => {
    setError(null);
    props.onDelete(id).catch(err => setError(getApiErrorMessage(err)));
  };

  return (
    <Stack spacing={3}>
      {canManage ? (
        <Box>
          {adding ? (
            <NewAccountForm
              accounts={accounts}
              systemNames={systemNames}
              saving={props.creating}
              typeLabel={typeLabel}
              onCancel={() => setAdding(false)}
              onSave={input =>
                props
                  .onCreate(input)
                  .then(() => setAdding(false))
                  .catch(err => setError(getApiErrorMessage(err)))
              }
            />
          ) : (
            <Button variant="outlined" onClick={() => setAdding(true)}>
              {t.addAccount}
            </Button>
          )}
        </Box>
      ) : null}
      {error ? (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t.colCode}</TableCell>
              <TableCell>{t.colName}</TableCell>
              <TableCell>{t.colType}</TableCell>
              <TableCell>{t.colCurrency}</TableCell>
              {canManage ? <TableCell /> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {buildAccountTree(accounts).map(account => (
              <TableRow key={account.id} hover>
                <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {account.code}
                </TableCell>
                <TableCell sx={{ pl: 2 + account.depth * 2.5 }}>
                  {account.isPostable ? (
                    <Box
                      component="button"
                      type="button"
                      onClick={() => onOpenAccount(account.id)}
                      sx={{
                        all: 'unset',
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {accountDisplayName(account, systemNames)}
                    </Box>
                  ) : (
                    <Typography component="span" fontWeight={600} variant="body2">
                      {accountDisplayName(account, systemNames)}
                    </Typography>
                  )}
                  {account.isPostable ? null : (
                    <Chip size="small" label={t.headerBadge} sx={{ ml: 1 }} />
                  )}
                  {account.isSystem ? (
                    <Chip size="small" variant="outlined" label={t.systemBadge} sx={{ ml: 1 }} />
                  ) : null}
                </TableCell>
                <TableCell>{typeLabel[account.accountType]}</TableCell>
                <TableCell>{account.currency ?? ''}</TableCell>
                {canManage ? (
                  <TableCell align="right">
                    {account.isSystem ? null : (
                      <IconButton
                        size="small"
                        aria-label={t.delete.value}
                        onClick={() => remove(account.id)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {integrity && integrity.cashAccounts.length > 0 ? (
        <Box>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            {t.reconTitle}
          </Typography>
          <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t.colName}</TableCell>
                  <TableCell align="right">{t.colLedger}</TableCell>
                  <TableCell align="right">{t.colStatement}</TableCell>
                  <TableCell align="right">{t.colDifference}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {integrity.cashAccounts.map(cash => (
                  <TableRow key={cash.accountId}>
                    <TableCell>{cash.name}</TableCell>
                    <TableCell align="right">{cash.ledgerBalance}</TableCell>
                    <TableCell align="right">
                      {cash.statementBalance ?? t.noStatementBalance}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color:
                          cash.difference && cash.difference !== '0.00'
                            ? 'warning.main'
                            : undefined,
                      }}
                    >
                      {cash.difference ?? ''}
                      {cash.difference && cash.difference !== '0.00' && !cash.hasOpeningBalance ? (
                        <Typography variant="caption" display="block">
                          {t.noOpeningBalance}
                        </Typography>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      ) : null}
    </Stack>
  );
}

interface NewAccountFormProps {
  accounts: LedgerAccount[];
  systemNames: Record<string, string>;
  saving: boolean;
  typeLabel: Record<AccountType, React.ReactNode>;
  onCancel: () => void;
  onSave: (input: NewAccountInput) => void;
}

function NewAccountForm({
  accounts,
  systemNames,
  saving,
  typeLabel,
  onCancel,
  onSave,
}: NewAccountFormProps): React.ReactElement {
  const t = useIntlayer('ledgerPage');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('expense');
  const [parentId, setParentId] = useState('');
  const [currency, setCurrency] = useState('');
  const [header, setHeader] = useState(false);
  // A parent must be a section header of the same type.
  const parents = accounts.filter(
    account => !account.isPostable && account.accountType === accountType,
  );
  const valid =
    /^[A-Za-z0-9_.-]{1,40}$/.test(code) &&
    name.trim().length > 0 &&
    (currency === '' || /^[A-Za-z]{3}$/.test(currency));

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            size="small"
            label={t.colCode.value}
            value={code}
            onChange={e => setCode(e.target.value)}
          />
          <TextField
            size="small"
            label={t.colName.value}
            value={name}
            onChange={e => setName(e.target.value)}
            sx={{ flex: 1 }}
          />
          <TextField
            select
            size="small"
            label={t.colType.value}
            value={accountType}
            onChange={e => {
              setAccountType(e.target.value as AccountType);
              setParentId('');
            }}
            sx={{ minWidth: 160 }}
          >
            {ACCOUNT_TYPES.map(type => (
              <MenuItem key={type} value={type}>
                {typeLabel[type]}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField
            select
            size="small"
            label={t.parentAccount.value}
            value={parentId}
            onChange={e => setParentId(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">{t.noParent}</MenuItem>
            {parents.map(parent => (
              <MenuItem key={parent.id} value={parent.id}>
                {accountDisplayName(parent, systemNames)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label={t.currencyOptional.value}
            value={currency}
            onChange={e => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
            sx={{ maxWidth: 160 }}
          />
          <FormControlLabel
            control={<Checkbox checked={header} onChange={e => setHeader(e.target.checked)} />}
            label={t.sectionHeader}
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            disabled={!valid || saving}
            onClick={() =>
              onSave({
                code: code.trim(),
                name: name.trim(),
                accountType,
                ...(parentId ? { parentId } : {}),
                ...(currency ? { currency } : {}),
                isPostable: !header,
              })
            }
          >
            {t.save}
          </Button>
          <Button onClick={onCancel}>{t.cancel}</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
