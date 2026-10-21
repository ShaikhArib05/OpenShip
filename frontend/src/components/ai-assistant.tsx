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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { AI_DISABLED_MESSAGE, useAiEnabled } from "@/lib/ai";
import type { TaskPriority } from "@/lib/types";

interface Draft {
  title: string;
  description: string | null;
  priority: TaskPriority;
  estimate: number;
  labels: string[];
  selected: boolean;
}
interface Suggestion {
  task_id: string;
  title: string;
  current: TaskPriority;
  priority: TaskPriority;
  reason: string;
  selected: boolean;
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function GenerateTab({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function run() {
    setLoading(true);
    setDrafts(null);
    try {
      const res = await api<{ tasks: Omit<Draft, "selected">[] }>(`/projects/${projectId}/ai/generate-tasks`, {
        method: "POST",
        body: { description: text.trim() },
      });
      setDrafts(res.tasks.map((t) => ({ ...t, selected: true })));
    } catch (e) {
      toast.error(errorText(e, "AI request failed"));
    } finally {
      setLoading(false);
    }
  }

  const patch = (i: number, change: Partial<Draft>) =>
    setDrafts((ds) => ds?.map((d, j) => (j === i ? { ...d, ...change } : d)) ?? null);

  async function save() {
    const chosen = drafts?.filter((d) => d.selected && d.title.trim()) ?? [];
    setSaving(true);
    let added = 0;
    try {
      for (const d of chosen) {
        await api(`/projects/${projectId}/tasks`, {
          method: "POST",
          body: { title: d.title.trim(), description: d.description, priority: d.priority, estimate: d.estimate, labels: d.labels },
        });
        added++;
      }
      toast.success(`Added ${added} task${added === 1 ? "" : "s"}`);
      setDrafts(null);
      setText("");
    } catch (e) {
      toast.error(`${errorText(e, "Could not save tasks")} (${added} saved)`);
    } finally {
      setSaving(false);
      if (added) onChanged();
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={4000}
        placeholder="Describe what you are building, e.g. “A mobile app where users book fitness classes and get reminders.”"
      />
      <div className="flex items-center gap-3">
        <AiButton loading={loading} disabled={text.trim().length < 10} onClick={run}>
          Suggest tasks
        </AiButton>
        {text.trim().length < 10 && <span className="text-xs text-muted-foreground">Write at least 10 characters.</span>}
      </div>
      {loading && <AiWaiting />}
      {drafts && (
        <div className="space-y-3">
          <ReviewNote />
          <ul className="space-y-2">
            {drafts.map((d, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border p-2">
                <input
                  type="checkbox"
                  className="mt-2 size-4 accent-[var(--primary)]"
                  checked={d.selected}
                  onChange={(e) => patch(i, { selected: e.target.checked })}
                  aria-label={`Include ${d.title}`}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <Input value={d.title} maxLength={200} onChange={(e) => patch(i, { title: e.target.value })} />
                  {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="capitalize">{d.priority}</Badge>
                    <Badge variant="secondary">{d.estimate} pt</Badge>
                    {d.labels.map((l) => (
                      <Badge key={l} variant="outline">{l}</Badge>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Button onClick={save} disabled={saving || !drafts.some((d) => d.selected && d.title.trim())}>
            {saving ? "Adding…" : `Add ${drafts.filter((d) => d.selected && d.title.trim()).length} selected tasks`}
          </Button>
        </div>
      )}
    </div>
  );
}

function PrioritizeTab({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function run() {
    setLoading(true);
    setItems(null);
    try {
      const res = await api<{ suggestions: Omit<Suggestion, "selected">[] }>(`/projects/${projectId}/ai/prioritize`, { method: "POST" });
      setItems(res.suggestions.map((s) => ({ ...s, selected: true })));
    } catch (e) {
      toast.error(errorText(e, "AI request failed"));
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    const chosen = items?.filter((i) => i.selected) ?? [];
    setSaving(true);
    let done = 0;
    try {
      for (const s of chosen) {
        await api(`/tasks/${s.task_id}`, { method: "PATCH", body: { priority: s.priority } });
        done++;
      }
      toast.success(`Updated ${done} priorit${done === 1 ? "y" : "ies"}`);
      setItems(null);
    } catch (e) {
      toast.error(`${errorText(e, "Could not apply changes")} (${done} applied)`);
    } finally {
      setSaving(false);
      if (done) onChanged();
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        The assistant reviews open tasks, descriptions and deadlines, and suggests priority changes.
      </p>
      <AiButton loading={loading} onClick={run}>
        Analyse open tasks
      </AiButton>
      {loading && <AiWaiting />}
      {items && items.length === 0 && <p className="text-sm">No changes suggested. Current priorities look right.</p>}
      {items && items.length > 0 && (
        <div className="space-y-3">
          <ReviewNote />
          <ul className="space-y-2">
            {items.map((s, i) => (
              <li key={s.task_id} className="flex items-start gap-2 rounded-lg border p-2">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[var(--primary)]"
                  checked={s.selected}
                  onChange={(e) => setItems((xs) => xs?.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)) ?? null)}
                  aria-label={`Apply change to ${s.title}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">{s.title}</p>
                  <p className="text-xs">
                    <span className="capitalize">{s.current}</span> to <span className="font-medium capitalize">{s.priority}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                </div>
              </li>
            ))}
          </ul>
          <Button onClick={apply} disabled={saving || !items.some((i) => i.selected)}>
            {saving ? "Applying…" : `Apply ${items.filter((i) => i.selected).length} changes`}
          </Button>
        </div>
      )}
    </div>
  );
}

function SummaryTab({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      setSummary((await api<{ summary: string }>(`/projects/${projectId}/ai/summary`, { method: "POST" })).summary);
    } catch (e) {
      toast.error(errorText(e, "AI request failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">A short status report: progress, what is done, what is outstanding, and risks.</p>
      <AiButton loading={loading} onClick={run}>
        {summary ? "Regenerate summary" : "Summarise project"}
      </AiButton>
      {loading && <AiWaiting />}
      {summary && <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{summary}</div>}
    </div>
  );
}

export function AiAssistant({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const enabled = useAiEnabled();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" disabled={enabled === false} title={enabled === false ? AI_DISABLED_MESSAGE : undefined} />}
      >
        <Sparkles className="size-4" /> AI assistant
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>AI assistant</DialogTitle>
          <DialogDescription>Generate tasks, review priorities, or get a project summary.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="generate">
          <TabsList>
            <TabsTrigger value="generate">Generate tasks</TabsTrigger>
            <TabsTrigger value="prioritize">Priorities</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          <TabsContent value="generate" className="pt-3">
            <GenerateTab projectId={projectId} onChanged={onChanged} />
          </TabsContent>
          <TabsContent value="prioritize" className="pt-3">
            <PrioritizeTab projectId={projectId} onChanged={onChanged} />
          </TabsContent>
          <TabsContent value="summary" className="pt-3">
            <SummaryTab projectId={projectId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
