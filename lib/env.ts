// Server-only env access. Client code must reference `process.env.NEXT_PUBLIC_*`
// literally so the bundler can inline it — a computed lookup is never replaced.

// `.env.local` ships with elided placeholders like `secret_...` and `eyJ...`.
// Treating those as missing turns a confusing downstream 401 into a clear error.
const PLACEHOLDER = /(^$|\.\.\.$|^replace_me$|_replace_me$)/;

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value || PLACEHOLDER.test(value)) {
    throw new Error(
      `Environment variable ${name} is ${value ? "still a placeholder" : "missing"}. ` +
        `Set a real value in .env.local — see .env.local.example.`,
    );
  }

  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return !value || PLACEHOLDER.test(value) ? undefined : value;
}

/** Optional keys that should still be called out when unset. */
export function optionalEnvWarned(name: string): string | undefined {
  const value = optionalEnv(name);
  if (!value) {
    console.warn(
      `[engram] ${name} is missing. Sync will continue without it — see .env.local.example.`,
    );
  }
  return value;
}
