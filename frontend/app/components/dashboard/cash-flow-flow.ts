import type { CashFlowMapData } from '@/app/(main)/reports/components/cash-flow/useCashFlowMap';

type Sankey = CashFlowMapData['sankey'];

/** The first and last day of a `YYYY-MM` month, as `YYYY-MM-DD`. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

/**
 * The Reports sankey cut to sources → total → categories for a half-width
 * card: subcategories and the bands into them go, and each category keeps the
 * value that flows into it, so the picture adds up the same.
 */
export function withoutSubcategories(sankey: Sankey): Sankey {
  const dropped = new Set(
    sankey.nodes.filter(node => node.kind === 'subcategory').map(node => node.id),
  );
  return {
    nodes: sankey.nodes.filter(node => !dropped.has(node.id)),
    links: sankey.links.filter(link => !(dropped.has(link.source) || dropped.has(link.target))),
  };
}
