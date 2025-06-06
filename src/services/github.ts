import {
  GitHubRepo,
  GitHubStargazer,
  RepoStarHistoryItem,
} from "@/types/github";
import { ConcurrencyPool, WorkerStatus } from "./concurrency";

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

export const fetchUserRepos = async (
  username: string,
  onProgress?: (processedDelta: number, totalPages?: number) => void,
  onStatusChange?: (statuses: WorkerStatus[]) => void
): Promise<GitHubRepo[]> => {
  const token = getGitHubToken();
  const headers = token ? { Authorization: `token ${token}` } : {};
  const perPage = 100;
  const concurrencyLimit = 50;
  const pool = new ConcurrencyPool(concurrencyLimit);
  if (onStatusChange) pool.setStatusCallback(onStatusChange);
  let allRepos: GitHubRepo[] = [];
  let totalPages: number | undefined = undefined;
  let processedPages = 0;

  // Fetch the first page synchronously to get total pages
  const firstResp = await fetch(
    `https://api.github.com/users/${username}/repos?per_page=${perPage}&page=1&sort=updated`,
    { headers }
  );
  if (!firstResp.ok) {
    if (firstResp.status === 403) {
      const reset = firstResp.headers.get("X-RateLimit-Reset");
      const resetTimestamp = reset ? parseInt(reset, 10) : undefined;
      let message = "GitHub API rate limit exceeded.";
      if (resetTimestamp) {
        message += ` Try again after ${new Date(resetTimestamp * 1000).toLocaleTimeString()}.`;
      }
      throw new RateLimitError(message, resetTimestamp);
    }
    throw new Error(
      `GitHub API Error: ${firstResp.status} - ${firstResp.statusText}`
    );
  }
  const linkHeader = firstResp.headers.get("Link");
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
  const firstPageRepos: GitHubRepo[] = await firstResp.json();
  const filteredFirst = firstPageRepos.filter(
    (repo) => repo.stargazers_count > 0
  );
  allRepos = [...allRepos, ...filteredFirst];
  processedPages++;
  if (onProgress) onProgress(1, totalPages);

  // If only one page, return
  if (!totalPages || totalPages === 1) {
    return allRepos;
  }

  // Fetch remaining pages concurrently
  const results: GitHubRepo[][] = Array(totalPages - 1);
  for (let page = 2; page <= totalPages; page++) {
    pool.add(async () => {
      const resp = await fetch(
        `https://api.github.com/users/${username}/repos?per_page=${perPage}&page=${page}&sort=updated`,
        { headers }
      );
      if (!resp.ok) {
        if (resp.status === 403) {
          const reset = resp.headers.get("X-RateLimit-Reset");
          const resetTimestamp = reset ? parseInt(reset, 10) : undefined;
          let message = `GitHub API rate limit exceeded while fetching page ${page}.`;
          if (resetTimestamp) {
            message += ` Try again after ${new Date(resetTimestamp * 1000).toLocaleTimeString()}.`;
          }
          throw new RateLimitError(message, resetTimestamp);
        }
        throw new Error(
          `GitHub API Error: ${resp.status} - ${resp.statusText} while fetching page ${page}`
        );
      }
      const repos: GitHubRepo[] = await resp.json();
      const filtered = repos.filter((repo) => repo.stargazers_count > 0);
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

export interface RateLimitInfo {
  limit: number;
  used: number;
  reset: number;
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
    return {
      limit: core.limit,
      used: core.limit - core.remaining,
      reset: core.reset,
    };
  } catch (error) {
    console.error("Error fetching rate limit:", error);
    return null;
  }
};
