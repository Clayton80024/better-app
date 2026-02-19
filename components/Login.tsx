"use client";

import { useState, useRef } from "react";
import { db } from "@/lib/db";

type Step = "email" | "code";

export function Login() {
  const [step, setStep] = useState<Step>("email");
  const [sentEmail, setSentEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendCode(email: string) {
    setError("");
    setLoading(true);
    try {
      await db.auth.sendMagicCode({ email });
      setSentEmail(email);
      setStep("code");
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "body" in err
        ? (err as { body?: { message?: string } }).body?.message
        : "Failed to send code";
      setError(message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(code: string) {
    setError("");
    setLoading(true);
    try {
      await db.auth.signInWithMagicCode({ email: sentEmail, code });
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "body" in err
        ? (err as { body?: { message?: string } }).body?.message
        : "Invalid code";
      setError(message || "Invalid code. Please try again.");
      setLoading(false);
    }
  }

  if (step === "email") {
    return (
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Sign in or create an account
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Enter your email and we&apos;ll send you a verification code
          </p>
        </div>

        <EmailStep onSubmit={handleSendCode} loading={loading} />

        {error && (
          <p className="text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Enter your code
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          We sent a code to <strong>{sentEmail}</strong>
        </p>
      </div>

      <CodeStep onSubmit={handleVerifyCode} loading={loading} />

      {error && (
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          setStep("email");
          setSentEmail("");
          setError("");
        }}
        className="w-full text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
      >
        Use a different email
      </button>
    </div>
  );
}

function EmailStep({
  onSubmit,
  loading,
}: {
  onSubmit: (email: string) => void;
  loading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = inputRef.current?.value?.trim();
    if (email) onSubmit(email);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        ref={inputRef}
        type="email"
        placeholder="you@example.com"
        required
        autoFocus
        className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 placeholder-zinc-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? "Sending..." : "Send code"}
      </button>
    </form>
  );
}

function CodeStep({
  onSubmit,
  loading,
}: {
  onSubmit: (code: string) => void;
  loading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = inputRef.current?.value?.trim();
    if (code) onSubmit(code);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        ref={inputRef}
        type="text"
        placeholder="Enter 6-digit code"
        required
        autoFocus
        maxLength={6}
        className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-center text-lg tracking-widest text-zinc-900 placeholder-zinc-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? "Verifying..." : "Verify"}
      </button>
    </form>
  );
}
