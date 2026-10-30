'use client';

import MuiButton from '@mui/material/Button';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Checkbox } from '@/app/components/ui/checkbox';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { checkContract } from '@/app/lib/query-fn-schema';

/** The project's author, who receives shared layouts. A name, not the product's. */
const AUTHOR = 'Symon Baikov';
/** Once the user said "don't ask again", the offer is not made on this browser. */
export const SHARE_NEVER_KEY = 'seneca-teach-share-never';

export function shareOfferDismissed(): boolean {
  try {
    return localStorage.getItem(SHARE_NEVER_KEY) === '1';
  } catch {
    return false;
  }
}

function dismissShareOffer() {
  try {
    localStorage.setItem(SHARE_NEVER_KEY, '1');
  } catch {
    // Storage blocked: the offer comes back next time, nothing worse.
  }
}

/** An e-mail with the layout, for when the project's service cannot take it. */
export function shareMailto(email: string, submission: { institution?: string; bankName: string }) {
  const subject = `Statement layout: ${submission.institution ?? submission.bankName}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    JSON.stringify(submission, null, 2),
  )}`;
}

/**
 * After a layout is taught: the offer to share it with the project's author.
 * It shows exactly what would be sent, says who gets it and what for, and
 * sends only once the user agrees; without the project's service, or when it
 * fails, the user's own mail app takes it instead.
 */
export function TeachShareDialog({
  statementId,
  onClose,
}: {
  statementId: string;
  onClose: () => void;
}): React.JSX.Element | null {
  const t = useIntlayer('pdfTeach');
  const [agreed, setAgreed] = useState(false);
  const [sending, setSending] = useState(false);
  const url = `/statements/${statementId}/teach/share`;
  const info = useQuery({
    queryKey: ['statements', statementId, 'teach-share'],
    queryFn: async () => checkContract('TeachShareInfo', (await apiClient.get(url)).data, url),
  });

  // Turned off on this instance, or nothing to share: no offer.
  useEffect(() => {
    if (info.isError || info.data?.enabled === false) {
      onClose();
    }
  }, [info.isError, info.data?.enabled, onClose]);

  if (!info.data?.enabled) {
    return null;
  }
  const { submission, email, direct } = info.data;

  const byEmail = () => {
    window.location.href = shareMailto(email, submission);
    onClose();
  };

  const send = async () => {
    if (!direct) {
      byEmail();
      return;
    }
    setSending(true);
    try {
      await checkContract('TeachShareResult', (await apiClient.post(url)).data, url);
      toast.success(t.share.sent.value);
      onClose();
    } catch {
      toast(t.share.mailOpened.value, { duration: 8000 });
      byEmail();
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={t.share.title.value}
      size="md"
      footer={
        <div className="seneca-pdf-teach__share-footer">
          <MuiButton
            variant="text"
            sx={{ color: 'var(--text-muted)', fontWeight: 500, mr: 'auto' }}
            onClick={() => {
              dismissShareOffer();
              onClose();
            }}
          >
            {t.share.never}
          </MuiButton>
          <MuiButton
            variant="text"
            sx={{ color: 'var(--text-muted)', fontWeight: 500 }}
            onClick={onClose}
          >
            {t.share.notNow}
          </MuiButton>
          <MuiButton
            variant="contained"
            disableElevation
            disabled={!agreed || sending}
            onClick={send}
            data-testid="teach-share-send"
          >
            {sending ? t.share.sending : direct ? t.share.send : t.share.sendByEmail}
          </MuiButton>
        </div>
      }
    >
      <div className="seneca-pdf-teach__share">
        <p className="seneca-pdf-teach__share-why">{t.share.why}</p>
        <ul className="seneca-pdf-teach__share-terms">
          <li>{t.share.onlyLayout}</li>
          <li>{t.share.evidence}</li>
          <li>{t.share.print}</li>
          <li>{t.share.recipient.value.replace('{name}', AUTHOR)}</li>
          <li>{t.share.published}</li>
          <li>{t.share.deletion.value.replace('{email}', email)}</li>
        </ul>
        <details className="seneca-pdf-teach__share-details">
          <summary>{t.share.whatSent}</summary>
          <pre data-testid="teach-share-payload">{JSON.stringify(submission, null, 2)}</pre>
        </details>
        <Checkbox
          checked={agreed}
          onCheckedChange={setAgreed}
          label={t.share.agree.value}
          aria-label={t.share.agree.value}
        />
      </div>
    </ModalShell>
  );
}
