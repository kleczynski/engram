import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "Graph — Engram" };

export default async function GraphPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <GraphCanvas hasSession={Boolean(user)} />;
}
