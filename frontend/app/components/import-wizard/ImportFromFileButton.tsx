'use client';

import { useRef, useState } from 'react';
import { TABULAR_FILE_ACCEPT } from '@/app/(main)/custom-tables/[id]/utils/tabularFileReader';
import { useIntlayer } from '@/app/i18n';
import { ImportWizardDialog } from './ImportWizardDialog';
import type { ImportRunResult, ImportTarget } from './import-wizard-api';

export interface ImportFromFileButtonProps {
  target: ImportTarget;
  onImported?: (result: ImportRunResult) => void;
  /** Renders the trigger in the page's own button kit; receives the label and the opener. */
  renderTrigger: (open: () => void, label: string) => React.ReactNode;
}

/** File picker + wizard for a section page; the page decides how the button looks. */
export function ImportFromFileButton(props: ImportFromFileButtonProps): React.JSX.Element {
  const t = useIntlayer('importWizard');
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  return (
    <>
      {props.renderTrigger(() => inputRef.current?.click(), t.button.value)}
      <input
        ref={inputRef}
        type="file"
        accept={TABULAR_FILE_ACCEPT}
        hidden
        data-testid={`import-file-input-${props.target}`}
        onChange={event => {
          const picked = event.target.files?.[0] ?? null;
          event.target.value = '';
          if (picked) {
            setFile(picked);
          }
        }}
      />
      {file && (
        <ImportWizardDialog
          isOpen
          onClose={() => setFile(null)}
          file={file}
          fixedTarget={props.target}
          onImported={props.onImported}
        />
      )}
    </>
  );
}
