'use client';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import {
  extractUploadErrorMessage,
  uploadReceiptScanFiles,
} from '@/app/(main)/statements/components/statement-upload';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { X } from '@/app/components/icons';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { SubscriptionChargeCandidates, SubscriptionDetail } from '@/app/lib/contracts';
import { formatMoney } from '@/app/lib/format-money';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';

export type CandidateRow = SubscriptionChargeCandidates[number];

/** A payment shown in the list: saved (the card) or still to be saved (the form). */
export type PaymentEntry = {
  key: string;
  date: string;
  amount: number;
  currency: string;
  /** Comes from a bank row rather than typed in. */
  linked: boolean;
};

interface SubscriptionPaymentsProps {
  payments: PaymentEntry[];
  vendorName: string;
  /** Prefills the amount of a payment typed in: the subscription's price. */
  defaultAmount: number | '';
  /** Rows picked in the form but not saved yet, kept out of the picker. */
  pickedTransactionIds?: string[];
  onAddManual: (date: string, amount: number) => void | Promise<void>;
  onAddRows: (rows: CandidateRow[]) => void | Promise<void>;
  /** Payees whose new rows the server adds on its own; the card only. */
  autoLinkPayees?: SubscriptionDetail['autoLinkPayees'];
  /** Links a typed-in payment to a bank row; the card only. */
  onLinkRow?: (paymentKey: string, row: CandidateRow) => void | Promise<void>;
  onRemove: (key: string) => void | Promise<void>;
}

/**
 * Payments of a subscription: typed in with a date and an amount, picked from
 * rows of uploaded statements, or read from a document uploaded right here the
 * way Statements uploads one, whose row is added at once.
 */
