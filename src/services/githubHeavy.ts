import { GitHubStargazer } from "@/types/github";
import { getGitHubToken, RateLimitError } from "./github";
import { ConcurrencyPool } from "./concurrency";

export const fetchStargazersInRange = async (
  repoFullName: string,
  startPage: number,
  endPage: number,
  pool: ConcurrencyPool,
  onProgress: (delta?: number) => void,
  saveStars: (stars: GitHubStargazer[]) => void,
  since?: Date,
  until?: Date
) => {
  const token = getGitHubToken();
  if (!token) throw new Error("GitHub token is required");
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.star+json",
  };

  const fetchPage = async (page: number) => {
    const url = `https://api.github.com/repos/${repoFullName}/stargazers?per_page=100&page=${page}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      if (resp.status === 403) {
        const reset = resp.headers.get("X-RateLimit-Reset");
        const resetTimestamp = reset ? parseInt(reset, 10) : undefined;
        let message = `GitHub API rate limit exceeded at page ${page} for ${repoFullName}.`;
        if (resetTimestamp) {
          message += ` Try again after ${new Date(resetTimestamp * 1000).toLocaleTimeString()}.`;
        }
        throw new RateLimitError(message, resetTimestamp);
      }
      throw new Error(
        `Error fetching page ${page} for ${repoFullName}: ${resp.status} - ${resp.statusText}`
      );
    }
    const stars: GitHubStargazer[] = await resp.json();
    if (stars.length === 0) {
      return { stars, oldest: null, newest: null };
    }
    const oldest = new Date(stars[0].starred_at);
    const newest = new Date(stars[stars.length - 1].starred_at);
    return { stars, oldest, newest };
  };

  type PageInfo = {
    status: "pending" | "scheduled" | "fetched" | "skipped" | "predicted";
    oldest?: Date | null;
    newest?: Date | null;
  };

  const pages: Record<number, PageInfo> = {};
  for (let p = startPage; p <= endPage; p++) {
    pages[p] = { status: "pending" };
  }

  const taskQueue: Array<{ page: number; start: number; end: number }> = [];

  const sameDay = (a: Date | null | undefined, b: Date | null | undefined) => {
    return (
      a && b && a.toISOString().split("T")[0] === b.toISOString().split("T")[0]
    );
  };

  const markRange = (s: number, e: number) => {
    for (let p = s; p <= e; p++) {
      if (pages[p] && pages[p].status === "pending") {
        pages[p].status = "predicted";
        onProgress();
      } else if (pages[p] && pages[p].status === "scheduled") {
        pages[p].status = "predicted";
      }
    }
  };

  const findPrevFetched = (p: number) => {
    for (let i = p - 1; i >= startPage; i--) {
      if (pages[i] && pages[i].status === "fetched") return i;
    }
    return null;
  };

  const findNextFetched = (p: number) => {
    for (let i = p + 1; i <= endPage; i++) {
      if (pages[i] && pages[i].status === "fetched") return i;
    }
    return null;
  };

  const enqueueRange = (s: number, e: number) => {
    if (s > e) return;
    const mid = Math.floor((s + e) / 2);
    if (pages[mid].status !== "pending") return;
    taskQueue.push({ page: mid, start: s, end: e });
  };

  const pump = () => {
    while (
      taskQueue.length > 0 &&
      pool.getActiveCount() + pool.getQueueLength() < pool.getLimit()
    ) {
      const task = taskQueue.shift()!;
      if (pages[task.page].status !== "pending") continue;
      pages[task.page].status = "scheduled";
      pool.add(async () => {
        if (pages[task.page].status !== "scheduled") {
          return;
        }
        const { stars, oldest, newest } = await fetchPage(task.page);
        onProgress();
        if (!stars.length) {
          pages[task.page].status = "skipped";
        } else if (until && oldest && oldest > until) {
          pages[task.page].status = "skipped";
          markRange(task.page + 1, task.end);
          enqueueRange(task.start, task.page - 1);
        } else if (since && newest && newest < since) {
          pages[task.page].status = "skipped";
          markRange(task.start, task.page - 1);
          enqueueRange(task.page + 1, task.end);
        } else {
          pages[task.page] = { status: "fetched", oldest, newest };
          saveStars(stars);
          const prev = findPrevFetched(task.page);
          if (prev !== null && sameDay(pages[prev].newest, oldest)) {
            markRange(prev + 1, task.page - 1);
          }
          const next = findNextFetched(task.page);
          if (next !== null && sameDay(newest, pages[next].oldest)) {
            markRange(task.page + 1, next - 1);
          }
          enqueueRange(task.start, task.page - 1);
          enqueueRange(task.page + 1, task.end);
        }
        pump();
      });
    }
  };

  const totalPages = endPage - startPage + 1;
  if (totalPages <= 3) {
    for (let p = startPage; p <= endPage; p++) {
      taskQueue.push({ page: p, start: startPage, end: endPage });
    }
  } else {
    const q1 = startPage + Math.floor(totalPages * 0.25);
    const q2 = startPage + Math.floor(totalPages * 0.5);
    const q3 = startPage + Math.floor(totalPages * 0.75);
    for (const p of [q1, q2, q3]) {
      if (p >= startPage && p <= endPage) {
        taskQueue.push({ page: p, start: startPage, end: endPage });
      }
    }
  }

  pump();
  await pool.awaitAll();
};
