"use client";

import { FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

function NewProjectDialog({ workspaceId, onCreated }: { workspaceId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api(`/workspaces/${workspaceId}/projects`, {
        method: "POST",
        body: {
          name: String(form.get("name")).trim(),
          description: String(form.get("description")).trim() || null,
        },
      });
      toast.success("Project created");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" /> New project
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Projects hold tasks, sprints and your board.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={80} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" name="description" maxLength={2000} rows={3} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating…" : "Create project"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectsPage() {
  const { current } = useWorkspace();
  const [projects, setProjects] = useState<Project[] | null>(null);

  const load = useCallback(async () => {
    try {
      setProjects(await api<Project[]>(`/workspaces/${current.id}/projects`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load projects");
      setProjects([]);
    }
  }, [current.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjects(null);
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <NewProjectDialog workspaceId={current.id} onCreated={() => void load()} />
      </div>

      {!projects && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {projects?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FolderKanban className="size-8 text-muted-foreground" />
            <p className="font-medium">No projects yet</p>
            <p className="text-sm text-muted-foreground">Create your first project to start planning work.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((p) => {
          const pct = p.task_count ? Math.round(((p.done_count ?? 0) / p.task_count) * 100) : 0;
          return (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="truncate">{p.name}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-8">
                    {p.description ?? "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Progress value={pct} />
                  <p className="text-xs text-muted-foreground">
                    {p.done_count ?? 0} of {p.task_count ?? 0} tasks done
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
