"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { db } from "@/lib/db";

const WORKSPACE_KEY = "better-workspace";

type Workspace = {
  id: string;
  name: string;
  createdAt: number;
};

type WorkspaceContextValue = {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspaceId: (id: string) => void;
  isLoading: boolean;
  refreshWorkspaces: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = db.useAuth();
  const [currentWorkspaceId, setCurrentWorkspaceIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { data } = db.useQuery(
    user
      ? {
          workspaces: {
            $: {
              where: { "members.id": user.id },
              order: { serverCreatedAt: "asc" },
            },
          },
        }
      : null
  );

  const workspaces = (data?.workspaces ?? []) as unknown as Workspace[];

  useEffect(() => {
    if (!user) {
      setCurrentWorkspaceIdState(null);
      setIsLoading(false);
      return;
    }
    if (workspaces.length === 0) {
      setCurrentWorkspaceIdState(null);
      setIsLoading(false);
      return;
    }
    const stored = typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_KEY) : null;
    const validStored = stored && workspaces.some((w) => w.id === stored);
    if (validStored) {
      setCurrentWorkspaceIdState(stored);
    } else {
      setCurrentWorkspaceIdState(workspaces[0].id);
      if (typeof window !== "undefined") {
        localStorage.setItem(WORKSPACE_KEY, workspaces[0].id);
      }
    }
    setIsLoading(false);
  }, [user, workspaces]);

  function setCurrentWorkspaceId(id: string) {
    setCurrentWorkspaceIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(WORKSPACE_KEY, id);
    }
  }

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) ?? null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspaceId,
        isLoading,
        refreshWorkspaces: () => {},
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}