export function SubscriptionPayments({
  payments,
  vendorName,
  defaultAmount,
  pickedTransactionIds = [],
  autoLinkPayees = [],
  onAddManual,
  onAddRows,
  onLinkRow,
  onRemove,
}: SubscriptionPaymentsProps) {
  const t = useIntlayer('subscriptionPayments');
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const [mode, setMode] = useState<'idle' | 'manual' | 'pick'>('idle');
  const [manualDate, setManualDate] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  // The typed-in payment a picked row will be linked to, instead of adding one.
  const [linkingKey, setLinkingKey] = useState<string | null>(null);
  const [statementId, setStatementId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Set on every mount: React mounts twice in development, and a flag cleared by
  // the first unmount alone dropped every payment an upload came back with.
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const candidates = useQuery({
    queryKey: queryKeys.subscriptionChargeCandidates({ workspaceId, vendorName, statementId }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/subscriptions/charge-candidates',
        params: {
          vendorName: vendorName || undefined,
          statementId: statementId ?? undefined,
        } satisfies ContractInput<'SubscriptionChargeCandidatesQuery'>,
        signal,
        contract: 'SubscriptionChargeCandidates',
      }),
    enabled: mode === 'pick' && Boolean(workspaceId),
  });
  const rows = (candidates.data ?? []).filter(
    row => !pickedTransactionIds.includes(row.transactionId),
  );

  const formatDate = (value: string) =>
    formatStoredDateWithOptions(
      value,
      { year: 'numeric', month: 'short', day: 'numeric' },
      resolveLocale(locale),
    );
  const money = (amount: number, currency: string) => formatMoney(amount, currency, locale);

  const openPicker = (forKey: string | null) => {
    setLinkingKey(forKey);
    setStatementId(null);
    setNote(null);
    setMode('pick');
  };

  const pick = async (row: CandidateRow) => {
    if (linkingKey && onLinkRow) await onLinkRow(linkingKey, row);
    else await onAddRows([row]);
    setMode('idle');
    setLinkingKey(null);
  };

  const addManual = async () => {
    const amount = Number(manualAmount || defaultAmount);
    if (!(manualDate && Number.isFinite(amount))) return;
    await onAddManual(manualDate, amount);
    setManualDate('');
    setManualAmount('');
    setMode('idle');
  };

  const upload = async (file: File) => {
    setUploading(true);
    setNote(t.reading.value);
    setMode('idle');
    try {
      // The same scan Statements runs: the document is read before the answer
      // comes back, with its row already made.
      let id: string | undefined;
      await uploadReceiptScanFiles({
        files: [file],
        labels: {
          pickAtLeastOne: t.uploadFailed.value,
          uploadedProcessing: '',
          uploadFailed: t.uploadFailed.value,
        },
        onUploadSuccess: () => undefined,
        refreshAfterCreate: async () => undefined,
        onBatchCreated: (_offset, statementIds) => {
          id = statementIds[0];
        },
      });
      if (!id) throw new Error(t.uploadFailed.value);
      const found = await apiQueryDecoded({
        url: '/subscriptions/charge-candidates',
        params: {
          vendorName: vendorName || undefined,
          statementId: id,
        } satisfies ContractInput<'SubscriptionChargeCandidatesQuery'>,
        contract: 'SubscriptionChargeCandidates',
      });
      // The payment is recorded even if the card was closed while the scan ran:
      // only the messages below need it on screen.
      const fresh = found.filter(row => !pickedTransactionIds.includes(row.transactionId));
      const matching = fresh.filter(row => row.matchesVendor);
      // Uploaded from this subscription: a document with a single row is its
      // payment even when the payee is spelled differently ("Anthropic" for Claude).
      const toAdd = matching.length > 0 ? matching : fresh.length === 1 ? fresh : [];
      if (toAdd.length > 0) {
        await onAddRows(toAdd);
        if (alive.current) {
          setNote(t.linkedFromUpload.value.replace('{count}', String(toAdd.length)));
        }
      } else if (!alive.current) {
        return;
      } else if (fresh.length > 0) {
        setLinkingKey(null);
        setStatementId(id);
        setMode('pick');
        setNote(t.nothingMatched.value);
      } else {
        // Read, but no amount found: nothing to pay with.
        setNote(t.uploadFailed.value);
      }
    } catch (error) {
      if (alive.current) setNote(extractUploadErrorMessage(error, t.uploadFailed.value));
    } finally {
      if (alive.current) setUploading(false);
    }
  };

  return (
    <section className="seneca-sub-payments">
      <h3 className="seneca-sub-payments__heading">{t.payments}</h3>
      {payments.length === 0 ? (
        <p className="seneca-sub-payments__empty">{t.noPayments}</p>
      ) : (
        <ul className="seneca-sub-payments__list">
          {payments.map(payment => (
            <li key={payment.key} className="seneca-sub-payments__row">
              <span>{formatDate(payment.date)}</span>
              <PrivateAmount>{money(payment.amount, payment.currency)}</PrivateAmount>
              <span className="seneca-sub-payments__source">
                {payment.linked ? (
                  t.linked
                ) : onLinkRow ? (
                  <Button
                    variant="text"
                    size="small"
                    className="seneca-sub-payments__link"
                    onClick={() => openPicker(payment.key)}
                  >
                    {t.link}
                  </Button>
                ) : null}
              </span>
              <IconButton
                size="small"
                aria-label={t.remove.value}
                onClick={() => void onRemove(payment.key)}
              >
                <X size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      {/* The rule, said out loud: which payees' new rows land here without asking. */}
      {autoLinkPayees.some(payee => !payee.shared) && (
        <p className="seneca-sub-payments__note">
          {t.autoLinked.value.replace(
            '{names}',
            autoLinkPayees
              .filter(payee => !payee.shared)
              .map(payee => payee.name)
              .join(', '),
          )}
        </p>
      )}
      {autoLinkPayees
        .filter(payee => payee.shared)
        .map(payee => (
          <p key={payee.payeeId} className="seneca-sub-payments__note">
            {t.autoLinkShared.value.replace('{name}', payee.name)}
          </p>
        ))}

      {mode === 'manual' && (
        <div className="seneca-sub-payments__manual">
          <CustomDatePicker
            id="subscription-payment-date"
            compact
            value={manualDate}
            maxDate={new Date().toISOString().slice(0, 10)}
            onChange={setManualDate}
            placeholder={t.date.value}
          />
          <TextField
            size="small"
            type="number"
            label={t.amount.value}
            value={manualAmount}
            placeholder={defaultAmount === '' ? '' : String(defaultAmount)}
            onChange={event => setManualAmount(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button
            variant="outlined"
            size="small"
            disabled={!manualDate}
            onClick={() => void addManual()}
          >
            {t.add}
          </Button>
        </div>
      )}

      {mode === 'pick' &&
        (candidates.isPending ? null : rows.length === 0 ? (
          <p className="seneca-sub-payments__empty">{t.noCandidates}</p>
        ) : (
          <ul className="seneca-sub-payments__picker">
            {rows.map(row => (
              <li key={row.transactionId}>
                <button
                  type="button"
                  className="seneca-sub-payments__candidate"
                  data-match={row.matchesVendor || undefined}
                  onClick={() => void pick(row)}
                >
                  <span className="seneca-sub-payments__candidate-name">
                    {row.counterpartyName}
                  </span>
                  <span>{formatDate(row.transactionDate)}</span>
                  <PrivateAmount>{money(row.amount, row.currency)}</PrivateAmount>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {note && <p className="seneca-sub-payments__note">{note}</p>}

      <div className="seneca-sub-payments__actions">
        <Button
          variant="text"
          size="small"
          onClick={() => setMode(mode === 'manual' ? 'idle' : 'manual')}
        >
          {t.addPayment}
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={() => (mode === 'pick' ? setMode('idle') : openPicker(null))}
        >
          {t.fromStatements}
        </Button>
        <Button
          variant="text"
          size="small"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          {t.uploadStatement}
        </Button>
        <input
          ref={fileInput}
          type="file"
          hidden
          accept="image/*,.pdf,.xml"
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void upload(file);
          }}
        />
      </div>
    </section>
  );
}
