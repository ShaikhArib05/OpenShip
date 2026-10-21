"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";

interface Ctx {
  workspaces: Workspace[];
  current: Workspace;
  setCurrentId: (id: string) => void;
  refresh: (selectId?: string) => Promise<void>;
}

const WorkspaceContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "openship.workspace";

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

export function CreateWorkspaceForm({
  onCreated,
  submitLabel = "Create workspace",
}: {
  onCreated: (ws: Workspace) => void;
  submitLabel?: string;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const ws = await api<Workspace>("/workspaces", { method: "POST", body: { name: name.trim() } });
      onCreated(ws);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create workspace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Workspace name"
        required
        maxLength={80}
      />
      <Button type="submit" disabled={busy || !name.trim()}>
        {busy ? "Creating…" : submitLabel}
      </Button>
    </form>
  );
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [currentId, setCurrentIdState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (selectId?: string) => {
    try {
      const list = await api<Workspace[]>("/workspaces");
      setWorkspaces(list);
      setError(null);
      const stored = selectId ?? localStorage.getItem(STORAGE_KEY);
      const pick = list.find((w) => w.id === stored) ?? list[0];
      setCurrentIdState(pick?.id ?? null);
      if (pick) localStorage.setItem(STORAGE_KEY, pick.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspaces");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const setCurrentId = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setCurrentIdState(id);
  };

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => void refresh()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!workspaces) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const current = workspaces.find((w) => w.id === currentId);
  if (!current) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create your first workspace</CardTitle>
            <CardDescription>
              A workspace holds your projects and teammates. You can create more later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateWorkspaceForm onCreated={(ws) => void refresh(ws.id)} />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <WorkspaceContext.Provider value={{ workspaces, current, setCurrentId, refresh }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
