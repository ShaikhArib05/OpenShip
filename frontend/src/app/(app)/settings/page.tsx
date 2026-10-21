"use client";

import { useWorkspace, CreateWorkspaceForm } from "@/components/workspace-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const { current, refresh } = useWorkspace();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {current.name} <Badge variant="secondary">Your role: {current.role}</Badge>
          </CardTitle>
          <CardDescription>Created {new Date(current.created_at).toLocaleDateString()}</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>New workspace</CardTitle>
          <CardDescription>You will be the owner of any workspace you create.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateWorkspaceForm submitLabel="Create" onCreated={(ws) => void refresh(ws.id)} />
        </CardContent>
      </Card>
    </div>
  );
}
