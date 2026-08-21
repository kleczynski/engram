"use client";

import type { GraphNode } from "@/lib/graph/types";

type Props = {
  node: GraphNode | null;
  parent: GraphNode | null;
  childPages: GraphNode[];
  onSelect: (id: string) => void;
  onClose: () => void;
};

function formatDate(iso: string | null): string {
  if (!iso) return "unknown";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SidePanel({
  node,
  parent,
  childPages,
  onSelect,
  onClose,
}: Props) {
  if (!node) return null;

  return (
    <aside className="pointer-events-auto absolute bottom-0 right-0 z-20 flex max-h-[70vh] w-full flex-col overflow-hidden border-t border-white/10 bg-slate-950/85 backdrop-blur-md sm:bottom-6 sm:right-6 sm:max-h-[calc(100vh-13rem)] sm:w-[22rem] sm:rounded-2xl sm:border">
      <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div className="min-w-0">
          {parent && (
            <button
              type="button"
              onClick={() => onSelect(parent.id)}
              className="mb-1 block max-w-full truncate text-left text-[11px] text-slate-500 transition-colors hover:text-cyan-300"
            >
              ↑ {parent.title}
            </button>
          )}
          <h2 className="text-sm font-semibold leading-snug text-slate-50">
            {node.title}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="shrink-0 rounded-md px-2 py-1 text-slate-500 transition-colors hover:text-slate-200"
        >
          ✕
        </button>
      </header>

      <div className="grid grid-cols-3 gap-px border-b border-white/10 bg-white/5">
        {[
          { label: "depth", value: node.depth },
          { label: "synapses", value: node.edgeCount },
          { label: "hub", value: node.hubScore.toFixed(1) },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-950/60 px-3 py-2.5">
            <p className="font-mono text-sm text-slate-100">{stat.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Last edited</dt>
            <dd className="text-slate-300">{formatDate(node.lastEditedTime)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Cluster</dt>
            <dd className="text-slate-300">
              {node.observability ? "Observability" : "General"}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {node.notionUrl && (
            <a
              href={node.notionUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
            >
              Open in Notion ↗
            </a>
          )}
          {node.lucidUrl && (
            <a
              href={node.lucidUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 transition-colors hover:border-amber-400/40 hover:text-amber-200"
            >
              Lucid diagram ↗
            </a>
          )}
        </div>

        {childPages.length > 0 && (
          <section className="mt-5">
            <h3 className="text-[10px] uppercase tracking-wider text-slate-500">
              {childPages.length} child{" "}
              {childPages.length === 1 ? "page" : "pages"}
            </h3>
            <ul className="mt-2 space-y-1">
              {childPages.map((child) => (
                <li key={child.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(child.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-50"
                  >
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${
                        child.observability ? "bg-cyan-400" : "bg-violet-400"
                      }`}
                    />
                    <span className="truncate">{child.title}</span>
                    {child.childCount > 0 && (
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-500">
                        {child.childCount}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}
