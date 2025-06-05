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
      return { stars, pageNewest: null, pageOldest: null };
    }
    const pageOldest = new Date(stars[0].starred_at);
    const pageNewest = new Date(stars[stars.length - 1].starred_at);
    return { stars, pageNewest, pageOldest };
  };

  const scheduled = new Set<number>();
  const fetchedPages: number[] = [];
  const skippedPages: number[] = [];
  const predictedPages: number[] = [];

  const recur = (s: number, e: number): void => {
    if (s > e) return;
    const mid = Math.floor((s + e) / 2);
    if (scheduled.has(mid)) {
      recur(s, mid - 1);
      recur(mid + 1, e);
      return;
    }
    scheduled.add(mid);
    pool.add(async () => {
      const { stars, pageNewest, pageOldest } = await fetchPage(mid);
      onProgress();
      if (!stars.length || !pageNewest || !pageOldest) {
        skippedPages.push(mid);
        return;
      }

      if (until && pageOldest > until) {
        const skipped = e - mid;
        if (skipped > 0) {
          onProgress(skipped);
          for (let p = mid + 1; p <= e; p++) predictedPages.push(p);
        }
        skippedPages.push(mid);
        recur(s, mid - 1);
        return;
      }

      if (since && pageNewest < since) {
        const skipped = mid - s;
        if (skipped > 0) {
          onProgress(skipped);
          for (let p = s; p < mid; p++) predictedPages.push(p);
        }
        skippedPages.push(mid);
        recur(mid + 1, e);
        return;
      }

      fetchedPages.push(mid);
      saveStars(stars);
      recur(s, mid - 1);
      recur(mid + 1, e);
    });
  };

  const totalPages = endPage - startPage + 1;
  const step = Math.max(1, Math.floor(totalPages / 50));
  for (let p = startPage; p <= endPage; p += step) {
    recur(p, p);
  }
  recur(startPage, endPage);
  await pool.awaitAll();

  if (fetchedPages.length + skippedPages.length + predictedPages.length > 0) {
    console.log(`Repo ${repoFullName} fetch summary`, {
      fetched: fetchedPages.sort((a, b) => a - b),
      skipped: skippedPages.sort((a, b) => a - b),
      predicted: predictedPages.sort((a, b) => a - b),
    });
  }
};
