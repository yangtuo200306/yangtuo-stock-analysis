import { useState, useRef, useCallback, useEffect } from "react";
import { getApiBaseUrl } from "../api/client";
import { showToast } from "../components/Toast";

// ── Types ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  skill?: string;
  skillChanged?: boolean;
}

export interface SSEStreamOptions {
  question: string;
  skill?: string;
  onContent: (content: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useSSEStream() {
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const startStream = useCallback(
    async (options: SSEStreamOptions): Promise<void> => {
      const { question, skill, onContent, onDone, onError, signal } = options;
      const controller = new AbortController();
      abortRef.current = controller;

      setStreaming(true);
      const baseUrl = getApiBaseUrl();
      const STREAM_TIMEOUT_MS = 60000;

      const timeoutId = setTimeout(() => {
        controller.abort();
        showToast("流式请求超时，已切换到基础模式");
      }, STREAM_TIMEOUT_MS);

      // Combine external signal with internal controller
      const combinedSignal = signal
        ? combineAbortSignals(controller.signal, signal)
        : controller.signal;

      try {
        const res = await fetch(baseUrl + "/api/v1/agent/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: question,
            session_id: `app_${Date.now()}`,
            skills: skill ? [skill] : undefined,
          }),
          signal: combinedSignal,
        });

        if (!res.ok) throw new Error(`请求失败 HTTP ${res.status}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("无法读取流式响应");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            try {
              const event = JSON.parse(trimmed.slice(6));
              if (event.type === "generating" && event.content) {
                accumulated += event.content;
                onContent(accumulated);
              } else if (event.type === "done") {
                if (!event.success && event.error)
                  throw new Error(event.error);
                onDone();
                return;
              } else if (event.type === "error") {
                throw new Error(event.message || "分析错误");
              }
            } catch (e) {
              throw e;
            }
          }
        }
        onDone();
      } finally {
        clearTimeout(timeoutId);
        setStreaming(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [],
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  return { streaming, startStream, cancelStream };
}

// ── Utility: combine two AbortSignals ────────────────────────────────────

function combineAbortSignals(
  ...signals: AbortSignal[]
): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener(
      "abort",
      () => controller.abort(signal.reason),
      { once: true },
    );
  }
  return controller.signal;
}
