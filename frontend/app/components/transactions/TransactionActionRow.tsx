import { ChevronRight } from '@/app/components/icons';

interface ActionRowProps {
  label: React.ReactNode;
  /** One line on what the action means, for the ones whose name alone does not say. */
  hint?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

/** One action of the list: what it does, a line on what it means, an arrow. */
export function ActionRow({ label, hint, onClick, disabled }: ActionRowProps): React.JSX.Element {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="seneca-tx-action">
      <span className="seneca-tx-action__text">
        <span className="seneca-tx-action__label">{label}</span>
        {hint && <span className="seneca-tx-action__hint">{hint}</span>}
      </span>
      <ChevronRight size={16} className="seneca-tx-action__arrow" aria-hidden />
    </button>
  );
}
