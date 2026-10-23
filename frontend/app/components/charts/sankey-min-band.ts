type SankeyLink = { source: string; target: string; value: number };

/** The thinnest band, as a share of the largest node: enough to see and hover. */
const MIN_BAND_SHARE = 0.03;

/**
 * ECharts sizes sankey bands strictly by value, so a $4 charge next to $1,900
 * of "left over" is a hairline. This gives every band a floor of
 * MIN_BAND_SHARE of the largest node, then widens the bands feeding a node
 * whose outflow grew so the node still lines up on both sides. Only the
 * drawing changes: labels and tooltips read the real figures from here.
 */
export function withMinBand<L extends SankeyLink>(
  links: readonly L[],
): {
  links: L[];
  nodeValue: (id: string) => number;
  linkValue: (source: string, target: string) => number;
} {
  const realIn = new Map<string, number>();
  const realOut = new Map<string, number>();
  for (const link of links) {
    realOut.set(link.source, (realOut.get(link.source) ?? 0) + link.value);
    realIn.set(link.target, (realIn.get(link.target) ?? 0) + link.value);
  }
  const nodeIds = new Set([...realIn.keys(), ...realOut.keys()]);
  // ECharts' node value: the larger of what comes in and what goes out.
  const nodeValue = (id: string): number => Math.max(realIn.get(id) ?? 0, realOut.get(id) ?? 0);
  const floor = MIN_BAND_SHARE * Math.max(0, ...[...nodeIds].map(nodeValue));

  const drawn = links.map(link => ({ ...link, value: Math.max(link.value, floor) }));

  // Right to left: a node's outgoing bands are final before its incoming ones are widened.
  for (const id of leftToRight(links, nodeIds).reverse()) {
    const into = drawn.filter(link => link.target === id);
    const outOf = drawn.filter(link => link.source === id);
    if (into.length === 0 || outOf.length === 0) {
      continue;
    }
    const inSum = into.reduce((sum, link) => sum + link.value, 0);
    const outSum = outOf.reduce((sum, link) => sum + link.value, 0);
    if (outSum > inSum) {
      for (const link of into) {
        link.value *= outSum / inSum;
      }
    }
  }

  const realLink = new Map(links.map(link => [`${link.source}\u0000${link.target}`, link.value]));
  return {
    links: drawn,
    nodeValue,
    linkValue: (source: string, target: string): number =>
      realLink.get(`${source}\u0000${target}`) ?? 0,
  };
}

/** Node ids in flow order: every node after all the nodes that feed it. */
function leftToRight(links: readonly SankeyLink[], nodeIds: Set<string>): string[] {
  const incoming = new Map<string, number>();
  for (const link of links) {
    incoming.set(link.target, (incoming.get(link.target) ?? 0) + 1);
  }
  const order = [...nodeIds].filter(id => !incoming.has(id));
  for (let index = 0; index < order.length; index++) {
    for (const link of links) {
      if (link.source !== order[index]) {
        continue;
      }
      const left = (incoming.get(link.target) ?? 0) - 1;
      incoming.set(link.target, left);
      if (left === 0) {
        order.push(link.target);
      }
    }
  }
  return order;
}
