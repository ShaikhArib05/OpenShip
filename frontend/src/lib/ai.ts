"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";

let cached: Promise<boolean> | null = null;

/** Whether the backend has a Gemini key. null while loading. AI buttons are disabled when false. */
export function useAiEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    cached ??= api<{ enabled: boolean }>("/ai/status").then((r) => r.enabled).catch(() => {
      cached = null; // retry next time
      return false;
    });
    void cached.then(setEnabled);
  }, []);
  return enabled;
}

export const AI_DISABLED_MESSAGE = "AI is not configured. Add GEMINI_API_KEY to the backend environment to enable it.";
export const AI_WAIT_MESSAGE = "Thinking… this can take up to a minute.";
