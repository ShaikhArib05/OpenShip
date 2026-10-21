"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { STATUSES, type Member, type Task, type TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const POSITION_STEP = 1000;

const PRIORITY_STYLE: Record<Task["priority"], string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  urgent: "bg-destructive/10 text-destructive",
};

function isOverdue(t: Task) {
  return t.status !== "done" && !!t.due_date && t.due_date < new Date().toLocaleDateString("en-CA");
}

function TaskCard({ task, member, overlay }: { task: Task; member?: Member; overlay?: boolean }) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border bg-card p-3 text-left shadow-xs",
        overlay && "rotate-2 shadow-lg",
      )}
    >
      <p className="text-sm font-medium leading-snug break-words">{task.title}</p>
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <Badge key={l} variant="outline" className="text-[10px]">
              {l}
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Badge className={cn("border-0 capitalize", PRIORITY_STYLE[task.priority])}>{task.priority}</Badge>
        {task.due_date && (
          <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", isOverdue(task) && "text-destructive")}>
            <CalendarDays className="size-3" />
            {new Date(task.due_date + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
        {member && (
          <Avatar className="ml-auto size-6" title={member.full_name ?? member.email}>
            <AvatarFallback className="text-[10px]">{(member.full_name ?? member.email)[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

function SortableTask({ task, member, onOpen }: { task: Task; member?: Member; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, touchAction: "manipulation" }}
      className={cn("cursor-grab touch-manipulation active:cursor-grabbing", isDragging && "opacity-30")}
      onClick={() => onOpen(task)}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} member={member} />
    </div>
  );
}

function Column({
  status,
  label,
  tasks,
  members,
  onOpen,
  onAdd,
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  members: Map<string, Member>;
  onOpen: (t: Task) => void;
  onAdd: (s: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/60 p-2 md:w-auto">
      <div className="flex items-center justify-between px-2 py-1.5">
        <h3 className="text-sm font-semibold">
          {label} <span className="ml-1 font-normal text-muted-foreground">{tasks.length}</span>
        </h3>
        <Button variant="ghost" size="icon" className="size-7" aria-label={`Add task to ${label}`} onClick={() => onAdd(status)}>
          <Plus className="size-4" />
        </Button>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn("flex min-h-24 flex-1 flex-col gap-2 rounded-lg p-1 transition-colors", isOver && "bg-primary/5")}
        >
          {tasks.map((t) => (
            <SortableTask key={t.id} task={t} member={t.assignee_id ? members.get(t.assignee_id) : undefined} onOpen={onOpen} />
          ))}
          {tasks.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">No tasks</p>}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  setTasks,
  members,
  onOpen,
  onAdd,
}: {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  members: Member[];
  onOpen: (t: Task) => void;
  onAdd: (s: TaskStatus) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s).sort((a, b) => a.position - b.position);
  const active = tasks.find((t) => t.id === activeId);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const moving = tasks.find((t) => t.id === active.id);
    if (!moving) return;

    const overId = String(over.id);
    const overTask = tasks.find((t) => t.id === overId);
    const targetStatus = (overTask?.status ?? overId) as TaskStatus;
    if (!STATUSES.some((s) => s.value === targetStatus)) return;

    const column = byStatus(targetStatus).filter((t) => t.id !== moving.id);
    let index = column.length;
    if (overTask && overTask.id !== moving.id) {
      const translated = active.rect.current.translated;
      const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
      index = column.findIndex((t) => t.id === overTask.id) + (below ? 1 : 0);
    } else if (overTask) {
      return; // dropped on itself
    }

    const prev = column[index - 1]?.position;
    const next = column[index]?.position;
    const position =
      prev !== undefined && next !== undefined
        ? (prev + next) / 2
        : prev !== undefined
          ? prev + POSITION_STEP
          : next !== undefined
            ? next - POSITION_STEP
            : POSITION_STEP;

    if (moving.status === targetStatus && moving.position === position) return;

    const before = tasks;
    setTasks((ts) => ts.map((t) => (t.id === moving.id ? { ...t, status: targetStatus, position } : t)));
    try {
      const saved = await api<Task>(`/tasks/${moving.id}`, { method: "PATCH", body: { status: targetStatus, position } });
      setTasks((ts) => ts.map((t) => (t.id === saved.id ? saved : t)));
    } catch (err) {
      setTasks(before);
      toast.error(err instanceof Error ? err.message : "Could not move task");
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {STATUSES.map((s) => (
          <Column key={s.value} status={s.value} label={s.label} tasks={byStatus(s.value)} members={memberMap} onOpen={onOpen} onAdd={onAdd} />
        ))}
      </div>
      <DragOverlay>{active && <TaskCard task={active} overlay member={active.assignee_id ? memberMap.get(active.assignee_id) : undefined} />}</DragOverlay>
    </DndContext>
  );
}
