"use client";

export type GraphFilter = "all" | "observability";

type Props = {
  filter: GraphFilter;
  onFilterChange: (filter: GraphFilter) => void;
  onSync: () => void;
  onResetView: () => void;
  onSignOut: () => void;
  syncing: boolean;
  status: string | null;
  visibleNodes: number;
  totalNodes: number;
  visibleEdges: number;
  lastSyncedAt: string | null;
  hasSession?: boolean;
};

const FILTERS: { value: GraphFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "observability", label: "Observability" },
];

function relativeTime(iso: string | null): string {
  if (!iso) return "never";

  const elapsed = Date.now() - Date.parse(iso);
  if (Number.isNaN(elapsed)) return "unknown";

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

export function GraphControls({
  filter,
  onFilterChange,
  onSync,
  onResetView,
  onSignOut,
  syncing,
  status,
  visibleNodes,
  totalNodes,
  visibleEdges,
  lastSyncedAt,
  hasSession = false,
}: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
      <div className="pointer-events-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-semibold tracking-tight text-slate-50">
            Engram
          </h1>
          <span className="text-[11px] uppercase tracking-[0.16em] text-cyan-300/70">
            knowledge graph
          </span>
        </div>

        <p className="mt-1 font-mono text-[11px] text-slate-400">
          {visibleNodes}/{totalNodes} neurons · {visibleEdges} synapses
        </p>

        <div className="mt-3 flex rounded-lg border border-white/10 p-0.5">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === option.value
                  ? "bg-cyan-400/15 text-cyan-200"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pointer-events-auto flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetView}
            className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs font-medium text-slate-300 backdrop-blur-md transition-colors hover:text-slate-50"
          >
            Reset view
          </button>

          {hasSession && (
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 backdrop-blur-md transition-colors hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className={syncing ? "inline-block animate-spin" : undefined}>
                ↻
              </span>
              {syncing ? "Syncing" : "Sync"}
            </button>
          )}

          {hasSession && (
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs font-medium text-slate-400 backdrop-blur-md transition-colors hover:text-slate-200"
            >
              Sign out
            </button>
          )}
        </div>

        <p className="rounded-lg bg-slate-950/60 px-2 py-1 font-mono text-[11px] text-slate-400 backdrop-blur-md">
          {status ?? `synced ${relativeTime(lastSyncedAt)}`}
        </p>
      </div>
    </div>
  );
}
