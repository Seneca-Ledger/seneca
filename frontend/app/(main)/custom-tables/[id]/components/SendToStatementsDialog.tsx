'use client';

import { Button } from '@/app/components/ui/button';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';

export interface ConvertResult {
  statementId: string;
  importedRows: number;
  skippedRows: number;
  warnings: string[];
}

export interface SendToStatementsLabels {
  title: string;
  message: string;
  requirements: string;
  confirm: string;
  cancel: string;
  successTitle: string;
  imported: string;
  skipped: string;
  openStatement: string;
  openDashboard: string;
  close: string;
}

interface SendToStatementsDialogProps {
  open: boolean;
  busy: boolean;
  result: ConvertResult | null;
  onConfirm: () => void;
  onClose: () => void;
  onOpenStatement: (id: string) => void;
  onOpenDashboard: () => void;
  labels: SendToStatementsLabels;
}

const fill = (template: string, count: number) => template.replace('{{count}}', String(count));

/**
 * Two-step dialog: confirm the conversion, then show what the server did.
 * Categories are assigned by the existing classifier during the import.
 */
export function SendToStatementsDialog(props: SendToStatementsDialogProps) {
  const { open, busy, result, onConfirm, onClose, labels } = props;
  return (
    <ModalShell
      isOpen={open}
      onClose={busy ? () => undefined : onClose}
      size="sm"
      title={result ? labels.successTitle : labels.title}
      footer={
        result ? (
          <ModalFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              {labels.close}
            </Button>
            <Button variant="outline" type="button" onClick={props.onOpenDashboard}>
              {labels.openDashboard}
            </Button>
            <Button type="button" onClick={() => props.onOpenStatement(result.statementId)}>
              {labels.openStatement}
            </Button>
          </ModalFooter>
        ) : (
          <ModalFooter
            onCancel={onClose}
            onConfirm={onConfirm}
            cancelText={labels.cancel}
            confirmText={labels.confirm}
            isConfirmLoading={busy}
          />
        )
      }
    >
      {result ? (
        <div className="seneca-ct__convert">
          <p>{fill(labels.imported, result.importedRows)}</p>
          {result.skippedRows ? (
            <p className="seneca-ct__hint">{fill(labels.skipped, result.skippedRows)}</p>
          ) : null}
          {result.warnings.length ? (
            <ul className="seneca-ct__warnings">
              {result.warnings.slice(0, 5).map(warning => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="seneca-ct__convert">
          <p>{labels.message}</p>
          <p className="seneca-ct__hint">{labels.requirements}</p>
        </div>
      )}
    </ModalShell>
  );
}
