"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  SphereGeometry,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
} from "three";

import { NODE_COLOR, phaseFor } from "@/components/graph/theme";
import type { GraphNode } from "@/lib/graph/types";

// Shared across every neuron so the scene allocates two geometries, not two per node.
const CORE_GEOMETRY = new SphereGeometry(1, 24, 24);
const HALO_GEOMETRY = new SphereGeometry(1, 16, 16);

type Props = {
  node: GraphNode;
  position: [number, number, number];
  radius: number;
  selected: boolean;
  hovered: boolean;
  active: boolean;
  dimmed: boolean;
  showLabel: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

export function NeuronNode({
  node,
  position,
  radius,
  selected,
  hovered,
  active,
  dimmed,
  showLabel,
  onSelect,
  onHover,
}: Props) {
  const core = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  const phase = useMemo(() => phaseFor(node.id), [node.id]);

  const color = selected
    ? NODE_COLOR.selected
    : node.depth === 0
      ? NODE_COLOR.root
      : node.observability
        ? NODE_COLOR.observability
        : NODE_COLOR.page;

  // Deeper pages fire slower, hubs brighter — reads as signal strength.
  const speed = 1.9 - Math.min(node.depth, 4) * 0.18;
  const baseGlow = dimmed ? 0.12 : active ? 1.5 : 0.75;

  useFrame(({ clock }) => {
    const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * speed + phase);

    const coreMaterial = core.current?.material as
      | MeshStandardMaterial
      | undefined;
    if (coreMaterial) {
      coreMaterial.emissiveIntensity = baseGlow + pulse * (dimmed ? 0.1 : 0.9);
    }

    if (halo.current) {
      halo.current.scale.setScalar(1 + pulse * 0.28);
      const haloMaterial = halo.current.material as MeshBasicMaterial;
      haloMaterial.opacity =
        (dimmed ? 0.03 : active ? 0.2 : 0.11) + pulse * (dimmed ? 0.01 : 0.09);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={core}
        geometry={CORE_GEOMETRY}
        scale={radius}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(node.id);
        }}
        onPointerOut={() => onHover(null)}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={baseGlow}
          roughness={0.35}
          metalness={0.1}
          transparent
          opacity={dimmed ? 0.25 : 1}
        />
      </mesh>

      {/* No handlers, so R3F skips it when dispatching pointer events. */}
      <mesh ref={halo} geometry={HALO_GEOMETRY} scale={radius * 2.4}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>

      {showLabel && (
        <Html
          center
          position={[0, radius * 2.6, 0]}
          distanceFactor={520}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <span
            className={`whitespace-nowrap rounded-md px-2 py-1 text-[13px] font-medium tracking-tight backdrop-blur-sm ${
              selected || hovered
                ? "bg-slate-950/85 text-slate-50 ring-1 ring-cyan-400/40"
                : "bg-slate-950/60 text-slate-300"
            }`}
          >
            {node.title}
          </span>
        </Html>
      )}
    </group>
  );
}
