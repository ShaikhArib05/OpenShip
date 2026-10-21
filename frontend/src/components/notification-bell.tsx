"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "assignment" | "mention" | "status_change";
  message: string;
  task_id: string | null;
  read: boolean;
  created_at: string;
  tasks: { project_id: string } | null;
}

const POLL_MS = 30_000;

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: Notification[]; unread: number }>("/notifications");
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      // Polling failures are silent; the next tick retries.
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  async function open(n: Notification) {
    if (!n.read) {
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => void load());
    }
    if (n.tasks?.project_id) router.push(`/projects/${n.tasks.project_id}`);
  }

  async function markAll() {
    try {
      await api("/notifications/read-all", { method: "POST" });
      setItems((xs) => xs.map((x) => ({ ...x, read: true })));
      setUnread(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark notifications as read");
    }
  }

  return (
    <DropdownMenu onOpenChange={(o) => o && void load()}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread} unread`} />}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between pr-2">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button type="button" className="text-xs text-primary hover:underline" onClick={markAll}>
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>}
        <div className="max-h-96 overflow-y-auto">
          {items.map((n) => (
            <DropdownMenuItem key={n.id} onClick={() => void open(n)} className="flex-col items-start gap-0.5">
              <span className={cn("text-sm", !n.read && "font-medium")}>
                {!n.read && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />}
                {n.message}
              </span>
              <span className="text-xs text-muted-foreground">{ago(n.created_at)}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
