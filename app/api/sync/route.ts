import { NextResponse } from "next/server";

import { syncNotionSubtree } from "@/lib/notion/sync";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
/** Vercel's ceiling on Hobby, and the default on every plan. */
export const maxDuration = 300;

/**
 * Headroom so the crawl stops cleanly before the platform kills the function.
 * A full crawl is bounded by Notion's ~3 req/s limit, not by our own work.
 */
const TIME_BUDGET_MS = 270_000;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncNotionSubtree({
      deadline: Date.now() + TIME_BUDGET_MS,
    });

    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    console.error("[api/sync]", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
