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

// Function to fetch a user's public repositories
export const fetchUserRepos = async (
  username: string,
  onProgress?: (processedDelta: number, totalPages?: number) => void // Optional callback for progress updates
): Promise<GitHubRepo[]> => {
  const token = getGitHubToken();
  const headers = token ? { Authorization: `token ${token}` } : {};

  try {
    // GitHub API returns maximum 100 repositories per page, so we need to handle pagination
    let page = 1;
    let allRepos: GitHubRepo[] = [];
    let hasMoreRepos = true;
    let totalPages: number | undefined = undefined; // Store total pages if available

    while (hasMoreRepos) {
      const response = await fetch(
        `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=updated`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status}`);
      }

      // Try to parse Link header for total pages (more reliable)
      const linkHeader = response.headers.get("Link");
      if (linkHeader && !totalPages) {
        const links = linkHeader.split(",");
        const lastPageLink = links.find((link) => link.includes('rel="last"'));
        if (lastPageLink) {
          const match = lastPageLink.match(/page=(\d+)/);
          if (match) {
            totalPages = parseInt(match[1], 10);
          }
        }
      }

      const repos: GitHubRepo[] = await response.json();

      // Call progress callback after fetching a page
      if (onProgress) {
        onProgress(1, totalPages); // Pass 1 for delta, and totalPages if known
      }

      // Filter out forks and repos with 0 stars as they don't count towards user's stars
      const filteredRepos = repos.filter(
        (repo) => !repo.fork && repo.stargazers_count > 0
      );
      allRepos = [...allRepos, ...filteredRepos];

      // Check if we got the maximum items per page (indicating there might be more)
      // Or check if we have reached the last page based on Link header
      hasMoreRepos = repos.length === 100 && (!totalPages || page < totalPages);
      page++;
    }

    return allRepos;
  } catch (error) {
    console.error("Error fetching repositories:", error);
    throw error;
  }
};

// Function to fetch stargazers for a repository (original, kept for potential reference or specific use cases)
// Note: This version still includes sinceDate for potential specific use cases, but the optimized versions below do not.
//! TODO: GITHUB API DOES NOT SUPPORT SINCE DATE FOR STARGAZERS! THIS IS OLD IMPLEMENTATION AND WRONG.
export const fetchRepoStargazers = async (
  repoFullName: string,
  sinceDate?: string // Kept here for potential backward compatibility or specific needs
): Promise<GitHubStargazer[]> => {
  const token = getGitHubToken();

  // We need the token for this endpoint as it requires the application/vnd.github.star+json media type
  if (!token) {
    throw new Error("GitHub token is required to fetch stargazers with dates");
  }

  try {
    const headers = {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.star+json",
    };

    let page = 1;
    let allStargazers: GitHubStargazer[] = [];
    let hasMoreStargazers = true;

    // Date filter for the API query (only if sinceDate is provided)
    const sinceQuery = sinceDate ? `&since=${sinceDate}` : "";

    while (hasMoreStargazers) {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/stargazers?per_page=100&page=${page}${sinceQuery}`,
        { headers }
      );

      if (!response.ok) {
        // If we hit rate limits, return what we have so far
        if (response.status === 403) {
          console.warn("Rate limited by GitHub API, returning partial data");
          return allStargazers;
        }
        throw new Error(`GitHub API Error: ${response.status}`);
      }

      const stargazers: GitHubStargazer[] = await response.json();
      allStargazers = [...allStargazers, ...stargazers];

      // Check if we got the maximum items per page (indicating there might be more)
      hasMoreStargazers = stargazers.length === 100;
      page++;
    }

    return allStargazers;
  } catch (error) {
    console.error(`Error fetching stargazers for ${repoFullName}:`, error);
    throw error;
  }
};

// New helper to fetch only the first page of stargazers
// REMOVED sinceDate parameter as it's not used by the API for filtering stargazers by date.
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

