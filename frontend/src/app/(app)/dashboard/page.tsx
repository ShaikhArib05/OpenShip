"use client";

import { useWorkspace } from "@/components/workspace-provider";

export default function DashboardPage() {
  const { current } = useWorkspace();
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{current.name}</h1>
      <p className="text-sm text-muted-foreground">
        Projects and stats will appear here once you create your first project.
      </p>
    </div>
  );
}
