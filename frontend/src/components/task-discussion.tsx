"use client";

import { Trash2 } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { Member } from "@/lib/types";

interface Person {
  id: string;
  full_name: string | null;
  email: string;
}
interface Comment {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles: Person | null;
}
interface ActivityItem {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  profiles: Person | null;
}

const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-fA-F-]{36})\)/g;
const name = (p: Person | null) => p?.full_name ?? p?.email ?? "Someone";
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function CommentBody({ body }: { body: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    parts.push(body.slice(last, m.index));
    parts.push(
      <span key={m.index} className="rounded bg-primary/10 px-1 font-medium text-primary">
        @{m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  parts.push(body.slice(last));
  return (
    <p className="text-sm break-words whitespace-pre-wrap">
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </p>
  );
}

export function Comments({ taskId, members, isOwner }: { taskId: string; members: Member[]; isOwner: boolean }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setComments(await api<Comment[]>(`/tasks/${taskId}/comments`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load comments");
      setComments([]);
    }
  }, [taskId]);

  useEffect(() => {
    api<Comment[]>(`/tasks/${taskId}/comments`)
      .then(setComments)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load comments");
        setComments([]);
      });
    void createClient()
      .auth.getUser()
      .then(({ data }) => setMe(data.user?.id ?? null));
  }, [taskId]);

  // "@par" at the end of the text -> suggest matching members
  const query = /(?:^|\s)@([^\s@\[\]]*)$/.exec(text)?.[1];
  const suggestions =
    query === undefined
      ? []
      : members
          .filter((m) => (m.full_name ?? m.email).toLowerCase().includes(query.toLowerCase()))
          .slice(0, 5);

  function insertMention(m: Member) {
    setText((t) => t.replace(/@([^\s@\[\]]*)$/, `@[${m.full_name ?? m.email}](${m.id}) `));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api(`/tasks/${taskId}/comments`, { method: "POST", body: { body: text.trim() } });
      setText("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post comment");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/comments/${id}`, { method: "DELETE" });
      setComments((cs) => cs?.filter((c) => c.id !== id) ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete comment");
    }
  }

  return (
    <div className="space-y-4">
      {!comments && <Skeleton className="h-16 w-full" />}
      {comments?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>}
      <ul className="space-y-3">
        {comments?.map((c) => (
          <li key={c.id} className="flex gap-2">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">{name(c.profiles)[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{name(c.profiles)}</span>
                {when(c.created_at)}
                {(c.author_id === me || isOwner) && (
                  <button
                    type="button"
                    aria-label="Delete comment"
                    className="ml-auto hover:text-destructive"
                    onClick={() => remove(c.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              <CommentBody body={c.body} />
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="relative space-y-2">
        {suggestions.length > 0 && (
          <ul className="absolute bottom-full z-10 mb-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
            {suggestions.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => insertMention(m)}
                >
                  {m.full_name ?? m.email} <span className="text-xs text-muted-foreground">{m.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment… type @ to mention someone"
          rows={2}
          maxLength={5000}
        />
        <Button type="submit" size="sm" disabled={busy || !text.trim()}>
          {busy ? "Posting…" : "Comment"}
        </Button>
      </form>
    </div>
  );
}

function describe(a: ActivityItem) {
  const d = a.details;
  if (a.action === "moved task") return `moved this from ${String(d.from).replace("_", " ")} to ${String(d.to).replace("_", " ")}`;
  return a.action.replace(" task", " this task").replace("on task", "on this task");
}

export function ActivityHistory({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    api<ActivityItem[]>(`/tasks/${taskId}/activity`)
      .then(setItems)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load activity");
        setItems([]);
      });
  }, [taskId]);

  if (!items) return <Skeleton className="h-16 w-full" />;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li key={a.id} className="text-sm">
          <span className="font-medium">{name(a.profiles)}</span> {describe(a)}
          <span className="block text-xs text-muted-foreground">{when(a.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}
