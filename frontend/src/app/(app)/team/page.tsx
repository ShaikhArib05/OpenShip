"use client";

import { Copy, Link2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useWorkspace } from "@/components/workspace-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Invite, Member } from "@/lib/types";

export default function TeamPage() {
  const { current } = useWorkspace();
  const isOwner = current.role === "owner";
  const [members, setMembers] = useState<Member[] | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setMembers(await api<Member[]>(`/workspaces/${current.id}/members`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load members");
    }
  }, [current.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMembers(null);
    setLink(null);
    void load();
  }, [load]);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const inv = await api<Invite>(`/workspaces/${current.id}/invites`, {
        method: "POST",
        body: { email: email.trim() || null },
      });
      setLink(`${window.location.origin}/invite/${inv.token}`);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create invite");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  }

  async function remove(m: Member) {
    if (!confirm(`Remove ${m.full_name ?? m.email} from ${current.name}?`)) return;
    try {
      await api(`/workspaces/${current.id}/members/${m.id}`, { method: "DELETE" });
      toast.success("Member removed");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove member");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Team</h1>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Invite people</CardTitle>
            <CardDescription>
              Generate a link valid for 7 days. Add an email to make it single-use for that person; leave it blank for a
              reusable team link. Share it however you like.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={createInvite} className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                placeholder="teammate@example.com (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" disabled={busy}>
                <Link2 className="size-4" /> {busy ? "Creating…" : "Create invite link"}
              </Button>
            </form>
            {link && (
              <div className="flex gap-2">
                <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                <Button variant="outline" size="icon" onClick={copy} aria-label="Copy invite link">
                  <Copy className="size-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {!members && <Skeleton className="h-16 w-full" />}
          {members?.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-3">
              <Avatar>
                <AvatarFallback>{(m.full_name ?? m.email)[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.full_name ?? m.email}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <Badge variant={m.role === "owner" ? "default" : "secondary"}>{m.role}</Badge>
              {isOwner && m.role !== "owner" && (
                <Button variant="ghost" size="icon" aria-label={`Remove ${m.email}`} onClick={() => remove(m)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
