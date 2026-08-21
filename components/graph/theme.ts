export const BACKGROUND = "#0a0a0f";

export const NODE_COLOR = {
  root: "#fbbf24",
  observability: "#22d3ee",
  page: "#8b7cf6",
  selected: "#f1f5f9",
} as const;

export const EDGE_COLOR = {
  hierarchy: [0.31, 0.27, 0.62] as const,
  relation: [0.13, 0.55, 0.62] as const,
  active: [0.75, 0.9, 1] as const,
  ai: [0.85, 0.45, 0.9] as const,
};

/** Stable per-node phase so pulses look organic instead of synchronized. */
export function phaseFor(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (((hash >>> 0) % 997) / 997) * Math.PI * 2;
}
