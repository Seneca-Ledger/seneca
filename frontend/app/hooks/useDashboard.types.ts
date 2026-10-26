/**
 * Типы дашборда вынесены из useDashboard.ts, чтобы файл хука не упирался в
 * max-lines. useDashboard.ts их ре-экспортирует — импорты по всему приложению
 * менять не нужно.
 */

// The wire types come from packages/contracts, which the backend builds its
// responses from; only client-side shapes stay here.
export type {
  DashboardActionItem,
  DashboardCashFlowEntry,
  DashboardCashFlowPoint,
  DashboardDataHealth,
  DashboardFinancialSnapshot,
  DashboardRange,
  DashboardRecentTransaction,
  DashboardResponse as DashboardData,
  DashboardTopCategory,
  DashboardTopMerchant,
} from '@/app/lib/contracts';

export interface DashboardNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  severity: 'info' | 'warn' | 'error';
  isRead: boolean;
  type: string;
  entityType: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
}
