import { redirect } from "next/navigation";

import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "Graph — Engram" };

export default async function GraphPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route; this keeps the page safe on its own.
  if (!user) redirect("/login?next=%2Fgraph");

  return <GraphCanvas />;
}
