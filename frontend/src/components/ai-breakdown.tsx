"use client";

import { useState } from "react";
import { toast } from "sonner";

import { AiButton, AiWaiting, ReviewNote } from "@/components/ai-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { AI_DISABLED_MESSAGE, useAiEnabled } from "@/lib/ai";
import type { Task } from "@/lib/types";

interface Sub {
  title: string;
  description: string | null;
  estimate: number;
  selected: boolean;
}

/** Suggest subtasks for one task. Approved subtasks become regular tasks labelled "subtask". */
export function AiBreakdown({ task, onAdded }: { task: Task; onAdded: () => void }) {
  const enabled = useAiEnabled();
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function run() {
    setLoading(true);
    setSubs(null);
    try {
      const res = await api<{ subtasks: Omit<Sub, "selected">[] }>(`/tasks/${task.id}/ai/breakdown`, { method: "POST" });
      setSubs(res.subtasks.map((s) => ({ ...s, selected: true })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    const chosen = subs?.filter((s) => s.selected && s.title.trim()) ?? [];
    setSaving(true);
    let added = 0;
    try {
      for (const s of chosen) {
        await api(`/projects/${task.project_id}/tasks`, {
          method: "POST",
          body: {
            title: s.title.trim(),
            description: [s.description, `Subtask of: ${task.title}`].filter(Boolean).join("\n\n"),
            priority: task.priority,
            estimate: s.estimate,
            labels: ["subtask"],
            due_date: task.due_date,
          },
        });
        added++;
      }
      toast.success(`Added ${added} subtask${added === 1 ? "" : "s"}`);
      setSubs(null);
    } catch (e) {
      toast.error(`${e instanceof Error ? e.message : "Could not save subtasks"} (${added} saved)`);
    } finally {
      setSaving(false);
      if (added) onAdded();
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Split this task into smaller steps you can track separately.</p>
      <AiButton loading={loading} disabled={enabled === false} onClick={run}>
        Break down with AI
      </AiButton>
      {enabled === false && <p className="text-xs text-muted-foreground">{AI_DISABLED_MESSAGE}</p>}
      {loading && <AiWaiting />}
      {subs && (
        <div className="space-y-3">
          <ReviewNote />
          <ul className="space-y-2">
            {subs.map((s, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border p-2">
                <input
                  type="checkbox"
                  className="mt-2 size-4 accent-[var(--primary)]"
                  checked={s.selected}
                  onChange={(e) => setSubs((xs) => xs?.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)) ?? null)}
                  aria-label={`Include ${s.title}`}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    value={s.title}
                    maxLength={200}
                    onChange={(e) => setSubs((xs) => xs?.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) ?? null)}
                  />
                  {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                </div>
                <Badge variant="secondary">{s.estimate} pt</Badge>
              </li>
            ))}
          </ul>
          <Button onClick={save} disabled={saving || !subs.some((s) => s.selected && s.title.trim())}>
            {saving ? "Adding…" : `Add ${subs.filter((s) => s.selected && s.title.trim()).length} subtasks`}
          </Button>
        </div>
      )}
    </div>
  );
}
