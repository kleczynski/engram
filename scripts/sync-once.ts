import { syncNotionSubtree } from "@/lib/notion/sync";

async function main() {
  const started = Date.now();
  const summary = await syncNotionSubtree({ deadline: Date.now() + 180_000 });

  console.log(JSON.stringify(summary, null, 2));
  console.log(`wall clock: ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((error) => {
  console.error("SYNC FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
