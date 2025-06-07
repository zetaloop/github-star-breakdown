import {
  GitHubRepo,
  GitHubStargazer,
  RepoStarHistoryItem,
} from "@/types/github";
import { ConcurrencyPool, WorkerStatus } from "./concurrency";
import { getRestPool } from "./requestPool";
import { fetchReposREST, fetchReposGraphQL } from "./githubApi";

type ApiMode = "rest" | "graphql";
let currentMode: ApiMode = "rest";
let restReset: number | null = null;
let graphqlReset: number | null = null;
const repoCursorCache: Map<number, string | null> = new Map();
const repoPageCache: Map<number, GitHubRepo[]> = new Map();

const canUseRest = () => !restReset || Date.now() >= restReset * 1000;
const canUseGraphQL = () => !graphqlReset || Date.now() >= graphqlReset * 1000;

const fetchRepoPageGraphQL = async (
  username: string,
  page: number,
  signal: AbortSignal
): Promise<GitHubRepo[]> => {
  const pCache = repoPageCache;
  if (pCache.has(page)) return pCache.get(page)!;
  let last = 0;
  const sorted = Array.from(repoCursorCache.keys()).sort((a, b) => a - b);
  for (const k of sorted) {
    if (k < page) last = k;
  }
  let after = last > 0 ? repoCursorCache.get(last) || undefined : undefined;
  for (let p = last + 1; p <= page; p++) {
    const { repos, endCursor } = await fetchReposGraphQL(
      username,
      after,
      signal
    );
    pCache.set(
      p,
      repos.filter((r) => r.stargazers_count > 0)
    );
    repoCursorCache.set(p, endCursor);
    after = endCursor || undefined;
  }
  return pCache.get(page)!;
};

const fetchAllReposGraphQL = async (
  username: string,
  signal: AbortSignal
): Promise<GitHubRepo[]> => {
  const all: GitHubRepo[] = [];
  let after: string | undefined = undefined;
  let page = 1;
  while (true) {
    const { repos, endCursor, hasNextPage } = await fetchReposGraphQL(
      username,
      after,
      signal
    );
    repoPageCache.set(
      page,
      repos.filter((r) => r.stargazers_count > 0)
    );
    repoCursorCache.set(page, endCursor);
    all.push(...repoPageCache.get(page)!);
    if (!hasNextPage) break;
    after = endCursor || undefined;
    page++;
  }
  return all;
};

export class RateLimitError extends Error {
  public resetTimestamp?: number;

