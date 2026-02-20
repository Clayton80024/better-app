"use client";

import { ProfileForm } from "./ProfileForm";

type User = {
  id: string;
  email?: string | null;
  nickname?: string | null;
  avatarSeed?: string | null;
  username?: string | null;
};

export function CompleteProfile({ user }: { user: User }) {
  return (
    <ProfileForm
      user={user}
      title="Complete your profile"
      subtitle="Choose a username, display name, and avatar to get started"
      submitLabel="Continue"
    />
  );
}
