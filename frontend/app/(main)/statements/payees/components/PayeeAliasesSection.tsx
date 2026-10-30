import Button from '@mui/material/Button';
import toast from 'react-hot-toast';
import { useSplitPayeeAlias } from '@/app/components/payees/usePayees';
import { ReadOnlyHint } from '@/app/components/versions/ReadOnlyHint';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { PayeeSummary } from '@/app/lib/contracts';

/** How statements write the payee's name, each one splittable into a payee of its own. */
export function PayeeAliasesSection({
  payeeId: id,
  aliases,
}: {
  payeeId: string;
  aliases: PayeeSummary['aliases'];
}): React.JSX.Element | null {
  const t = useIntlayer('payeesPage');
  const tPayees = useIntlayer('payees');
  const splitAlias = useSplitPayeeAlias();
  const fail = (error: unknown) => toast.error(getApiErrorMessage(error, tPayees.failed.value));
  if (aliases.length === 0) {
    return null;
  }
  return (
    <section className="seneca-all-tx__card seneca-payees__section">
      <h2 className="seneca-all-tx__card-title">{t.aliasesTitle}</h2>
      <span className="seneca-all-tx__muted" style={{ fontSize: 13 }}>
        {t.aliasesHint}
      </span>
      <div>
        {aliases.map(alias => (
          <div key={alias.key} className="seneca-payees__row">
            <span style={{ fontSize: 14, minWidth: 0, overflowWrap: 'anywhere' }}>
              {alias.example ?? alias.key}
            </span>
            {aliases.length > 1 && (
              <ReadOnlyHint>
                <Button
                  size="small"
                  variant="text"
                  disabled={splitAlias.isPending}
                  onClick={() =>
                    void splitAlias
                      .mutateAsync({ id, key: alias.key })
                      .then(result =>
                        toast.success(
                          t.splitDone.value.replace('{{count}}', String(result.updated)),
                        ),
                      )
                      .catch(fail)
                  }
                >
                  {t.splitAlias}
                </Button>
              </ReadOnlyHint>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
