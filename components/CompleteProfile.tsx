"use client";

import { useState, useCallback, useRef } from "react";
import { db } from "@/lib/db";
import { AvatarPicker } from "./AvatarPicker";

type User = {
  id: string;
  email?: string | null;
  nickname?: string | null;
  avatarSeed?: string | null;
  username?: string | null;
};

const USERNAME_REGEX = /^[a-z0-9_]+$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;

function normalizeUsername(input: string): string {
  return input
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, USERNAME_MAX);
}

export function CompleteProfile({ user }: { user: User }) {
  const [nickname, setNickname] = useState(user.nickname || "");
  const [usernameInput, setUsernameInput] = useState(user.username ? `@${user.username}` : "");
  const [avatarSeed, setAvatarSeed] = useState<string | null>(user.avatarSeed || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkAvailability = useCallback(async (raw: string) => {
    const username = normalizeUsername(raw);
    if (username.length < USERNAME_MIN) {
      setAvailability("idle");
      return;
    }
    if (!USERNAME_REGEX.test(username)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    try {
      const params = new URLSearchParams({ username });
      params.set("excludeUserId", user.id);
      const res = await fetch(`/api/check-username?${params}`);
      const data = await res.json();
      if (res.status === 503) {
        setAvailability("idle");
        return;
      }
      setAvailability(data.available ? "available" : "taken");
    } catch {
      setAvailability("idle");
    }
  }, []);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const normalized = value.startsWith("@") ? value : value ? `@${value}` : "";
    setUsernameInput(normalized);
    setError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (normalized.length >= 2) {
      debounceRef.current = setTimeout(() => checkAvailability(normalized), 400);
    } else {
      setAvailability("idle");
    }
  };

  const handleUsernameBlur = () => {
    const username = normalizeUsername(usernameInput);
    if (username.length >= USERNAME_MIN) {
      checkAvailability(usernameInput);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const username = normalizeUsername(usernameInput);

    if (!nickname.trim()) {
      setError("Please enter a display name");
      return;
    }
    if (!avatarSeed) {
      setError("Please choose an avatar");
      return;
    }
    if (username.length < USERNAME_MIN) {
      setError(`Username must be at least ${USERNAME_MIN} characters`);
      return;
    }
    if (username.length > USERNAME_MAX) {
      setError(`Username must be at most ${USERNAME_MAX} characters`);
      return;
    }
    if (!USERNAME_REGEX.test(username)) {
      setError("Username can only use letters, numbers, and underscores");
      return;
    }
    if (availability === "taken") {
      setError("This username is already taken");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await db.transact([
        db.tx.$users[user.id].update({
          nickname: nickname.trim(),
          avatarSeed,
          username,
        }),
      ]);
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "";
      const isDuplicate =
        /unique|duplicate|already exists|constraint/i.test(message);
      setError(isDuplicate ? "This username is already taken" : "Failed to save profile");
      setLoading(false);
    }
  }

  const username = normalizeUsername(usernameInput);
  const canSubmit =
    nickname.trim() &&
    avatarSeed &&
    username.length >= USERNAME_MIN &&
    username.length <= USERNAME_MAX &&
    USERNAME_REGEX.test(username) &&
    availability !== "taken" &&
    availability !== "checking";

  return (
    <div className="w-full max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Complete your profile
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose a username, display name, and avatar to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="username"
            className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Username
          </label>
          <div className="relative">
            <input
              id="username"
              type="text"
              value={usernameInput}
              onChange={handleUsernameChange}
              onBlur={handleUsernameBlur}
              placeholder="@username"
              maxLength={USERNAME_MAX + 1}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 pr-24 text-zinc-900 placeholder-zinc-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
              {availability === "checking" && (
                <span className="text-zinc-400">Checking...</span>
              )}
              {availability === "available" && (
                <span className="text-emerald-600 dark:text-emerald-400">Available</span>
              )}
              {availability === "taken" && (
                <span className="text-red-600 dark:text-red-400">Taken</span>
              )}
              {availability === "invalid" && username.length > 0 && (
                <span className="text-amber-600 dark:text-amber-400">Invalid</span>
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            3–30 characters, letters, numbers, underscores only
          </p>
        </div>

        <div>
          <label
            htmlFor="nickname"
            className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Display name
          </label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="How should we call you?"
            maxLength={32}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 placeholder-zinc-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
          />
        </div>

        <AvatarPicker selectedSeed={avatarSeed} onSelect={setAvatarSeed} />

        {error && (
          <p className="text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
