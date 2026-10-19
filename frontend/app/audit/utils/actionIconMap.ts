import type { LucideIcon } from '@/app/components/icons';
import {
  Copy,
  Download,
  Link2,
  Pencil,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Trash2,
  Unlink2,
  Upload,
} from '@/app/components/icons';
import type { AuditAction } from '@/lib/api/audit';

export const ACTION_ICON_MAP: Record<AuditAction, LucideIcon> = {
  create: PlusCircle,
  update: Pencil,
  delete: Trash2,
  import: Upload,
  export: Download,
  link: Link2,
  unlink: Unlink2,
  match: Copy,
  unmatch: Unlink2,
  apply_rule: Sparkles,
  rollback: RefreshCw,
};
