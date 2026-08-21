"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";

type Busy = "passkey" | "email" | "enroll" | null;
type Notice = { kind: "error" | "info"; text: string } | null;

export default function LoginPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [email, setEmail] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [next] = useState(() => {
    if (typeof window === "undefined") return "/graph";
    const target = new URLSearchParams(window.location.search).get("next");
    return target?.startsWith("/") ? target : "/graph";
  });

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setChecking(false);
    });

    return () => {
      active = false;
    };
  }, [supabase]);

  const signInWithPasskey = useCallback(async () => {
    setBusy("passkey");
    setNotice(null);

    const { data, error } = await supabase.auth.signInWithPasskey();
    setBusy(null);

    if (error) {
      setShowEmail(true);
      setNotice({
        kind: "error",
        text: `${error.message} If this is a new device, sign in by email once and then add a passkey.`,
      });
      return;
    }

    if (data?.session) router.replace(next);
  }, [supabase, router, next]);

  const sendMagicLink = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setBusy("email");
      setNotice(null);

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Deliberately query-free: the email template appends
          // `?token_hash=…`, and the callback route already defaults to /graph.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      setBusy(null);
      setNotice(
        error
          ? { kind: "error", text: error.message }
          : { kind: "info", text: `Check ${email} for a sign-in link.` },
      );
    },
    [supabase, email],
  );

  const addPasskey = useCallback(async () => {
    setBusy("enroll");
    setNotice(null);

    const { error } = await supabase.auth.registerPasskey();
    setBusy(null);

    setNotice(
      error
        ? { kind: "error", text: error.message }
        : { kind: "info", text: "Passkey saved. Next time, one tap is enough." },
    );
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setNotice(null);
  }, [supabase]);

  return (
    <main className="neural-backdrop flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300/70 transition-colors hover:text-cyan-200"
        >
          engram
        </Link>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-50">
          {user ? "You're signed in" : "Sign in"}
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {user
            ? user.email ?? "Signed in."
            : "Engram uses passkeys — your device authenticates you, no password to remember."}
        </p>

        <div className="mt-7 space-y-3">
          {user ? (
            <>
              <Link
                href={next}
                className="block rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-center text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20"
              >
                Open the graph
              </Link>

              <button
                type="button"
                onClick={() => void addPasskey()}
                disabled={busy !== null}
                className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-white/25 disabled:opacity-60"
              >
                {busy === "enroll" ? "Waiting for device…" : "Add a passkey to this device"}
              </button>

              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full px-4 py-2 text-xs text-slate-500 transition-colors hover:text-slate-300"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void signInWithPasskey()}
                disabled={busy !== null || checking}
                className="w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20 disabled:opacity-60"
              >
                {busy === "passkey" ? "Waiting for device…" : "Continue with passkey"}
              </button>

              {showEmail ? (
                <form onSubmit={sendMagicLink} className="space-y-2 pt-1">
                  <label
                    htmlFor="email"
                    className="block text-[11px] uppercase tracking-wider text-slate-500"
                  >
                    Email sign-in link
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/40"
                  />
                  <button
                    type="submit"
                    disabled={busy !== null}
                    className="w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-white/25 disabled:opacity-60"
                  >
                    {busy === "email" ? "Sending…" : "Send link"}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEmail(true)}
                  className="w-full px-4 py-2 text-xs text-slate-500 transition-colors hover:text-slate-300"
                >
                  Use email instead
                </button>
              )}
            </>
          )}
        </div>

        {notice && (
          <p
            className={`mt-5 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
              notice.kind === "error"
                ? "border-red-400/25 bg-red-500/5 text-red-300"
                : "border-cyan-400/25 bg-cyan-500/5 text-cyan-200"
            }`}
          >
            {notice.text}
          </p>
        )}
      </div>
    </main>
  );
}
