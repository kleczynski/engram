/**
 * Mints a single-use sign-in link without sending email, for when the built-in
 * Supabase mailer is rate limited.
 *
 *   npx tsx --env-file=.env.local scripts/login-link.ts [email] [origin]
 */
import { createAdminClient } from "@/utils/supabase/server";

const DEFAULT_ORIGIN = "https://engram-ten-alpha.vercel.app";

async function main() {
  const supabase = createAdminClient();
  const emailArg = process.argv[2];
  const origin = process.argv[3] ?? DEFAULT_ORIGIN;

  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw new Error(`Could not list users: ${listError.message}`);

  const existing = list.users;
  console.log(`existing users: ${existing.length}`);
  for (const user of existing) {
    console.log(
      `  ${user.email}  confirmed=${Boolean(user.email_confirmed_at)}  created=${user.created_at}`,
    );
  }

  const email = emailArg ?? existing[0]?.email;
  if (!email) {
    throw new Error(
      "No users exist yet and no email was passed. Re-run with: scripts/login-link.ts you@example.com",
    );
  }

  let user = existing.find((candidate) => candidate.email === email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) throw new Error(`Could not create user: ${error.message}`);
    user = data.user;
    console.log(`\ncreated confirmed user ${email}`);
  } else if (!user.email_confirmed_at) {
    // registerPasskey() refuses to run for an unconfirmed user.
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });
    if (error) throw new Error(`Could not confirm user: ${error.message}`);
    console.log(`\nconfirmed existing user ${email}`);
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) throw new Error(`Could not generate link: ${error.message}`);

  const tokenHash = data.properties.hashed_token;
  console.log(`\nopen this once, in a browser:\n`);
  console.log(
    `${origin}/auth/callback?token_hash=${tokenHash}&type=magiclink\n`,
  );
  console.log(`(one-time use; also usable as OTP code ${data.properties.email_otp})`);
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
