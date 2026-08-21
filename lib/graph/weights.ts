/** Scene units for a node with no edges and a neutral hub score. */
export const BASE_RADIUS = 6;

/** Node size: baseRadius + (edgeCount * 2) + (hub_score * 5). */
export function nodeRadius(input: { edgeCount: number; hubScore: number }): number {
  return BASE_RADIUS + input.edgeCount * 2 + input.hubScore * 5;
}

const MAX_HUB_SCORE = 6;

/**
 * Hubs are pages that hold a large subtree beneath them. Log scaling keeps the
 * root from dwarfing everything else.
 */
export function hubScore(descendantCount: number): number {
  const raw = 1 + Math.log2(1 + Math.max(0, descendantCount));
  return Math.min(Math.round(raw * 100) / 100, MAX_HUB_SCORE);
}

/** Counts every descendant of each node in a parent-pointer forest. */
export function descendantCounts(
  nodes: { id: string; parentId: string | null }[],
): Map<string, number> {
  const childrenOf = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const siblings = childrenOf.get(node.parentId);
    if (siblings) siblings.push(node.id);
    else childrenOf.set(node.parentId, [node.id]);
  }

  const counts = new Map<string, number>();

  const walk = (id: string): number => {
    const cached = counts.get(id);
    if (cached !== undefined) return cached;

    // Seed before recursing so a cycle cannot loop forever.
    counts.set(id, 0);
    let total = 0;
    for (const childId of childrenOf.get(id) ?? []) {
      total += 1 + walk(childId);
    }
    counts.set(id, total);
    return total;
  };

  for (const node of nodes) walk(node.id);
  return counts;
}

const OBSERVABILITY_PATTERN =
  /observab|evaluat|\beval\b|llmops|monitor|telemetry|tracing|\btrace/i;

export function matchesObservability(title: string): boolean {
  return OBSERVABILITY_PATTERN.test(title);
}

/**
 * A page belongs to the Observability / Evaluation cluster when its own title
 * matches, or when it sits under a page that matches.
 */
export function observabilityCluster(
  nodes: { id: string; parentId: string | null; title: string }[],
): Set<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const cluster = new Set<string>();

  for (const node of nodes) {
    let current: (typeof nodes)[number] | undefined = node;
    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
      visited.add(current.id);

      if (cluster.has(current.id) || matchesObservability(current.title)) {
        cluster.add(node.id);
        break;
      }

      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }

  return cluster;
}