  constructor(message: string, resetTimestamp?: number) {
    super(message);
    this.name = "RateLimitError";
    this.resetTimestamp = resetTimestamp;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export const getGitHubToken = (): string | null => {
  return localStorage.getItem("github_token");
};

export const setGitHubToken = (token: string): void => {
  localStorage.setItem("github_token", token);
};

export const clearGitHubToken = (): void => {
  localStorage.removeItem("github_token");
};

export const isGraphQLEnabled = (): boolean => {
  const val = localStorage.getItem("github_graphql_enabled");
  return val !== "false";
};

export const setGraphQLEnabled = (enabled: boolean): void => {
  localStorage.setItem("github_graphql_enabled", enabled ? "true" : "false");
};

const fetchRepoPage = async (
  username: string,
  page: number,
  signal?: AbortSignal
): Promise<GitHubRepo[]> => {
  const { repos } = await fetchReposREST(username, page, 100, signal);
  return repos.filter((r) => r.stargazers_count > 0);
};

export const fetchUserRepos = async (
  username: string,
  onProgress?: (processedDelta: number, totalPages?: number) => void,
  onStatusChange?: (statuses: WorkerStatus[]) => void
): Promise<GitHubRepo[]> => {
  const perPage = 100;
  const pool = getRestPool();
  if (onStatusChange) pool.setStatusCallback(onStatusChange);
  let allRepos: GitHubRepo[] = [];
  let totalPages: number | undefined = undefined;
  let processedPages = 0;

  // Fetch the first page synchronously to get total pages
  try {
    const { repos: firstPageRepos, linkHeader } = await fetchReposREST(
      username,
      1,
      perPage
    );
    if (linkHeader) {
      const links = linkHeader.split(",");
      const lastPageLink = links.find((link) => link.includes('rel="last"'));
      if (lastPageLink) {
        const match = lastPageLink.match(/[?&]page=(\d+)/);
        if (match) {
          totalPages = parseInt(match[1], 10);
        }
      }
    }
    const filteredFirst = firstPageRepos.filter(
      (repo) => repo.stargazers_count > 0
    );
    allRepos = [...allRepos, ...filteredFirst];
    processedPages++;
    repoPageCache.set(1, filteredFirst);
  } catch (err) {
    throw err;
  }
  if (onProgress) onProgress(1, totalPages);

  // If only one page, return
  if (!totalPages || totalPages === 1) {
    return allRepos;
  }

  // Fetch remaining pages concurrently
  const results: GitHubRepo[][] = Array(totalPages - 1);
  for (let page = 2; page <= totalPages; page++) {
    pool.add(async () => {
      const filtered = await fetchRepoPage(username, page);
      results[page - 2] = filtered;
      if (onProgress) onProgress(1, totalPages);
    });
  }
  await pool.awaitAll();
  if (onStatusChange) onStatusChange(pool.getWorkerStatuses());
  // Flatten and merge all results
  for (const arr of results) {
    if (arr) allRepos.push(...arr);
  }
  return allRepos;
};

export interface RepoFetchControls {
  pausedRef: { current: boolean };
  stopRef: { current: boolean };
  controllers: Map<string, AbortController>;
  onError: (err: Error) => void;
  waitForResume: () => Promise<void>;
}

export const fetchUserReposControlled = async (
  username: string,
  onProgress?: (processedDelta: number, totalPages?: number) => void,
  onStatusChange?: (statuses: WorkerStatus[]) => void,
  controls?: RepoFetchControls
): Promise<GitHubRepo[]> => {
  const perPage = 100;
  const pool = getRestPool();
  if (onStatusChange) pool.setStatusCallback(onStatusChange);

  let totalPages: number | undefined;
  const results: Record<number, GitHubRepo[]> = {};
  const taskQueue: number[] = [];
  const attempts: Record<number, number> = {};

  const fetchPage = async (
    page: number,
    signal: AbortSignal
  ): Promise<GitHubRepo[]> => {
    const { repos } = await fetchReposREST(username, page, perPage, signal);
    return repos.filter((repo) => repo.stargazers_count > 0);
  };

  const processTask = (page: number) => {
    pool.add(async () => {
      const key = `repos:${page}`;
      const controller = new AbortController();
      controls?.controllers.set(key, controller);
      try {
        const repos = await fetchPage(page, controller.signal);
        results[page] = repos;
        onProgress?.(1, totalPages);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          taskQueue.unshift(page);
        } else {
          taskQueue.unshift(page);
          const count = (attempts[page] = (attempts[page] || 0) + 1);
          if (!controls?.pausedRef.current) {
            controls?.onError(err as Error);
            controls?.controllers.forEach((c) => c.abort());
          }
          if (count >= 2) {
            console.error(`Page ${page} failed twice, skipping.`);
            return;
          }
        }
      } finally {
        controls?.controllers.delete(key);
      }
      pump();
    });
  };

  const pump = () => {
    if (!controls) {
      while (
        taskQueue.length > 0 &&
        pool.getActiveCount() + pool.getQueueLength() < pool.getLimit()
      ) {
        const page = taskQueue.shift()!;
        processTask(page);
      }
      return;
    }
    if (controls.pausedRef.current || controls.stopRef.current) return;
    while (
      !controls.pausedRef.current &&
      !controls.stopRef.current &&
      taskQueue.length > 0 &&
      pool.getActiveCount() + pool.getQueueLength() < pool.getLimit()
    ) {
      const page = taskQueue.shift()!;
      processTask(page);
    }
  };

  const fetchFirstPage = async () => {
    while (true) {
      if (controls?.stopRef.current) throw new Error("stopped");
      const key = "repos:1";
      const controller = new AbortController();
      controls?.controllers.set(key, controller);
      let attempt = attempts[1] || 0;
      try {
        const { repos, linkHeader } = await fetchReposREST(
          username,
          1,
          perPage,
          controller.signal
        );
        if (linkHeader) {
          const links = linkHeader.split(",");
          const lastPageLink = links.find((l) => l.includes('rel="last"'));
          if (lastPageLink) {
            const match = lastPageLink.match(/[?&]page=(\d+)/);
            if (match) {
              totalPages = parseInt(match[1], 10);
            }
          }
        }
        results[1] = repos.filter((repo) => repo.stargazers_count > 0);
        onProgress?.(1, totalPages);
        break;
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          attempt++;
          attempts[1] = attempt;
          if (!controls?.pausedRef.current) {
            controls?.onError(err as Error);
            controls?.controllers.forEach((c) => c.abort());
          }
          if (attempt >= 2) {
            throw err;
          }
        }
        if (controls?.stopRef.current) throw new Error("stopped");
        if (controls?.pausedRef.current) await controls.waitForResume();
      } finally {
        controls?.controllers.delete(key);
      }
    }
  };

