"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const { workspace_id } = await api<{ workspace_id: string }>(`/workspaces/invites/${token}/accept`, {
        method: "POST",
      });
      localStorage.setItem("openship.workspace", workspace_id);
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept invite");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>You&apos;ve been invited</CardTitle>
          <CardDescription>Join this workspace on OpenShip as a member.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={accept} disabled={busy}>
            {busy ? "Joining…" : "Accept invite"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
