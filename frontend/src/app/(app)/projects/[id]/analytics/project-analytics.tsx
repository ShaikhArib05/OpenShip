"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, ListTodo, Percent } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { Project, TaskStatus } from "@/lib/types";

interface Analytics {
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  overdue_tasks: number;
  by_status: Record<TaskStatus, number>;
  sprint: {
    name: string;
    status: "active" | "completed";
    start_date: string;
    end_date: string;
    total: number;
    done: number;
    burndown: {
      unit: "points" | "tasks";
      total: number;
      points: { date: string; ideal: number; remaining: number | null }[];
    };
  } | null;
}

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

function Stat({ label, value, icon: Icon, alert }: { label: string; value: string | number; icon: typeof ListTodo; alert?: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`rounded-lg p-2 ${alert ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-2xl leading-none font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const shortDate = (d: string) => new Date(d + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function ProjectAnalytics({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<Project>(`/projects/${projectId}`), api<Analytics>(`/projects/${projectId}/analytics`)])
      .then(([p, a]) => {
        setProject(p);
        setData(a);
      })
      .catch((e) =>
        setError(e instanceof ApiError && e.status < 500 ? "Project not found or you don't have access." : e.message),
      );
  }, [projectId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data || !project) return <Skeleton className="h-64 w-full" />;

  const chart = (Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => ({ status: s, name: STATUS_LABEL[s], count: data.by_status[s] }));
  const sprint = data.sprint;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href={`/projects/${projectId}`} className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Back to board
        </Link>
        <h1 className="text-2xl font-semibold">{project.name}: analytics</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total tasks" value={data.total_tasks} icon={ListTodo} />
        <Stat label="Completed" value={data.completed_tasks} icon={CheckCircle2} />
        <Stat label="Completion rate" value={`${data.completion_rate}%`} icon={Percent} />
        <Stat label="Overdue" value={data.overdue_tasks} icon={AlertTriangle} alert={data.overdue_tasks > 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks by status</CardTitle>
          </CardHeader>
          <CardContent>
            {data.total_tasks === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ left: -20 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip cursor={{ fill: "var(--muted)" }} />
                    <Bar dataKey="count" name="Tasks" radius={[4, 4, 0, 0]}>
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
            <CardTitle className="flex items-center gap-2 text-base">
              Sprint progress {sprint && <Badge variant={sprint.status === "active" ? "default" : "secondary"}>{sprint.status}</Badge>}
            </CardTitle>
            {sprint && (
              <CardDescription>
                {sprint.name} · {shortDate(sprint.start_date)} to {shortDate(sprint.end_date)}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {!sprint && <p className="text-sm text-muted-foreground">Start a sprint to see its progress here.</p>}
            {sprint && (
              <>
                <Progress value={sprint.total ? Math.round((sprint.done / sprint.total) * 100) : 0} />
                <p className="text-xs text-muted-foreground">
                  {sprint.done} of {sprint.total} tasks done
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {sprint && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Burndown: {sprint.name}</CardTitle>
            <CardDescription>Remaining {sprint.burndown.unit} per day against an ideal pace.</CardDescription>
          </CardHeader>
          <CardContent>
            {sprint.burndown.total === 0 ? (
              <p className="text-sm text-muted-foreground">Add tasks to this sprint to see a burndown.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sprint.burndown.points} margin={{ left: -20 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} fontSize={12} minTickGap={24} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip labelFormatter={(d) => shortDate(String(d))} />
                    <Legend />
                    <Line type="linear" dataKey="ideal" name="Ideal" stroke="var(--muted-foreground)" strokeDasharray="5 4" dot={false} />
                    <Line type="stepAfter" dataKey="remaining" name="Remaining" stroke="var(--chart-1)" strokeWidth={2} dot={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
