"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";

import {
  GraphControls,
  type GraphFilter,
} from "@/components/graph/GraphControls";
import { NeuronNode } from "@/components/graph/NeuronNode";
import { SidePanel } from "@/components/graph/SidePanel";
import { SynapseEdges } from "@/components/graph/SynapseEdge";
import { BACKGROUND } from "@/components/graph/theme";
import {
  boundsOf,
  computeLayout,
  type Layout,
  type Vec3,
} from "@/lib/graph/layout";
import type { GraphNode, GraphPayload, SyncSummary } from "@/lib/graph/types";
import { nodeRadius } from "@/lib/graph/weights";
import { createClient } from "@/utils/supabase/client";

/** Opening the app re-syncs only when the last crawl is older than this. */
const STALE_AFTER_MS = 10 * 60 * 1000;
const STATUS_LINGER_MS = 9000;

type Focus = { center: Vec3; radius: number; nonce: number };

type ControlsLike = { target: Vector3; update: () => void } | null;

function CameraRig({ focus }: { focus: Focus | null }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as ControlsLike;

  const desiredTarget = useRef(new Vector3());
  const desiredPosition = useRef(new Vector3());
  const animating = useRef(false);

  useEffect(() => {
    if (!focus || !controls) return;

    desiredTarget.current.set(focus.center.x, focus.center.y, focus.center.z);

    // Preserve the current viewing angle and only change where and how close.
    const direction = camera.position.clone().sub(controls.target);
    if (direction.lengthSq() < 1) direction.set(0.35, 0.5, 1);
    direction.normalize();

    desiredPosition.current
      .copy(desiredTarget.current)
      .addScaledVector(direction, focus.radius * 2.4 + 180);

    animating.current = true;
  }, [focus, camera, controls]);

  useFrame((_, delta) => {
    if (!animating.current || !controls) return;

    // Frame-rate independent easing.
    const alpha = 1 - Math.pow(0.0015, Math.min(delta, 0.1));
    controls.target.lerp(desiredTarget.current, alpha);
    camera.position.lerp(desiredPosition.current, alpha);
    controls.update();

    if (camera.position.distanceTo(desiredPosition.current) < 1) {
      animating.current = false;
    }
  });

  return null;
}

