"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function normalizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/";
  }

  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(normalizeNextPath(params.get("next")));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        setMessage("Supabase environment variables are missing.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)]">
        <h1 className="text-3xl text-[var(--foreground)]">Log in</h1>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-[var(--foreground)]">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-[var(--foreground)]">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none transition focus:border-[var(--primary-soft)] focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        {message ? (
          <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
            {message}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[var(--accent)]">
          <Link href="/signup">Create account</Link>
          <Link href="/forgot-password">Forgot password</Link>
        </div>
      </section>
    </main>
  );
}
