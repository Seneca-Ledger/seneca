interface AccountPickSectionProps {
  testId: string;
  title: React.ReactNode;
  /** Shown instead of the list when there is no account to pick. */
  empty: React.ReactNode;
  accounts: { id: string; name: string }[];
  saving: boolean;
  onPick: (accountId: string) => void;
  onCancel: () => void;
  cancelLabel: React.ReactNode;
}

/** The drawer's "pick one of your accounts" list, with a way back. */
export function AccountPickSection({
  testId,
  title,
  empty,
  accounts,
  saving,
  onPick,
  onCancel,
  cancelLabel,
}: AccountPickSectionProps): React.JSX.Element {
  return (
    <div className="seneca-tx-detail__section" data-testid={testId}>
      <div className="seneca-tx-detail__label">{title}</div>
      {accounts.length === 0 ? (
        <div className="seneca-tx-detail__label">{empty}</div>
      ) : (
        <div className="seneca-tx-detail__actions">
          {accounts.map(account => (
            <button
              key={account.id}
              type="button"
              onClick={() => onPick(account.id)}
              disabled={saving}
              className="seneca-tx-detail__ignore-btn"
            >
              {account.name}
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={onCancel} className="seneca-tx-detail__ignore-btn">
        {cancelLabel}
      </button>
    </div>
  );
}
