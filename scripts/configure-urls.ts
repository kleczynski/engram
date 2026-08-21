/**
 * Sets the Site URL, redirect allow list, and magic-link template so email
 * sign-in works from both production and localhost.
 *
 *   npx tsx --env-file=.env.local scripts/configure-urls.ts
 */
import { createClient } from "@supabase/supabase-js";

import { requireEnv } from "@/lib/env";
import { createAdminClient } from "@/utils/supabase/server";

const PRODUCTION_ORIGIN = "https://engram-ten-alpha.vercel.app";
const LOCAL_ORIGIN = "http://localhost:3000";

/** Allow-list entries match the full URL, so a bare origin never matches a path. */
const ALLOW_LIST = [`${PRODUCTION_ORIGIN}/**`, `${LOCAL_ORIGIN}/**`].join(",");

function authConfigUrl(): string {
  const ref = new URL(requireEnv("NEXT_PUBLIC_SUPABASE_URL")).hostname.split(".")[0];
  return `https://api.supabase.com/v1/projects/${ref}/config/auth`;
}

async function patch(body: Record<string, unknown>) {
  const response = await fetch(authConfigUrl(), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${requireEnv("SUPABASE_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

/**
 * `verifyOtp` needs the same `type` the template puts in the link, and the
 * naming for magic links is ambiguous — so ask the server which one it accepts.
 */
async function detectTokenType(email: string): Promise<"magiclink" | "email"> {
  const admin = createAdminClient();

  for (const type of ["magiclink", "email"] as const) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${PRODUCTION_ORIGIN}/auth/callback` },
    });

    if (error) throw new Error(`Could not generate a probe link: ${error.message}`);

    // A fresh client, so a failed attempt cannot poison a real session.
    const probe = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      { auth: { persistSession: false } },
    );

    const result = await probe.auth.verifyOtp({
      type,
      token_hash: data.properties.hashed_token,
    });

    console.log(
      `  type=${type.padEnd(9)} ${result.error ? `rejected (${result.error.message})` : "accepted"}`,
    );

    if (!result.error) return type;
  }

  throw new Error("Neither magiclink nor email was accepted.");
}

async function main() {
  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers();
  const email = list?.users[0]?.email;
  if (!email) throw new Error("No user to probe with.");

  console.log("probing which verifyOtp type accepts a magic-link hash:");
  const tokenType = await detectTokenType(email);
  console.log(`\nusing type=${tokenType}\n`);

  const template = [
    "<h2>Your sign-in link</h2>",
    "",
    "<p>Follow the link below to sign in. This link expires shortly and can only be used once.</p>",
    `<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=${tokenType}">Sign in</a></p>`,
  ].join("\n");

  const config = await patch({
    site_url: PRODUCTION_ORIGIN,
    uri_allow_list: ALLOW_LIST,
    mailer_templates_magic_link_content: template,
  });

  console.log("=== applied ===");
  console.log(`  site_url        ${config.site_url}`);
  console.log(`  uri_allow_list  ${config.uri_allow_list}`);
  console.log(`\n${config.mailer_templates_magic_link_content}`);
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