// Optimized fetch for remaining pages with time-distribution skip logic
// REMOVED sinceDate parameter.
// ADDED onProgress callback.
export const fetchRemainingStargazersOptimized = async (
  repoFullName: string,
  startPage: number, // typically 2
  // It's helpful to know the total stars to calculate total pages accurately for progress.
  // This can be passed from GitHubRepo.stargazers_count.
  // If not provided, totalPages might remain Infinity and loop until no more stars.
  totalRepoStars?: number,
  // Optional callback for progress updates (called per page fetched/processed)
  onProgress?: () => void
): Promise<GitHubStargazer[]> => {
  const token = getGitHubToken();
  if (!token) throw new Error("GitHub token is required for further loading");
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.star+json",
  };

  const allAdditionalStars: GitHubStargazer[] = []; // Use const as it's not reassigned
  let currentPage = startPage;
  let currentDay: string | null = null; // Tracks the date of the *oldest* star processed so far in the optimization logic

  // Calculate total pages if totalRepoStars is known
  let totalPages = Infinity;
  if (totalRepoStars) {
    // We start fetching from startPage, so adjust total pages calculation if needed,
    // but generally, total stars / per_page gives the overall page count.
    totalPages = Math.ceil(totalRepoStars / 100);
  }

  // Loop through remaining pages
  while (currentPage <= totalPages) {
    // REMOVED sinceQuery from URL
    const url = `https://api.github.com/repos/${repoFullName}/stargazers?per_page=100&page=${currentPage}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      if (resp.status === 403) {
        console.warn(
          `Rate limited during optimized fetch for ${repoFullName} at page ${currentPage}`
        );
        break; // stop if rate-limited (return what we have so far)
      }
      // Handle 404 Not Found - might indicate repo deleted or private during fetch
      if (resp.status === 404) {
        console.warn(
          `Repository ${repoFullName} not found during fetch at page ${currentPage}.`
        );
        break;
      }
      // Handle 422 Validation Failed - often happens if page number is too high
      if (resp.status === 422) {
        console.warn(
          `Validation failed fetching page ${currentPage} for ${repoFullName}. Likely past the last page.`
        );
        break; // Stop fetching if validation fails (likely past the end)
      }
      throw new Error(
        `Error fetching page ${currentPage} for ${repoFullName}: ${resp.status}`
      );
    }
    const starsPage: GitHubStargazer[] = await resp.json();

    // Call progress callback after successfully fetching a page's data
    if (onProgress) {
      onProgress();
    }

    if (starsPage.length === 0) {
      break; // no more stargazers (end of list)
    }

    // Add stars from the current page *before* date logic
    allAdditionalStars.push(...starsPage);

    // --- Time-based Skipping Logic ---
    // Get the date (YYYY-MM-DD) of the newest and oldest star on the current page.
    // The API returns newest first with the 'star+json' header.
    const newestStarDateOnPage = new Date(starsPage[0].starred_at)
      .toISOString()
      .split("T")[0];
    const oldestStarDateOnPage = new Date(
      starsPage[starsPage.length - 1].starred_at
    )
      .toISOString()
      .split("T")[0];

    if (!currentDay) {
      // Initialize currentDay with the date of the *oldest* star from the first page fetched in this optimized run (page `startPage`).
      // This sets the baseline for comparison.
      currentDay = oldestStarDateOnPage;
    }

    // Optimization Check:
    // If the *entire page* consists of stars from the *same day*, AND that day is the *same* as `currentDay`
    // (the oldest day we were processing from the *previous* page), it implies this day spans multiple pages.
    // The user's plan suggests continuing without changing `currentDay` in this scenario.
    // This doesn't strictly *skip* API calls based on the snippet, but it avoids updating `currentDay`,
    // effectively grouping consecutive pages of the same day together.
    if (
      newestStarDateOnPage === oldestStarDateOnPage &&
      oldestStarDateOnPage === currentDay
    ) {
      // All stars on this page are from the same day (`currentDay`).
      // Continue to the next page without changing `currentDay`.
      currentPage++;
      // The 'continue' ensures we fetch the next page immediately.
      continue;
    } else {
      // This page contains stars from a new (older) day or spans multiple days.
      // Update `currentDay` to the date of the *oldest* star on *this* page,
      // as that's the boundary day we've now processed up to.
      currentDay = oldestStarDateOnPage;
      currentPage++;
    }
    // --- End Time-based Skipping Logic ---

    // If we fetched less than 100, it must be the last page
    if (starsPage.length < 100) {
      break;
    }
  }

  return allAdditionalStars;
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
