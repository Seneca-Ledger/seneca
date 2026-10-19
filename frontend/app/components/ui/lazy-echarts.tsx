'use client';

import Skeleton from '@mui/material/Skeleton';
import type { EChartsReactProps } from 'echarts-for-react';
import dynamic from 'next/dynamic';
import type React from 'react';

/**
 * echarts едет отдельным чанком. Без fallback `dynamic` рисует null: скелет по
 * данным уже снят, а графика ещё нет — карточка схлопывается до заголовка и через
 * кадр разворачивается обратно. Внешний бокс держит размер, поэтому заглушка и
 * график занимают ровно одну и ту же коробку.
 *
 * Размер передаётся через `style` обёртки, а не самого графика: у `loading`-компонента
 * `dynamic` нет доступа к пропсам вызывающего кода.
 */
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => <Skeleton variant="rounded" width="100%" height="100%" />,
});

export function LazyECharts({ style, ...props }: EChartsReactProps): React.JSX.Element {
  return (
    <div style={{ width: '100%', ...style }}>
      <ReactECharts style={{ height: '100%', width: '100%' }} {...props} />
    </div>
  );
}
