"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreateWorkspace } from "@/components/CreateWorkspace";
import { UserAvatar } from "@/components/AvatarPicker";
import { MessageNotificationProvider } from "@/components/MessageNotificationProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InstalloLogo } from "@/components/InstalloLogo";
import { UploadIndicator } from "@/components/UploadIndicator";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { useWorkspace } from "@/components/WorkspaceContext";
import { db } from "@/lib/db";

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = db.useAuth();
  const { workspaces, currentWorkspace, isLoading } = useWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  function handleSignOut() {
    setShowSignOutConfirm(false);
    setMobileMenuOpen(false);
    db.auth.signOut();
  }
  const { data } = db.useQuery(
    user
      ? {
          $users: {
            $: { where: { id: user.id } },
          },
        }
      : null
  );
  const userWithProfile = user && data?.$users?.[0] ? { ...user, ...data.$users[0] } : null;
  const needsProfile =
    userWithProfile &&
    (!userWithProfile.avatarSeed ||
      !userWithProfile.nickname ||
      !userWithProfile.username);

  if (!userWithProfile) {
    return (
      <>
        <MessageNotificationProvider />
        <div className="fixed right-4 top-4 z-50">
          <ThemeToggle />
        </div>
        {children}
      </>
    );
  }

  if (!isLoading && workspaces.length === 0) {
    return (
      <>
        <MessageNotificationProvider />
        <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
            <div className="flex items-center gap-1">
              <InstalloLogo className="text-zinc-900 dark:text-zinc-50" />
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Installo</span>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={() => setShowSignOutConfirm(true)}
                className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </div>
          </header>
          <main className="flex flex-1 items-center justify-center p-4">
            <CreateWorkspace />
          </main>
        </div>
        {showSignOutConfirm && (
          <>
            <div
              className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm"
              onClick={() => setShowSignOutConfirm(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="signout-title"
              className="fixed left-1/2 top-1/2 z-[101] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
            >
              <h2 id="signout-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Sign out?
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Are you sure you want to sign out?
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  No
                </button>
                <button
                  onClick={handleSignOut}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                >
                  Yes
                </button>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  const casesHref = currentWorkspace ? `/workspace/${currentWorkspace.id}/cases` : "/cases";
  const navLinkClass = (active: boolean) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
    }`;

  return (
    <>
      <MessageNotificationProvider />
      <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          {/* Left: logo + desktop nav */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <Link
              href={casesHref}
              className="flex shrink-0 items-center gap-1 text-lg font-bold text-zinc-900 dark:text-zinc-50"
            >
              <InstalloLogo />
              Installo
            </Link>
            <div className="hidden md:block">
              <WorkspaceSwitcher />
            </div>
            {/* Desktop nav - hidden on mobile */}
            <nav className="hidden gap-1 md:flex">
              <Link
                href={casesHref}
                className={navLinkClass(pathname.includes("/cases"))}
              >
                Cases
              </Link>
              <Link
                href="/settings"
                className={navLinkClass(pathname === "/settings")}
              >
                Settings
              </Link>
            </nav>
          </div>

          {/* Right: desktop actions + mobile menu button */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <UploadIndicator />
            <ThemeToggle />
            <div className="hidden items-center gap-2 md:flex">
              <UserAvatar seed={userWithProfile.avatarSeed || "default"} size={32} />
              <div className="hidden text-left lg:block">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {userWithProfile.nickname}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {userWithProfile.username ? `@${userWithProfile.username}` : ""}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSignOutConfirm(true)}
              className="hidden rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 md:block"
            >
              Sign out
            </button>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 md:hidden"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <CloseIcon className="h-5 w-5" />
              ) : (
                <MenuIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </header>

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="fixed right-0 top-[57px] z-50 w-full max-w-[280px] border-b border-l border-zinc-200 bg-white py-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 md:hidden">
              <div className="px-3 pb-3">
                <UploadIndicator />
              </div>
              <nav className="flex flex-col gap-1 px-3">
                <Link
                  href={casesHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className={navLinkClass(pathname.includes("/cases"))}
                >
                  Cases
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className={navLinkClass(pathname === "/settings")}
                >
                  Settings
                </Link>
              </nav>
              <div className="mt-3 px-3">
                <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Workspace
                </p>
                <WorkspaceSwitcher />
              </div>
              <div className="mt-4 border-t border-zinc-200 px-3 pt-4 dark:border-zinc-800">
                <div className="mb-3 flex items-center gap-3">
                  <UserAvatar seed={userWithProfile.avatarSeed || "default"} size={40} />
                  <div>
                    {needsProfile ? (
                      <Link
                        href="/"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                      >
                        Complete profile →
                      </Link>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {userWithProfile.nickname}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {userWithProfile.username ? `@${userWithProfile.username}` : ""}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <button
                    onClick={() => setShowSignOutConfirm(true)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <main className="flex-1">{children}</main>
      </div>

      {/* Sign out confirmation dialog */}
      {showSignOutConfirm && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm"
            onClick={() => setShowSignOutConfirm(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-title"
            className="fixed left-1/2 top-1/2 z-[101] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h2 id="signout-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Sign out?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Are you sure you want to sign out?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                No
              </button>
              <button
                onClick={handleSignOut}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                Yes
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
