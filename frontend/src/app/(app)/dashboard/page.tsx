"use client";

import { AlertTriangle, CheckCircle2, FolderKanban, ListTodo } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { useWorkspace } from "@/components/workspace-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Dashboard, TaskStatus } from "@/lib/types";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};
const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "var(--chart-2)",
  in_progress: "var(--chart-1)",
  in_review: "var(--chart-4)",
  done: "var(--chart-3)",
};

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof ListTodo; tone?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`rounded-lg bg-primary/10 p-2 text-primary ${tone ?? ""}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function describe(a: Dashboard["activity"][number]) {
  const who = a.profiles?.full_name ?? a.profiles?.email ?? "Someone";
  const title = typeof a.details.title === "string" ? ` “${a.details.title}”` : "";
  return `${who} ${a.action.replaceAll("_", " ")}${title}`;
}

export default function DashboardPage() {
  const { current } = useWorkspace();
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    api<Dashboard>(`/workspaces/${current.id}/dashboard`)
      .then(setData)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load dashboard"));
  }, [current.id]);

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const chart = (Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => ({
    status: s,
    name: STATUS_LABEL[s],
    count: data.by_status[s],
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-semibold">{current.name}</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active projects" value={data.stats.projects} icon={FolderKanban} />
        <Stat label="Total tasks" value={data.stats.total_tasks} icon={ListTodo} />
        <Stat label="Completed" value={data.stats.completed_tasks} icon={CheckCircle2} />
        <Stat label="Overdue" value={data.stats.overdue_tasks} icon={AlertTriangle} tone={data.stats.overdue_tasks ? "bg-destructive/10 text-destructive" : ""} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.projects.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No active projects. <Link href="/projects" className="text-primary hover:underline">Create one</Link> to get started.
              </p>
            )}
            {data.projects.map((p) => {
              const pct = p.task_count ? Math.round(((p.done_count ?? 0) / p.task_count) * 100) : 0;
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="block space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                  <Progress value={pct} />
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks by status</CardTitle>
          </CardHeader>
          <CardContent>
            {data.stats.total_tasks === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ left: -20 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip cursor={{ fill: "var(--muted)" }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chart.map((c) => (
                        <Cell key={c.status} fill={STATUS_COLOR[c.status]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming deadlines</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {data.upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nothing due in the next 14 days.</p>}
            {data.upcoming.map((t) => (
              <Link key={t.id} href={`/projects/${t.project_id}`} className="flex items-center gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.project_name}</p>
                </div>
                <Badge variant="secondary">{new Date(t.due_date + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {data.activity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            {data.activity.map((a) => (
              <div key={a.id} className="flex justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{describe(a)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
  