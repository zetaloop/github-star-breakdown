import { useEffect, useRef, useState } from "react";
import { analyzeUser } from "@/services/github";
import { fetchGitHub, type GitHubPage } from "@/services/githubApi";
import type {
  AnalysisProgress,
  AnalysisResult,
  AnalysisStatus,
  TimeRange,
} from "@/types/github";

interface Run {
  controller: AbortController;
  pause: () => void;
  resume: () => void;
  release: () => void;
}

export function useStarAnalysis() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const current = useRef<Run | null>(null);

  useEffect(
    () => () => {
      current.current?.controller.abort();
      current.current?.release();
    },
    [],
  );

  async function search(username: string, range: TimeRange) {
    current.current?.controller.abort();
    current.current?.release();
    const controller = new AbortController();
    let paused: Promise<void> | undefined;
    let release: (() => void) | undefined;
    const run: Run = {
      controller,
      pause() {
        if (paused) return;
        paused = new Promise<void>((resolve) => {
          release = resolve;
        });
        setStatus("paused");
      },
      resume() {
        paused = undefined;
        release?.();
        release = undefined;
        setError(null);
        setStatus("loading");
      },
      release() {
        release?.();
      },
    };
    current.current = run;
    setStatus("loading");
    setError(null);
    setProgress({ stage: "repos", completed: 0, total: 0, requests: 0 });
    let requests = 0;
    let activeRequests = 0;
    const waiting: (() => void)[] = [];

    async function request<T>(path: string): Promise<GitHubPage<T>> {
      if (activeRequests < 50) activeRequests++;
      else await new Promise<void>((resolve) => waiting.push(resolve));
      try {
        while (true) {
          await paused;
          controller.signal.throwIfAborted();
          try {
            requests++;
            setProgress((value) => value && { ...value, requests });
            const page = await fetchGitHub<T>(path, controller.signal);
            controller.signal.throwIfAborted();
            return page;
          } catch (cause) {
            controller.signal.throwIfAborted();
            if (!paused) {
              setError(cause instanceof Error ? cause.message : String(cause));
              run.pause();
            }
          }
        }
      } finally {
        const next = waiting.shift();
        if (next) next();
        else activeRequests--;
      }
    }

    try {
      await analyzeUser(username, range, {
        request,
        onRepos(repos, bounds) {
          setResult({ username, range, bounds, repos, history: new Map() });
        },
        onHistory(id, history) {
          setResult(
            (value) =>
              value && {
                ...value,
                history: new Map(value.history).set(id, history),
              },
          );
        },
        onProgress(value) {
          setProgress({ ...value, requests });
        },
      });
      if (current.current === run) {
        current.current = null;
        setStatus("complete");
      }
    } catch (cause) {
      if (current.current === run && !controller.signal.aborted) {
        controller.abort();
        run.release();
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("stopped");
        current.current = null;
      }
    }
  }

  function stop() {
    current.current?.controller.abort();
    current.current?.release();
    current.current = null;
    setStatus("stopped");
  }

  function reset() {
    stop();
    setResult(null);
    setProgress(null);
    setError(null);
    setStatus("idle");
  }

  return {
    result,
    progress,
    status,
    error,
    search,
    stop,
    reset,
    togglePause() {
      if (status === "paused") current.current?.resume();
      else current.current?.pause();
    },
  };
}
