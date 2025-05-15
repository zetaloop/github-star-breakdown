import {
  GitHubRepo,
  GitHubStargazer,
  RepoStarHistoryItem,
} from "@/types/github";

// Utility to get GitHub token from localStorage
export const getGitHubToken = (): string | null => {
  return localStorage.getItem("github_token");
};

// Utility to set GitHub token in localStorage
export const setGitHubToken = (token: string): void => {
  localStorage.setItem("github_token", token);
};

// Utility to clear GitHub token from localStorage
export const clearGitHubToken = (): void => {
  localStorage.removeItem("github_token");
};

// ConcurrencyPool: A simple concurrency limiter for async tasks (max concurrency = limit)
export class ConcurrencyPool {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private limit: number;
  private allDone: (() => void)[] = [];
  private donePromise: Promise<void>;

  constructor(limit: number) {
    this.limit = limit;
    this.donePromise = new Promise((resolve) => this.allDone.push(resolve));
  }

  add(taskFunc: () => Promise<void>) {
    this.queue.push(taskFunc);
    this.runNext();
  }

  private runNext() {
    if (this.activeCount < this.limit && this.queue.length > 0) {
      const taskFunc = this.queue.shift()!;
      this.activeCount++;
      taskFunc().finally(() => {
        this.activeCount--;
        this.runNext();
        if (this.activeCount === 0 && this.queue.length === 0) {
          this.allDone.forEach((cb) => cb());
        }
      });
    }
  }

  async awaitAll() {
    if (this.activeCount === 0 && this.queue.length === 0) return;
    await this.donePromise;
  }
}

// Function to fetch a user's public repositories (concurrent version)
export const fetchUserRepos = async (
  username: string,
  onProgress?: (processedDelta: number, totalPages?: number) => void // Optional callback for progress updates
): Promise<GitHubRepo[]> => {
  const token = getGitHubToken();
  const headers = token ? { Authorization: `token ${token}` } : {};
  const perPage = 100;
  const concurrencyLimit = 50;
  const pool = new ConcurrencyPool(concurrencyLimit);
  let allRepos: GitHubRepo[] = [];
  let totalPages: number | undefined = undefined;
  let processedPages = 0;

  // Fetch the first page synchronously to get total pages
  const firstResp = await fetch(
    `https://api.github.com/users/${username}/repos?per_page=${perPage}&page=1&sort=updated`,
    { headers }
  );
  if (!firstResp.ok) {
    throw new Error(`GitHub API Error: ${firstResp.status}`);
  }
  const linkHeader = firstResp.headers.get("Link");
  if (linkHeader) {
    const links = linkHeader.split(",");
    const lastPageLink = links.find((link) => link.includes('rel="last"'));
    if (lastPageLink) {
      const match = lastPageLink.match(/page=(\d+)/);
      if (match) {
        totalPages = parseInt(match[1], 10);
      }
    }
  }
  const firstPageRepos: GitHubRepo[] = await firstResp.json();
  const filteredFirst = firstPageRepos.filter(
    (repo) => !repo.fork && repo.stargazers_count > 0
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
        throw new Error(`GitHub API Error: ${resp.status}`);
      }
      const repos: GitHubRepo[] = await resp.json();
      const filtered = repos.filter(
        (repo) => !repo.fork && repo.stargazers_count > 0
      );
      results[page - 2] = filtered;
      if (onProgress) onProgress(1, totalPages);
    });
  }
  await pool.awaitAll();
  // Flatten and merge all results
  for (const arr of results) {
    if (arr) allRepos.push(...arr);
  }
  return allRepos;
};