  await fetchFirstPage();

  if (!totalPages || totalPages === 1) {
    return Object.values(results).flat();
  }

  for (let p = 2; p <= totalPages; p++) {
    taskQueue.push(p);
    attempts[p] = 0;
  }

  pump();
  while (true) {
    await pool.awaitAll();
    if (controls?.stopRef.current) throw new Error("stopped");
    if (controls?.pausedRef.current) await controls.waitForResume();
    if (
      taskQueue.length === 0 &&
      pool.getActiveCount() === 0 &&
      (controls?.controllers.size ?? 0) === 0
    )
      break;
    pump();
  }

  const pages = Object.keys(results)
    .map((n) => parseInt(n, 10))
    .sort((a, b) => a - b);
  const allRepos: GitHubRepo[] = [];
  for (const p of pages) {
    allRepos.push(...results[p]);
  }
  return allRepos;
};

// Parallel binary search and fetch for stargazers in a given date range, with concurrency pool and skip logic

// Process repositories and stargazers into time series data for charting
export const processRepoStarHistory = (
  repos: GitHubRepo[],
  repoStargazers: Map<string, GitHubStargazer[]>,
  options: { type: "year" | "all" | "custom"; from?: Date; to?: Date }
): RepoStarHistoryItem[] => {
  const result: RepoStarHistoryItem[] = [];
  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  let cutoffDate: Date;
  let endDate: Date = now;
  if (options.type === "year") {
    cutoffDate = oneYearAgo;
  } else if (options.type === "custom" && options.from && options.to) {
    cutoffDate = options.from;
    endDate = options.to;
  } else {
    cutoffDate = new Date(0); // Jan 1, 1970
  }

  // Process each repository (already filtered for repos with stars > 0)
  repos.forEach((repo) => {
    const stargazers = repoStargazers.get(repo.full_name) || [];

    // Group stargazers by date (YYYY-MM-DD)
    const starsByDate = new Map<string, number>();
    let earliestStarDate: Date | null = null;
    let latestStarDate: Date | null = null;

    stargazers.forEach((star) => {
      const starDate = new Date(star.starred_at);
      // Skip stars before the cutoff date
      if (starDate >= cutoffDate) {
        const dateKey = starDate.toISOString().split("T")[0]; // YYYY-MM-DD
        starsByDate.set(dateKey, (starsByDate.get(dateKey) || 0) + 1);

        // Track earliest and latest dates within the filtered range
        if (!earliestStarDate || starDate < earliestStarDate) {
          earliestStarDate = starDate;
        }
        if (!latestStarDate || starDate > latestStarDate) {
          latestStarDate = starDate;
        }
      }
    });

    // If we have stars within the date range, fill missing dates with 0 stars
    if (earliestStarDate && latestStarDate) {
      // Ensure start date respects the overall cutoffDate
      const loopStartDate =
        earliestStarDate < cutoffDate ? cutoffDate : earliestStarDate;
      // Ensure end date doesn't exceed today
      const loopEndDate = latestStarDate > endDate ? endDate : latestStarDate;

      for (
        let d = new Date(loopStartDate);
        d <= loopEndDate;
        d.setDate(d.getDate() + 1)
      ) {
        const dateKey = d.toISOString().split("T")[0];
        result.push({
          repoName: repo.name, // Use short name for display
          date: dateKey,
          stars: starsByDate.get(dateKey) || 0,
        });
      }
    } else if (stargazers.length > 0 && options.type === "all") {
      // Handle case where all stars are before the 1-year cutoff but timeRange is 'all'
      // Find the actual earliest and latest star dates overall
      let overallEarliest: Date | null = null;
      let overallLatest: Date | null = null;
      const allStarsByDate = new Map<string, number>(); // Use a separate map for 'all' case
      stargazers.forEach((star) => {
        const starDate = new Date(star.starred_at);
        const dateKey = starDate.toISOString().split("T")[0];
        allStarsByDate.set(dateKey, (allStarsByDate.get(dateKey) || 0) + 1); // Populate the map
        if (!overallEarliest || starDate < overallEarliest)
          overallEarliest = starDate;
        if (!overallLatest || starDate > overallLatest)
          overallLatest = starDate;
      });

      if (overallEarliest && overallLatest) {
        for (
          let d = new Date(overallEarliest);
          d <= overallLatest;
          d.setDate(d.getDate() + 1)
        ) {
          const dateKey = d.toISOString().split("T")[0];
          result.push({
            repoName: repo.name,
            date: dateKey,
            stars: allStarsByDate.get(dateKey) || 0, // Use the correct map here
          });
        }
      }
    }
    // If no stars fall within the range (e.g., timeRange='year' and all stars are older),
    // the repo simply won't contribute any points to the result array.
  });

  // Sort the final result by date primarily, then by repo name secondarily for consistent stacking
  result.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    if (a.repoName < b.repoName) return -1; // Secondary sort by repo name
    if (a.repoName > b.repoName) return 1;
    return 0;
  });

  return result;
};

// Verify if GitHub token is valid
export const verifyGitHubToken = async (token: string): Promise<boolean> => {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${token}`,
      },
    });
    // Consider 401/403 as invalid token, not just network errors
    return response.ok;
  } catch (error) {
    console.error("Error verifying GitHub token:", error);
    return false;
  }
};

export interface RateLimitItem {
  limit: number;
  used: number;
  reset: number;
}

export interface RateLimitInfo {
  core: RateLimitItem;
  graphql: RateLimitItem;
}

export const fetchRateLimit = async (): Promise<RateLimitInfo | null> => {
  const token = getGitHubToken();
  if (!token) return null;
  try {
    const response = await fetch("https://api.github.com/rate_limit", {
      headers: { Authorization: `token ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch rate limit: ${response.status}`);
    }
    const data = await response.json();
    const core = data.resources.core;
    const graphql = data.resources.graphql;
    return {
      core: {
        limit: core.limit,
        used: core.limit - core.remaining,
        reset: core.reset,
      },
      graphql: {
        limit: graphql.limit,
        used: graphql.limit - graphql.remaining,
        reset: graphql.reset,
      },
    };
  } catch (error) {
    console.error("Error fetching rate limit:", error);
    return null;
  }
};
