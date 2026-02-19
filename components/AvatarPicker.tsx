"use client";

import { createAvatar } from "@dicebear/core";
import { personas } from "@dicebear/collection";
import { useMemo } from "react";

const AVATAR_SEEDS = [
  "sunflower",
  "ocean",
  "mountain",
  "forest",
  "starlight",
  "river",
  "meadow",
  "thunder",
  "crystal",
  "ember",
  "frost",
  "aurora",
  "coral",
  "mist",
  "flame",
  "wave",
];

function AvatarImage({
  seed,
  size = 64,
  selected,
  onClick,
}: {
  seed: string;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  const dataUri = useMemo(
    () =>
      createAvatar(personas, {
        seed,
        size,
        radius: 50,
        randomizeIds: true,
      }).toDataUri(),
    [seed, size]
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border-2 p-1 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
        selected
          ? "border-emerald-500 ring-2 ring-emerald-500 ring-offset-2"
          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
      }`}
    >
      <img
        src={dataUri}
        alt={`Avatar ${seed}`}
        className="rounded-full"
        width={size}
        height={size}
      />
    </button>
  );
}

export function AvatarPicker({
  selectedSeed,
  onSelect,
}: {
  selectedSeed: string | null;
  onSelect: (seed: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Choose your avatar
      </p>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-4">
        {AVATAR_SEEDS.map((seed) => (
          <AvatarImage
            key={seed}
            seed={seed}
            selected={selectedSeed === seed}
            onClick={() => onSelect(seed)}
          />
        ))}
      </div>
    </div>
  );
}

export function UserAvatar({
  seed,
  size = 40,
  className = "",
}: {
  seed: string;
  size?: number;
  className?: string;
}) {
  const dataUri = useMemo(
    () =>
      createAvatar(personas, {
        seed,
        size,
        radius: 50,
        randomizeIds: true,
      }).toDataUri(),
    [seed, size]
  );

  return (
    <img
      src={dataUri}
      alt="Avatar"
      className={`rounded-full ${className}`}
      width={size}
      height={size}
    />
  );
}
