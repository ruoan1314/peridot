"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Reset email sent. Open the link in your inbox.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)]">
        <h1 className="text-3xl text-[var(--foreground)]">Forgot password</h1>

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

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {message ? (
          <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
            {message}
          </p>
        ) : null}

        <div className="mt-5 text-sm font-semibold text-[var(--accent)]">
          <Link href="/login">Back to log in</Link>
        </div>
      </section>
    </main>
  );
}
