"use client";

import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AI_WAIT_MESSAGE } from "@/lib/ai";

export function AiButton({
  loading,
  disabled,
  onClick,
  children,
  variant = "default",
}: {
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "outline";
}) {
  return (
    <Button type="button" variant={variant} size="sm" disabled={loading || disabled} onClick={onClick}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      {children}
    </Button>
  );
}

export function AiWaiting() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {AI_WAIT_MESSAGE}
    </p>
  );
}

export function ReviewNote() {
  return <p className="text-xs text-muted-foreground">Suggestions only. Nothing is saved until you approve it.</p>;
}
