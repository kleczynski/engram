import Link from "next/link";

export default function Home() {
  return (
    <main className="neural-backdrop flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300/70">
          notion · supabase · three.js
        </p>

        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
          Engram
        </h1>

        <p className="mt-4 text-balance text-sm leading-relaxed text-slate-400 sm:text-base">
          Your Notion workspace as a neural map. Pages become neurons that pulse
          with activity, and the links between them become synapses you can
          explore in three dimensions.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/graph"
            className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-2.5 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20"
          >
            Enter the graph
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-white/25 hover:text-slate-100"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
