import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/utils/supabase/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        // Gates auth.signInWithPasskey() / auth.registerPasskey().
        experimental: { passkey: true },
      },
    },
  );
}