// New helper to fetch only the first page of stargazers
export const fetchRepoStargazersFirstPage = async (
  repoFullName: string
): Promise<{ stargazers: GitHubStargazer[]; incomplete: boolean }> => {
  const token = getGitHubToken();
  if (!token) {
    throw new Error("GitHub token required for stargazers");
  }
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.star+json",
  };
  // REMOVED sinceQuery from URL
  const url = `https://api.github.com/repos/${repoFullName}/stargazers?per_page=100&page=1`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    // Handle rate limiting specifically
    if (response.status === 403) {
      console.warn(`Rate limited fetching first page for ${repoFullName}`);
      // Depending on requirements, you might want to return empty or throw a specific error
      return { stargazers: [], incomplete: true }; // Assume incomplete if rate limited
    }
    throw new Error(
      `GitHub API Error fetching first page for ${repoFullName}: ${response.status}`
    );
  }
  const firstPageData: GitHubStargazer[] = await response.json();
  // Determine if more pages likely (100 received or GitHub indicated more via Link header - simpler check here)
  // A more robust check could involve parsing the 'Link' header if present.
  const moreData = firstPageData.length === 100;
  return { stargazers: firstPageData, incomplete: moreData };
};

// Parallel binary search and fetch for stargazers in a given date range, with concurrency pool and skip logic
export const fetchStargazersInRange = async (
  repoFullName: string,
  startPage: number, // usually 2
  endPage: number, // total pages for this repo
  pool: ConcurrencyPool,
  onProgress: (delta?: number) => void,
  saveStars: (stars: GitHubStargazer[]) => void,
  since?: Date,
  until?: Date
) => {
  // Helper to fetch a single page and return stargazers + date range
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
        console.warn(`Rate limited at page ${page} for ${repoFullName}`);
        return { stars: [], pageNewest: null, pageOldest: null };
      }
      throw new Error(
        `Error fetching page ${page} for ${repoFullName}: ${resp.status}`
      );
    }
    const stars: GitHubStargazer[] = await resp.json();
    if (stars.length === 0) {
      return { stars, pageNewest: null, pageOldest: null };
    }
    const pageNewest = new Date(stars[0].starred_at);
    const pageOldest = new Date(stars[stars.length - 1].starred_at);
    return { stars, pageNewest, pageOldest };
  };

  // Recursive binary search with parallelism
  const recur = async (s: number, e: number): Promise<void> => {
    if (s > e) return;
    const mid = Math.floor((s + e) / 2);
    await pool.add(async () => {
      const { stars, pageNewest, pageOldest } = await fetchPage(mid);
      onProgress(); // Always count this page as processed
      if (!stars.length || !pageNewest || !pageOldest) return;
      // If the page is entirely too new (all stars newer than `until`), skip left side pages [s..mid-1]
      if (until && pageNewest > until) {
        const skipped = mid - s;
        if (skipped > 0) onProgress(skipped);
        await recur(mid + 1, e);
        return;
      }
      // If the page is entirely too old (all stars older than `since`), skip right side pages [mid+1..e]
      if (since && pageOldest < since) {
        const skipped = e - mid;
        if (skipped > 0) onProgress(skipped);
        await recur(s, mid - 1);
        return;
      }
      // This page has data in range
      saveStars(stars);
      // Recurse both sides in parallel
      const left = s < mid ? recur(s, mid - 1) : Promise.resolve();
      const right = mid < e ? recur(mid + 1, e) : Promise.resolve();
      await Promise.all([left, right]);
    });
  };
  await recur(startPage, endPage);
  await pool.awaitAll();
};

// Process repositories and stargazers into time series data for charting
export const processRepoStarHistory = (
  repos: GitHubRepo[],
  repoStargazers: Map<string, GitHubStargazer[]>,
  timeRange: "year" | "all"
): RepoStarHistoryItem[] => {
  const result: RepoStarHistoryItem[] = [];
  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  // Calculate the cutoff date based on selected time range
  const cutoffDate = timeRange === "year" ? oneYearAgo : new Date(0); // Jan 1, 1970

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
      const loopEndDate = latestStarDate > now ? now : latestStarDate;

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
    } else if (stargazers.length > 0 && timeRange === "all") {
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
