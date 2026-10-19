'use client';

type Props = {
  activeFlow: string;
  spendLabel: string;
  incomeLabel: string;
  onFlowChange: (flow: string) => void;
};

export function AnalyticsFlowToggle({
  activeFlow,
  spendLabel,
  incomeLabel,
  onFlowChange,
}: Props): React.JSX.Element {
  return (
    <div className="seneca-view-page__period-tabs">
      <button
        type="button"
        className={`seneca-view-page__period-tab${activeFlow === 'spend' ? ' seneca-view-page__period-tab--active' : ''}`}
        onClick={() => onFlowChange('spend')}
      >
        {spendLabel}
      </button>
      <button
        type="button"
        className={`seneca-view-page__period-tab${activeFlow === 'income' ? ' seneca-view-page__period-tab--active' : ''}`}
        onClick={() => onFlowChange('income')}
      >
        {incomeLabel}
      </button>
    </div>
  );
}
