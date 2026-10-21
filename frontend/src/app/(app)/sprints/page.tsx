"use client";

import { Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useWorkspace } from "@/components/workspace-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Sprint } from "@/lib/types";

const fmt = (d: string) => new Date(d + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function SprintsOverviewPage() {
  const { current } = useWorkspace();
  const [sprints, setSprints] = useState<Sprint[] | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSprints(null);
    api<Sprint[]>(`/workspaces/${current.id}/sprints`)
      .then(setSprints)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load sprints");
        setSprints([]);
      });
  }, [current.id]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Sprints</h1>
      {!sprints && <Skeleton className="h-32 w-full" />}
      {sprints?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Timer className="size-8 text-muted-foreground" />
            <p className="font-medium">No active or planned sprints</p>
            <p className="text-sm text-muted-foreground">
              Open a project and choose <Link href="/projects" className="text-primary hover:underline">Backlog and sprints</Link> to create one.
            </p>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {sprints?.map((s) => {
          const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
          return (
            <Link key={s.id} href={`/projects/${s.project_id}/sprints`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {s.name} <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {s.project_name} · {fmt(s.start_date)} to {fmt(s.end_date)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  <Progress value={pct} />
                  <p className="text-xs text-muted-foreground">
                    {s.done} of {s.total} tasks done
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
