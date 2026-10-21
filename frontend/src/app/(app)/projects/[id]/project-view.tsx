"use client";

import { Archive, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { Project } from "@/lib/types";

export function ProjectView({ id }: { id: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Project>(`/projects/${id}`)
      .then(setProject)
      .catch((e) =>
        setError(e instanceof ApiError && e.status < 500 ? "Project not found or you don't have access." : e.message),
      );
  }, [id]);

  async function archive() {
    try {
      const p = await api<Project>(`/projects/${id}`, { method: "PATCH", body: { archived: true } });
      toast.success("Project archived");
      setProject(p);
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
  if (!project) return <Skeleton className="h-32 max-w-3xl" />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.description ?? "No description"}</p>
        </div>
        <div className="flex gap-2">
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
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          The task board for this project is coming in the next stage.
        </CardContent>
      </Card>
    </div>
  );
}
