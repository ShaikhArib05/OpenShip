"use client";

import { Archive, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { KanbanBoard } from "@/components/kanban-board";
import { TaskDialog } from "@/components/task-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { Member, Project, Task, TaskStatus } from "@/lib/types";

interface DialogState {
  task: Task | null;
  status: TaskStatus;
  key: number;
}

export function ProjectView({ id }: { id: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await api<Project>(`/projects/${id}`);
        setProject(p);
        const [ts, ms] = await Promise.all([
          api<Task[]>(`/projects/${id}/tasks`),
          api<Member[]>(`/workspaces/${p.workspace_id}/members`),
        ]);
        setTasks(ts);
        setMembers(ms);
      } catch (e) {
        setError(e instanceof ApiError && e.status < 500 ? "Project not found or you don't have access." : (e as Error).message);
      }
    })();
  }, [id]);

  function openDialog(task: Task | null, status: TaskStatus = "todo") {
    setDialog({ task, status, key: Date.now() });
  }

  function onSaved(saved: Task) {
    setTasks((ts) => (ts?.some((t) => t.id === saved.id) ? ts.map((t) => (t.id === saved.id ? saved : t)) : [...(ts ?? []), saved]));
    toast.success("Task saved");
  }

  async function archive() {
    try {
      await api(`/projects/${id}`, { method: "PATCH", body: { archived: true } });
      toast.success("Project archived");
      router.push("/projects");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not archive project");
    }
  }

  async function remove() {
    if (!confirm("Delete this project and all of its tasks? This cannot be undone.")) return;
    try {
      await api(`/projects/${id}`, { method: "DELETE" });
      toast.success("Project deleted");
      router.push("/projects");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete project");
    }
  }

  if (error)
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/projects" className="text-sm text-primary hover:underline">
          Back to projects
        </Link>
      </div>
    );
  if (!project || !tasks) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.description ?? "No description"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => openDialog(null)}>
            <Plus className="size-4" /> New task
          </Button>
          <Button variant="outline" size="sm" onClick={archive}>
            <Archive className="size-4" /> Archive
          </Button>
          {project.role === "owner" && (
            <Button variant="outline" size="sm" onClick={remove}>
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      <KanbanBoard
        tasks={tasks}
        setTasks={setTasks as React.Dispatch<React.SetStateAction<Task[]>>}
        members={members}
        onOpen={(t) => openDialog(t)}
        onAdd={(s) => openDialog(null, s)}
      />

      {dialog && (
        <TaskDialog
          key={dialog.key}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          projectId={id}
          task={dialog.task}
          defaultStatus={dialog.status}
          members={members}
          onSaved={onSaved}
          onDeleted={(tid) => {
            setTasks((ts) => ts?.filter((t) => t.id !== tid) ?? null);
            toast.success("Task deleted");
          }}
        />
      )}
    </div>
  );
}
