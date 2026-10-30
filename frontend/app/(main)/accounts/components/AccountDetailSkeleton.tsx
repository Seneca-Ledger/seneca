import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import { useIntlayer } from '@/app/i18n';
import { cardStyle, listRowStyle, titleStyle } from './account-detail-styles';

/** Two lines on the left and, under `right`, what sits on the right of a card row. */
function RowSkeleton({ right }: { right: React.ReactNode }): React.JSX.Element {
  return (
    <div style={listRowStyle}>
      <span style={{ display: 'grid', gap: 2 }}>
        <Skeleton variant="text" width={170} height={20} />
        <Skeleton variant="text" width={220} height={18} />
      </span>
      {right}
    </div>
  );
}

/** The account page while it loads: header, balance, chart and both lists in place. */
export function AccountDetailSkeleton(): React.JSX.Element {
  const t = useIntlayer('accountsPage');
  return (
    <>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <Skeleton variant="circular" width={44} height={44} sx={{ flexShrink: 0 }} />
        <div style={{ display: 'grid', gap: 4, flex: 1 }}>
          <Skeleton variant="text" width={180} height={30} />
          <Skeleton variant="text" width={220} height={18} />
        </div>
        <Button variant="outlined" disabled>
          {t.edit}
        </Button>
      </header>

      <Skeleton variant="text" width={170} height={48} />

      <section style={cardStyle}>
        <h2 style={titleStyle}>{t.balanceTitle}</h2>
        <div className="seneca-chart__box">
          <Skeleton variant="rounded" height="100%" />
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={titleStyle}>{t.statementsTitle}</h2>
        <div>
          {Array.from({ length: 3 }, (_, index) => (
            <RowSkeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              key={index}
              right={<Skeleton variant="text" width={44} height={20} sx={{ mx: 1 }} />}
            />
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={titleStyle}>{t.transactionsTitle}</h2>
        <div>
          {Array.from({ length: 5 }, (_, index) => (
            <RowSkeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              key={index}
              right={
                <span style={{ display: 'grid', gap: 2, justifyItems: 'end' }}>
                  <Skeleton variant="text" width={80} height={20} />
                  <Skeleton variant="text" width={70} height={18} />
                </span>
              }
            />
          ))}
        </div>
      </section>
    </>
  );
}
