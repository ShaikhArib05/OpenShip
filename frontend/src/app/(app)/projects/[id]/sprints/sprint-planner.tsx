"use client";

import { ArrowLeft, Play, Plus, CheckCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { SimpleSelect } from "@/components/simple-select";
import { Badge } from "@/components/ui/badge";
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
import { api, ApiError } from "@/lib/api";
import type { Project, Sprint, Task } from "@/lib/types";

const BACKLOG = "backlog";
const iso = (d: Date) => d.toLocaleDateString("en-CA");
const fmt = (d: string) => new Date(d + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

function TaskRow({
  task,
  current,
  targets,
  disabled,
  onMove,
}: {
  task: Task;
  current: string;
  targets: { value: string; label: string }[];
  disabled?: boolean;
  onMove: (task: Task, from: string, to: string) => void;
}) {
  return (
    <li className="flex items-center gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}>
          {task.title}
        </p>
        <p className="text-xs text-muted-foreground capitalize">
          {task.priority} · {task.status.replace("_", " ")}
        </p>
      </div>
      {task.estimate != null && <Badge variant="secondary">{task.estimate} pt</Badge>}
      {!disabled && (
        <SimpleSelect
          className="w-32"
          value={current}
          onChange={(to) => onMove(task, current, to)}
          options={targets}
        />
      )}
    </li>
  );
}

function NewSprintDialog({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [defaults] = useState(() => ({
    start: iso(new Date()),
    end: iso(new Date(Date.now() + 14 * 864e5)),
  }));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api(`/projects/${projectId}/sprints`, {
        method: "POST",
        body: {
          name: String(f.get("name")).trim(),
          goal: String(f.get("goal")).trim() || null,
          start_date: String(f.get("start_date")),
          end_date: String(f.get("end_date")),
        },
      });
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create sprint");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> New sprint
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New sprint</DialogTitle>
          <DialogDescription>Pick a name and dates. You can add tasks afterwards.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sname">Name</Label>
            <Input id="sname" name="name" required maxLength={80} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sgoal">Goal (optional)</Label>
            <Input id="sgoal" name="goal" maxLength={500} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sstart">Start</Label>
              <Input id="sstart" name="start_date" type="date" required defaultValue={defaults.start} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="send">End</Label>
              <Input id="send" name="end_date" type="date" required defaultValue={defaults.end} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating…" : "Create sprint"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SprintPlanner({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [sprints, setSprints] = useState<Sprint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState("");

  const reload = useCallback(async () => {
    const [ts, ss] = await Promise.all([
      api<Task[]>(`/projects/${projectId}/tasks`),
      api<Sprint[]>(`/projects/${projectId}/sprints`),
    ]);
    setTasks(ts);
    setSprints(ss);
  }, [projectId]);

  useEffect(() => {
    api<Project>(`/projects/${projectId}`)
      .then(setProject)
      .then(reload)
      .catch((e) =>
        setError(e instanceof ApiError && e.status < 500 ? "Project not found or you don't have access." : e.message),
      );
  }, [projectId, reload]);

  async function act(fn: () => Promise<unknown>, failMsg: string) {
    try {
      await fn();
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : failMsg);
    }
  }

  const move = (task: Task, from: string, to: string) =>
    act(async () => {
      if (to !== BACKLOG) await api(`/sprints/${to}/tasks`, { method: "POST", body: { add: [task.id] } });
      else if (from !== BACKLOG) await api(`/sprints/${from}/tasks`, { method: "POST", body: { remove: [task.id] } });
    }, "Could not move task");

  const setStatus = (s: Sprint, status: "active" | "completed") => {
    if (status === "completed" && !confirm("Complete this sprint? Unfinished tasks return to the backlog.")) return;
    void act(() => api(`/sprints/${s.id}`, { method: "PATCH", body: { status } }), "Could not update sprint");
  };

  const removeSprint = (s: Sprint) => {
    if (!confirm(`Delete "${s.name}"? Its tasks return to the backlog.`)) return;
    void act(() => api(`/sprints/${s.id}`, { method: "DELETE" }), "Could not delete sprint");
  };

  async function addToBacklog(e: React.FormEvent) {
    e.preventDefault();
    const title = quickAdd.trim();
    if (!title) return;
    setQuickAdd("");
    await act(() => api(`/projects/${projectId}/tasks`, { method: "POST", body: { title } }), "Could not add task");
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!project || !tasks || !sprints) return <Skeleton className="h-64 w-full" />;

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const inSprint = new Set(sprints.flatMap((s) => s.task_ids));
  const backlog = tasks.filter((t) => !inSprint.has(t.id));
  const open = sprints.filter((s) => s.status !== "completed");
  const closed = sprints.filter((s) => s.status === "completed");
  const targets = [{ value: BACKLOG, label: "Backlog" }, ...open.map((s) => ({ value: s.id, label: s.name }))];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/projects/${projectId}`} className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" /> Back to board
          </Link>
          <h1 className="text-2xl font-semibold">{project.name}: backlog and sprints</h1>
        </div>
        <NewSprintDialog projectId={projectId} onCreated={() => void reload()} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backlog ({backlog.length})</CardTitle>
            <CardDescription>Tasks not in any sprint. Move them into a sprint with the dropdown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={addToBacklog} className="flex gap-2">
              <Input
                placeholder="Add a task to the backlog…"
                value={quickAdd}
                onChange={(e) => setQuickAdd(e.target.value)}
                maxLength={200}
                aria-label="New backlog task title"
              />
              <Button type="submit" variant="outline" disabled={!quickAdd.trim()}>
                Add
              </Button>
            </form>
            {backlog.length === 0 && <p className="text-sm text-muted-foreground">The backlog is empty.</p>}
            <ul className="divide-y">
              {backlog.map((t) => (
                <TaskRow key={t.id} task={t} current={BACKLOG} targets={targets} onMove={move} />
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {open.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No sprints yet. Create one to start planning.
              </CardContent>
            </Card>
          )}
          {open.map((s) => {
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <Card key={s.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {s.name}
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {fmt(s.start_date)} to {fmt(s.end_date)}
                    {s.goal ? ` · ${s.goal}` : ""}
                  </CardDescription>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {s.status === "planned" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(s, "active")}>
                        <Play className="size-3.5" /> Start sprint
                      </Button>
                    )}
                    {s.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(s, "completed")}>
                        <CheckCheck className="size-3.5" /> Complete sprint
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => removeSprint(s)} aria-label={`Delete ${s.name}`}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Progress value={pct} />
                    <p className="text-xs text-muted-foreground">
                      {s.done} of {s.total} tasks done
                      {s.points_total > 0 && ` · ${s.points_done}/${s.points_total} points`}
                    </p>
                  </div>
                  {s.task_ids.length === 0 && <p className="text-sm text-muted-foreground">No tasks in this sprint yet.</p>}
                  <ul className="divide-y">
                    {s.task_ids.map((id) => byId.get(id)).filter((t): t is Task => !!t).map((t) => (
                      <TaskRow key={t.id} task={t} current={s.id} targets={targets} onMove={move} />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}

          {closed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Completed sprints</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {closed.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {s.name} <span className="text-xs text-muted-foreground">{fmt(s.start_date)} to {fmt(s.end_date)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{s.done} tasks finished</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
