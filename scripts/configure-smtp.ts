/**
 * Points Supabase Auth at Resend over SMTP, replacing the shared development
 * mailer and its ~2/hour cap.
 *
 *   npx tsx --env-file=.env.local scripts/configure-smtp.ts
 *
 * Needs RESEND_API_KEY and SUPABASE_ACCESS_TOKEN (a personal access token from
 * https://supabase.com/dashboard/account/tokens — the service role key is not
 * accepted by the Management API).
 */
import { requireEnv } from "@/lib/env";

const SMTP_HOST = "smtp.resend.com";
/**
 * Implicit TLS from the first byte, which is Resend's recommendation. The
 * Management API rejects a number here even though its docs show one.
 */
const SMTP_PORT = "465";
/** Resend authenticates by API key, so the user is this literal string. */
const SMTP_USER = "resend";
const SENDER_NAME = "Engram";
/** Supabase drops to 30/hour when custom SMTP is first enabled. */
const EMAILS_PER_HOUR = 50;

type ResendDomain = { name: string; status: string };

function projectRef(): string {
  const url = new URL(requireEnv("NEXT_PUBLIC_SUPABASE_URL"));
  return url.hostname.split(".")[0];
}

async function resolveSender(resendKey: string): Promise<string> {
  const response = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${resendKey}` },
  });

  if (!response.ok) {
    throw new Error(
      `Resend rejected the API key (${response.status}). Check it has sending access.`,
    );
  }

  const body = (await response.json()) as { data?: ResendDomain[] };
  const domains = body.data ?? [];

  console.log(`resend domains: ${domains.length}`);
  for (const domain of domains) {
    console.log(`  ${domain.name.padEnd(28)} ${domain.status}`);
  }

  const verified = domains.find((domain) => domain.status === "verified");

  if (verified) return `no-reply@${verified.name}`;

  // Resend has no shared sender; this fallback only delivers to the address
  // that owns the Resend account.
  console.log(
    "\nNo verified domain, falling back to onboarding@resend.dev.\n" +
      "That address can only deliver to your own Resend account email.",
  );
  return "onboarding@resend.dev";
}

async function main() {
  const resendKey = requireEnv("RESEND_API_KEY");
  const accessToken = requireEnv("SUPABASE_ACCESS_TOKEN");
  const ref = projectRef();

  const sender = await resolveSender(resendKey);
  console.log(`\nsender: ${sender}`);

  const endpoint = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_email_enabled: true,
      smtp_admin_email: sender,
      smtp_host: SMTP_HOST,
      smtp_port: SMTP_PORT,
      smtp_user: SMTP_USER,
      smtp_pass: resendKey,
      smtp_sender_name: SENDER_NAME,
      rate_limit_email_sent: EMAILS_PER_HOUR,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Supabase rejected the update (${response.status}): ${await response.text()}`,
    );
  }

  const config = (await response.json()) as Record<string, unknown>;

  console.log("\n=== applied ===");
  for (const key of [
    "external_email_enabled",
    "smtp_host",
    "smtp_port",
    "smtp_user",
    "smtp_admin_email",
    "smtp_sender_name",
    "rate_limit_email_sent",
    "mailer_autoconfirm",
  ]) {
    console.log(`  ${key.padEnd(24)} ${String(config[key])}`);
  }
  console.log(`  ${"smtp_pass".padEnd(24)} ${config.smtp_pass ? "set" : "NOT SET"}`);
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
