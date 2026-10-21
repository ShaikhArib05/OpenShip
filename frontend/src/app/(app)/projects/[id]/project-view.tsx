"use client";

import { Archive, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { KanbanBoard } from "@/components/kanban-board";
import { SimpleSelect } from "@/components/simple-select";
import { TaskDialog } from "@/components/task-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { PRIORITIES, STATUSES, type Member, type Project, type Task, type TaskStatus } from "@/lib/types";

const ANY = "any";
const DUE_OPTIONS = [
  { value: ANY, label: "Any due date" },
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "Due in 7 days" },
];
const iso = (d: Date) => d.toLocaleDateString("en-CA");
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

interface Filters {
  q: string;
  assignee: string;
  priority: string;
  status: string;
  due: string;
}
const NO_FILTERS: Filters = { q: "", assignee: ANY, priority: ANY, status: ANY, due: ANY };

function toQuery(f: Filters) {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.assignee !== ANY) p.set("assignee_id", f.assignee);
  if (f.priority !== ANY) p.set("priority", f.priority);
  if (f.status !== ANY) p.set("status", f.status);
  if (f.due === "overdue") p.set("due_before", addDays(-1));
  if (f.due === "week") {
    p.set("due_after", iso(new Date()));
    p.set("due_before", addDays(7));
  }
  return p.toString();
}

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
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [isOwner, setIsOwner] = useState(false);
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  useEffect(() => {
    (async () => {
      try {
        const p = await api<Project>(`/projects/${id}`);
        setProject(p);
        setIsOwner(p.role === "owner");
        setMembers(await api<Member[]>(`/workspaces/${p.workspace_id}/members`));
      } catch (e) {
        setError(e instanceof ApiError && e.status < 500 ? "Project not found or you don't have access." : (e as Error).message);
      }
    })();
  }, [id]);

  // Reload tasks whenever filters change (search is debounced).
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const qs = toQuery(filters);
        let ts = await api<Task[]>(`/projects/${id}/tasks${qs ? `?${qs}` : ""}`);
        if (filters.due === "overdue") ts = ts.filter((t) => t.status !== "done");
        if (!cancelled) setTasks(ts);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load tasks");
      }
    }, filters.q ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, project, filters]);

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

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search tasks…"
            aria-label="Search tasks by title"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <SimpleSelect
          className="w-36"
          value={filters.assignee}
          onChange={(v) => setFilters((f) => ({ ...f, assignee: v }))}
          options={[
            { value: ANY, label: "Any assignee" },
            { value: "none", label: "Unassigned" },
            ...members.map((m) => ({ value: m.id, label: m.full_name ?? m.email })),
          ]}
        />
        <SimpleSelect
          className="w-32"
          value={filters.priority}
          onChange={(v) => setFilters((f) => ({ ...f, priority: v }))}
          options={[{ value: ANY, label: "Any priority" }, ...PRIORITIES]}
        />
        <SimpleSelect
          className="w-32"
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          options={[{ value: ANY, label: "Any status" }, ...STATUSES]}
        />
        <SimpleSelect
          className="w-36"
          value={filters.due}
          onChange={(v) => setFilters((f) => ({ ...f, due: v }))}
          options={DUE_OPTIONS}
        />
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
            <X className="size-4" /> Clear
          </Button>
        )}
      </div>

      {tasks.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {filtersActive ? "No tasks match these filters." : "No tasks yet. Add one with “New task” or a column’s + button."}
        </p>
      )}

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
          isOwner={isOwner}
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
