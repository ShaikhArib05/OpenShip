"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AiButton, AiWaiting, ReviewNote } from "@/components/ai-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { AI_DISABLED_MESSAGE, useAiEnabled } from "@/lib/ai";
import type { Sprint, TaskPriority } from "@/lib/types";

interface Plan {
  tasks: { id: string; title: string; priority: TaskPriority; estimate: number | null; selected?: boolean }[];
  total_points: number;
  reasoning: string;
}

export function AiSprintPlan({ sprint, projectId, onApplied }: { sprint: Sprint; projectId: string; onApplied: () => void }) {
  const enabled = useAiEnabled();
  const [open, setOpen] = useState(false);
  const [capacity, setCapacity] = useState("20");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const cap = Number(capacity);
  const validCap = Number.isInteger(cap) && cap >= 1 && cap <= 500;

  async function run() {
    setLoading(true);
    setPlan(null);
    try {
      const res = await api<Plan>(`/projects/${projectId}/ai/plan-sprint`, {
        method: "POST",
        body: { sprint_id: sprint.id, capacity: cap },
      });
      setPlan(res);
      setSelected(new Set(res.tasks.map((t) => t.id)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    setSaving(true);
    try {
      await api(`/sprints/${sprint.id}/tasks`, { method: "POST", body: { add: [...selected] } });
      toast.success(`Added ${selected.size} task${selected.size === 1 ? "" : "s"} to ${sprint.name}`);
      setOpen(false);
      setPlan(null);
      onApplied();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update sprint");
    } finally {
      setSaving(false);
    }
  }

  const chosenPoints = plan?.tasks.filter((t) => selected.has(t.id)).reduce((n, t) => n + (t.estimate ?? 1), 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="sm" variant="outline" disabled={enabled === false} title={enabled === false ? AI_DISABLED_MESSAGE : undefined} />}
      >
        <Sparkles className="size-3.5" /> AI plan
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan {sprint.name} with AI</DialogTitle>
          <DialogDescription>Suggests backlog tasks that fit your team capacity.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="cap">Team capacity (story points)</Label>
              <Input id="cap" type="number" min={1} max={500} className="w-32" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <AiButton loading={loading} disabled={!validCap} onClick={run}>
              Suggest tasks
            </AiButton>
          </div>
          {loading && <AiWaiting />}
          {plan && plan.tasks.length === 0 && <p className="text-sm">No backlog tasks fit. Add estimates or increase capacity.</p>}
          {plan && plan.tasks.length > 0 && (
            <div className="space-y-3">
              <ReviewNote />
              {plan.reasoning && <p className="rounded-lg bg-muted/40 p-2 text-sm">{plan.reasoning}</p>}
              <ul className="space-y-2">
                {plan.tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 rounded-lg border p-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={selected.has(t.id)}
                      onChange={(e) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.add(t.id);
                          else next.delete(t.id);
                          return next;
                        })
                      }
                      aria-label={`Include ${t.title}`}
                    />
                    <span className="min-w-0 flex-1 text-sm break-words">{t.title}</span>
                    <Badge variant="secondary" className="capitalize">{t.priority}</Badge>
                    <Badge variant="secondary">{t.estimate ?? 1} pt</Badge>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {chosenPoints} of {cap} points selected
              </p>
              <Button onClick={apply} disabled={saving || selected.size === 0}>
                {saving ? "Adding…" : `Add ${selected.size} to sprint`}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
