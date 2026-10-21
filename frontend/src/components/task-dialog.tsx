"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ActivityHistory, Comments } from "@/components/task-discussion";
import { api } from "@/lib/api";
import { PRIORITIES, STATUSES, type Member, type Task, type TaskPriority, type TaskStatus } from "@/lib/types";

const UNASSIGNED = "none";

/** Create (task === null) or edit a task. `defaultStatus` seeds new tasks from a column's "+" button. */
export function TaskDialog({
  open,
  onOpenChange,
  projectId,
  task,
  defaultStatus = "todo",
  members,
  isOwner = false,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  task: Task | null;
  defaultStatus?: TaskStatus;
  members: Member[];
  isOwner?: boolean;
  onSaved: (t: Task) => void;
  onDeleted?: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>(task?.status ?? defaultStatus);
  const [priority, setPriority] = useState<string>(task?.priority ?? "medium");
  const [assignee, setAssignee] = useState<string>(task?.assignee_id ?? UNASSIGNED);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const estimate = String(f.get("estimate")).trim();
    const body = {
      title: String(f.get("title")).trim(),
      description: String(f.get("description")).trim() || null,
      status: status as TaskStatus,
      priority: priority as TaskPriority,
      assignee_id: assignee === UNASSIGNED ? null : assignee,
      due_date: String(f.get("due_date")) || null,
      labels: String(f.get("labels"))
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean),
      estimate: estimate ? Number(estimate) : null,
    };
    setBusy(true);
    try {
      const saved = task
        ? await api<Task>(`/tasks/${task.id}`, { method: "PATCH", body })
        : await api<Task>(`/projects/${projectId}/tasks`, { method: "POST", body });
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save task");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!task || !confirm("Delete this task?")) return;
    try {
      await api(`/tasks/${task.id}`, { method: "DELETE" });
      onDeleted?.(task.id);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete task");
    }
  }

  const form = (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={200} defaultValue={task?.title} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} maxLength={10000} defaultValue={task?.description ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <SimpleSelect value={status} onChange={setStatus} options={STATUSES} />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <SimpleSelect value={priority} onChange={setPriority} options={PRIORITIES} />
              </div>
              <div className="space-y-2">
                <Label>Assignee</Label>
                <SimpleSelect
                  value={assignee}
                  onChange={setAssignee}
                  options={[
                    { value: UNASSIGNED, label: "Unassigned" },
                    ...members.map((m) => ({ value: m.id, label: m.full_name ?? m.email })),
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due date</Label>
                <Input id="due_date" name="due_date" type="date" defaultValue={task?.due_date ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="labels">Labels (comma separated)</Label>
                <Input id="labels" name="labels" defaultValue={task?.labels.join(", ")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimate">Estimate (points)</Label>
                <Input id="estimate" name="estimate" type="number" min={0} max={1000} defaultValue={task?.estimate ?? ""} />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              {task ? (
                <Button type="button" variant="outline" onClick={remove}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : task ? "Save changes" : "Create task"}
              </Button>
            </DialogFooter>
          </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>{task ? "Update the details below." : "Add a task to this project."}</DialogDescription>
        </DialogHeader>
        {task ? (
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="pt-3">
              {form}
            </TabsContent>
            <TabsContent value="comments" className="pt-3">
              <Comments taskId={task.id} members={members} isOwner={isOwner} />
            </TabsContent>
            <TabsContent value="activity" className="pt-3">
              <ActivityHistory taskId={task.id} />
            </TabsContent>
          </Tabs>
        ) : (
          form
        )}
      </DialogContent>
    </Dialog>
  );
}
