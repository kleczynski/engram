"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type Points,
} from "three";

import { EDGE_COLOR, phaseFor } from "@/components/graph/theme";
import type { Layout } from "@/lib/graph/layout";
import type { GraphEdge } from "@/lib/graph/types";

const PULSE_SPEED = 0.28;

type Props = {
  edges: GraphEdge[];
  layout: Layout;
  visibleIds: Set<string>;
  activeIds: Set<string>;
};

type DrawableEdge = {
  edge: GraphEdge;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  active: boolean;
  phase: number;
};

function baseColor(edge: GraphEdge): readonly [number, number, number] {
  if (edge.type === "relation") return EDGE_COLOR.relation;
  if (edge.type === "hierarchy") return EDGE_COLOR.hierarchy;
  return EDGE_COLOR.ai;
}

/**
 * All synapses render as a single lineSegments plus a single points cloud, so
 * edge count costs two draw calls instead of two per edge.
 */
export function SynapseEdges({ edges, layout, visibleIds, activeIds }: Props) {
  const pulses = useRef<Points>(null);

  const drawable = useMemo<DrawableEdge[]>(() => {
    const result: DrawableEdge[] = [];

    for (const edge of edges) {
      if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) continue;

      const from = layout.get(edge.source);
      const to = layout.get(edge.target);
      if (!from || !to) continue;

      result.push({
        edge,
        from,
        to,
        active: activeIds.has(edge.source) && activeIds.has(edge.target),
        phase: phaseFor(edge.id),
      });
    }

    return result;
  }, [edges, layout, visibleIds, activeIds]);

  const hasActive = activeIds.size > 0;

  const lineGeometry = useMemo(() => {
    const positions = new Float32Array(drawable.length * 6);
    const colors = new Float32Array(drawable.length * 6);

    drawable.forEach((item, index) => {
      const offset = index * 6;
      positions[offset] = item.from.x;
      positions[offset + 1] = item.from.y;
      positions[offset + 2] = item.from.z;
      positions[offset + 3] = item.to.x;
      positions[offset + 4] = item.to.y;
      positions[offset + 5] = item.to.z;

      const [r, g, b] = item.active ? EDGE_COLOR.active : baseColor(item.edge);
      const fade = hasActive && !item.active ? 0.22 : 1;

      for (let vertex = 0; vertex < 2; vertex += 1) {
        colors[offset + vertex * 3] = r * fade;
        colors[offset + vertex * 3 + 1] = g * fade;
        colors[offset + vertex * 3 + 2] = b * fade;
      }
    });

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    return geometry;
  }, [drawable, hasActive]);

  const pulseGeometry = useMemo(() => {
    const positions = new Float32Array(drawable.length * 3);
    const colors = new Float32Array(drawable.length * 3);

    drawable.forEach((item, index) => {
      const [r, g, b] = item.active ? EDGE_COLOR.active : baseColor(item.edge);
      const gain = item.active ? 1.6 : hasActive ? 0.35 : 1;

      colors[index * 3] = Math.min(1, r * gain + 0.15);
      colors[index * 3 + 1] = Math.min(1, g * gain + 0.15);
      colors[index * 3 + 2] = Math.min(1, b * gain + 0.2);
    });

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    return geometry;
  }, [drawable, hasActive]);

  useEffect(() => () => lineGeometry.dispose(), [lineGeometry]);
  useEffect(() => () => pulseGeometry.dispose(), [pulseGeometry]);

  useFrame(({ clock }) => {
    const points = pulses.current;
    if (!points) return;

    const attribute = points.geometry.getAttribute("position") as BufferAttribute;
    const time = clock.getElapsedTime();

    drawable.forEach((item, index) => {
      const progress = (time * PULSE_SPEED + item.phase) % 1;
      attribute.setXYZ(
        index,
        item.from.x + (item.to.x - item.from.x) * progress,
        item.from.y + (item.to.y - item.from.y) * progress,
        item.from.z + (item.to.z - item.from.z) * progress,
      );
    });

    attribute.needsUpdate = true;
  });

  if (drawable.length === 0) return null;

  return (
    <group>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.6}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      <points ref={pulses} geometry={pulseGeometry}>
        <pointsMaterial
          vertexColors
          size={5}
          sizeAttenuation
          transparent
          opacity={0.95}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
