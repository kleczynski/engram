import type { GraphEdge, GraphNode } from "@/lib/graph/types";

export type Vec3 = { x: number; y: number; z: number };
export type Layout = Map<string, Vec3>;

/** Radius of the first depth shell; deeper shells compress sub-linearly. */
const SHELL_RADIUS = 210;
const SHELL_FALLOFF = 0.78;
const ITERATIONS = 240;
const REPULSION = 9000;
const SPRING = 0.014;
const SPRING_LENGTH = 140;
const SHELL_PULL = 0.02;
const DAMPING = 0.85;
const MAX_STEP = 14;
const MIN_DISTANCE = 12;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Places nodes on depth shells, then relaxes them with repulsion and edge
 * springs. Fully deterministic: the same graph always lays out the same way,
 * so re-fetching does not scramble the user's mental map.
 */
export function computeLayout(nodes: GraphNode[], edges: GraphEdge[]): Layout {
  const layout: Layout = new Map();
  if (nodes.length === 0) return layout;

  const index = new Map(nodes.map((node, position) => [node.id, position]));
  const count = nodes.length;

  const px = new Float64Array(count);
  const py = new Float64Array(count);
  const pz = new Float64Array(count);
  const vx = new Float64Array(count);
  const vy = new Float64Array(count);
  const vz = new Float64Array(count);
  const shell = new Float64Array(count);

  // Fibonacci sphere per depth band gives an even, seed-free spread.
  const seenAtDepth = new Map<number, number>();
  const totalAtDepth = new Map<number, number>();
  for (const node of nodes) {
    totalAtDepth.set(node.depth, (totalAtDepth.get(node.depth) ?? 0) + 1);
  }

  nodes.forEach((node, i) => {
    const radius =
      node.depth === 0 ? 0 : SHELL_RADIUS * Math.pow(node.depth, SHELL_FALLOFF);
    shell[i] = radius;

    if (radius === 0) {
      px[i] = 0;
      py[i] = 0;
      pz[i] = 0;
      return;
    }

    const seen = seenAtDepth.get(node.depth) ?? 0;
    seenAtDepth.set(node.depth, seen + 1);

    const total = totalAtDepth.get(node.depth) ?? 1;
    const y = total === 1 ? 0 : 1 - (seen / (total - 1)) * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * seen;

    px[i] = Math.cos(theta) * ringRadius * radius;
    py[i] = y * radius * 0.65;
    pz[i] = Math.sin(theta) * ringRadius * radius;
  });

  const springs: [number, number][] = [];
  for (const edge of edges) {
    const source = index.get(edge.source);
    const target = index.get(edge.target);
    if (source !== undefined && target !== undefined && source !== target) {
      springs.push([source, target]);
    }
  }

  for (let step = 0; step < ITERATIONS; step += 1) {
    const cooling = 1 - step / ITERATIONS;

    for (let i = 0; i < count; i += 1) {
      let fx = 0;
      let fy = 0;
      let fz = 0;

      for (let j = 0; j < count; j += 1) {
        if (i === j) continue;

        let dx = px[i] - px[j];
        let dy = py[i] - py[j];
        let dz = pz[i] - pz[j];
        let distanceSq = dx * dx + dy * dy + dz * dz;

        if (distanceSq < MIN_DISTANCE * MIN_DISTANCE) {
          // Deterministic nudge so coincident nodes still separate.
          dx += ((i % 7) - 3) * 0.5;
          dy += ((j % 5) - 2) * 0.5;
          dz += ((i + j) % 9 - 4) * 0.5;
          distanceSq = Math.max(dx * dx + dy * dy + dz * dz, 1);
        }

        const distance = Math.sqrt(distanceSq);
        const force = REPULSION / distanceSq;

        fx += (dx / distance) * force;
        fy += (dy / distance) * force;
        fz += (dz / distance) * force;
      }

      vx[i] = (vx[i] + fx) * DAMPING;
      vy[i] = (vy[i] + fy) * DAMPING;
      vz[i] = (vz[i] + fz) * DAMPING;
    }

    for (const [a, b] of springs) {
      const dx = px[b] - px[a];
      const dy = py[b] - py[a];
      const dz = pz[b] - pz[a];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const pull = (distance - SPRING_LENGTH) * SPRING;

      const ux = (dx / distance) * pull;
      const uy = (dy / distance) * pull;
      const uz = (dz / distance) * pull;

      vx[a] += ux;
      vy[a] += uy;
      vz[a] += uz;
      vx[b] -= ux;
      vy[b] -= uy;
      vz[b] -= uz;
    }

    for (let i = 0; i < count; i += 1) {
      // Keep each node near its depth shell so the hierarchy reads radially.
      const distance =
        Math.sqrt(px[i] * px[i] + py[i] * py[i] + pz[i] * pz[i]) || 1;
      const correction = (shell[i] - distance) * SHELL_PULL;

      vx[i] += (px[i] / distance) * correction;
      vy[i] += (py[i] / distance) * correction;
      vz[i] += (pz[i] / distance) * correction;

      const limit = MAX_STEP * cooling;
      px[i] += clamp(vx[i], limit);
      py[i] += clamp(vy[i], limit);
      pz[i] += clamp(vz[i], limit);
    }
  }

  nodes.forEach((node, i) => {
    layout.set(node.id, { x: px[i], y: py[i], z: pz[i] });
  });

  return layout;
}

function clamp(value: number, limit: number): number {
  if (value > limit) return limit;
  if (value < -limit) return -limit;
  return value;
}

/** Bounding sphere of the given nodes, used to frame the camera. */
export function boundsOf(
  layout: Layout,
  ids: string[],
): { center: Vec3; radius: number } {
  const points = ids
    .map((id) => layout.get(id))
    .filter((point): point is Vec3 => Boolean(point));

  if (points.length === 0) {
    return { center: { x: 0, y: 0, z: 0 }, radius: SHELL_RADIUS * 2 };
  }

  const center = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length,
      z: sum.z + point.z / points.length,
    }),
    { x: 0, y: 0, z: 0 },
  );

  const radius = points.reduce((max, point) => {
    const distance = Math.hypot(
      point.x - center.x,
      point.y - center.y,
      point.z - center.z,
    );
    return Math.max(max, distance);
  }, 0);

  return { center, radius: Math.max(radius, 90) };
}