export function GraphCanvas() {
  const router = useRouter();

  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const [layoutState, setLayoutState] = useState<{
    source: GraphPayload;
    layout: Layout;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GraphFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);

  const nonce = useRef(0);
  const autoSynced = useRef(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((message: string | null) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus(message);

    if (message) {
      statusTimer.current = setTimeout(() => setStatus(null), STATUS_LINGER_MS);
    }
  }, []);

  const loadGraph = useCallback(async () => {
    try {
      const response = await fetch("/api/graph", { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Could not load the graph.");
      }

      setPayload((await response.json()) as GraphPayload);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the graph.");
    } finally {
      setLoading(false);
    }
  }, []);

  const runSync = useCallback(async () => {
    setSyncing(true);
    announce("Crawling Notion…");

    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const body = await response.json().catch(() => null);

      if (!response.ok) throw new Error(body?.error ?? "Sync failed.");

      const summary = body as SyncSummary;
      announce(
        `+${summary.pagesAdded} new · ${summary.pagesChanged} changed · ${summary.pagesUnchanged} unchanged`,
      );
      await loadGraph();
    } catch (cause) {
      announce(cause instanceof Error ? cause.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }, [announce, loadGraph]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!payload || autoSynced.current) return;
    autoSynced.current = true;

    const stale =
      !payload.lastSyncedAt ||
      Date.now() - Date.parse(payload.lastSyncedAt) > STALE_AFTER_MS;

    if (stale) void runSync();
  }, [payload, runSync]);

  // The solver blocks for a moment, so let the loading state paint first.
  useEffect(() => {
    if (!payload) return;

    const handle = requestAnimationFrame(() => {
      setLayoutState({
        source: payload,
        layout: computeLayout(payload.nodes, payload.edges),
      });
    });

    return () => cancelAnimationFrame(handle);
  }, [payload]);

  const layout = layoutState?.source === payload ? layoutState.layout : null;

  const nodesById = useMemo(
    () => new Map((payload?.nodes ?? []).map((node) => [node.id, node])),
    [payload],
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string, GraphNode[]>();

    for (const node of payload?.nodes ?? []) {
      if (!node.parentId) continue;
      const siblings = map.get(node.parentId);
      if (siblings) siblings.push(node);
      else map.set(node.parentId, [node]);
    }

    for (const siblings of map.values()) {
      siblings.sort((a, b) => a.title.localeCompare(b.title));
    }

    return map;
  }, [payload]);

  const visibleIds = useMemo(() => {
    const ids = new Set<string>();
    if (!payload) return ids;

    if (filter === "all") {
      for (const node of payload.nodes) ids.add(node.id);
      return ids;
    }

    // Keep each match's ancestors so the branch stays attached to the root.
    for (const node of payload.nodes) {
      if (!node.observability) continue;

      let current: GraphNode | undefined = node;
      while (current && !ids.has(current.id)) {
        ids.add(current.id);
        current = current.parentId ? nodesById.get(current.parentId) : undefined;
      }
    }

    return ids;
  }, [payload, filter, nodesById]);

  const visibleNodes = useMemo(
    () => (payload?.nodes ?? []).filter((node) => visibleIds.has(node.id)),
    [payload, visibleIds],
  );

  const radii = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of payload?.nodes ?? []) {
      map.set(
        node.id,
        nodeRadius({ edgeCount: node.edgeCount, hubScore: node.hubScore }),
      );
    }
    return map;
  }, [payload]);

  const selected = selectedId ? (nodesById.get(selectedId) ?? null) : null;
  const selectedChildren = useMemo(
    () => (selectedId ? (childrenByParent.get(selectedId) ?? []) : []),
    [selectedId, childrenByParent],
  );
  const selectedParent = selected?.parentId
    ? (nodesById.get(selected.parentId) ?? null)
    : null;

  const activeIds = useMemo(() => {
    const ids = new Set<string>();
    if (!selected) return ids;

    ids.add(selected.id);
    if (selected.parentId) ids.add(selected.parentId);
    for (const child of selectedChildren) ids.add(child.id);

    return ids;
  }, [selected, selectedChildren]);

  const visibleEdgeCount = useMemo(
    () =>
      (payload?.edges ?? []).filter(
        (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
      ).length,
    [payload, visibleIds],
  );

  const focusOn = useCallback(
    (ids: string[]) => {
      if (!layout) return;

      nonce.current += 1;
      const bounds = boundsOf(layout, ids);
      setFocus({ ...bounds, nonce: nonce.current });
    },
    [layout],
  );

  const resetView = useCallback(() => {
    setSelectedId(null);
    focusOn(visibleNodes.map((node) => node.id));
  }, [focusOn, visibleNodes]);

  const selectNode = useCallback(
    (id: string) => {
      setSelectedId(id);
      const children = childrenByParent.get(id) ?? [];
      focusOn([id, ...children.map((child) => child.id)]);
    },
    [childrenByParent, focusOn],
  );

  // Frame the whole graph once the first layout is ready.
  const framedFor = useRef<Layout | null>(null);
  useEffect(() => {
    if (!layout || framedFor.current === layout || visibleNodes.length === 0) {
      return;
    }

    framedFor.current = layout;
    nonce.current += 1;
    setFocus({
      ...boundsOf(
        layout,
        visibleNodes.map((node) => node.id),
      ),
      nonce: nonce.current,
    });
  }, [layout, visibleNodes]);

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
    router.replace("/login");
  }, [router]);

  const isEmpty = Boolean(payload && payload.nodes.length === 0);

  return (
    <div
      className="relative h-dvh w-full overflow-hidden"
      style={{ background: BACKGROUND }}
    >
      {layout && (
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 400, 1500], fov: 55, near: 1, far: 12000 }}
          onPointerMissed={() => setSelectedId(null)}
        >
          <color attach="background" args={[BACKGROUND]} />
          <fog attach="fog" args={[BACKGROUND, 1400, 5200]} />

          <ambientLight intensity={0.4} />
          <pointLight position={[0, 0, 0]} intensity={2.4} distance={2600} color="#7dd3fc" />
          <pointLight position={[600, 500, 700]} intensity={0.9} color="#c4b5fd" />

          <SynapseEdges
            edges={payload?.edges ?? []}
            layout={layout}
            visibleIds={visibleIds}
            activeIds={activeIds}
          />

          {visibleNodes.map((node) => {
            const position = layout.get(node.id);
            if (!position) return null;

            const radius = radii.get(node.id) ?? 8;
            const isSelected = node.id === selectedId;
            const isHovered = node.id === hoveredId;

            return (
              <NeuronNode
                key={node.id}
                node={node}
                position={[position.x, position.y, position.z]}
                radius={radius}
                selected={isSelected}
                hovered={isHovered}
                active={activeIds.size === 0 || activeIds.has(node.id)}
                dimmed={activeIds.size > 0 && !activeIds.has(node.id)}
                showLabel={
                  isSelected ||
                  isHovered ||
                  node.depth === 0 ||
                  (node.depth === 1 && activeIds.size === 0) ||
                  activeIds.has(node.id)
                }
                onSelect={selectNode}
                onHover={setHoveredId}
              />
            );
          })}

          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.7}
            zoomSpeed={0.9}
            minDistance={60}
            maxDistance={5000}
          />
          <CameraRig focus={focus} />
        </Canvas>
      )}

      <GraphControls
        filter={filter}
        onFilterChange={setFilter}
        onSync={() => void runSync()}
        onResetView={resetView}
        onSignOut={() => void signOut()}
        syncing={syncing}
        status={status}
        visibleNodes={visibleNodes.length}
        totalNodes={payload?.nodes.length ?? 0}
        visibleEdges={visibleEdgeCount}
        lastSyncedAt={payload?.lastSyncedAt ?? null}
      />

      <SidePanel
        node={selected}
        parent={selectedParent}
        childPages={selectedChildren}
        onSelect={selectNode}
        onClose={() => setSelectedId(null)}
      />

      {(loading || (payload && !layout)) && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p className="animate-pulse font-mono text-xs text-cyan-300/80">
            {loading ? "loading graph…" : "growing connections…"}
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-red-400/25 bg-slate-950/85 p-5 text-center backdrop-blur-md">
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadGraph();
              }}
              className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-400/40"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {isEmpty && !error && !syncing && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-white/10 bg-slate-950/80 p-6 text-center backdrop-blur-md">
            <h2 className="text-sm font-semibold text-slate-100">
              No neurons yet
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Run a sync to crawl your Notion root page and grow the graph. Make
              sure <code className="text-cyan-300">NOTION_API_KEY</code> and{" "}
              <code className="text-cyan-300">
                NOTION_OBSERVABILITY_ROOT_PAGE_ID
              </code>{" "}
              are set, and that the page is shared with your integration.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
