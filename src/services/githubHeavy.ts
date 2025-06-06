import { GitHubStargazer } from "@/types/github";
import { getGitHubToken, RateLimitError } from "./github";
export const fetchStargazerPage = async (
  repoFullName: string,
  page: number,
  signal?: AbortSignal
) => {
  const token = getGitHubToken();
  if (!token) throw new Error("GitHub token is required");
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.star+json",
  };

  const url = `https://api.github.com/repos/${repoFullName}/stargazers?per_page=100&page=${page}`;
  const resp = await fetch(url, { headers, signal });
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
    // Try to get error message from response body
    let errorMessage = `Error fetching page ${page} for ${repoFullName}: [${resp.status}]`;
    try {
      const errorData = await resp.json();
      if (errorData.message) {
        errorMessage = `Error fetching page ${page} for ${repoFullName}: [${resp.status}] ${errorData.message}`;
      }
    } catch (e) {
      // If JSON parsing fails, fall back to status text
      const statusText = resp.statusText ? ` - ${resp.statusText}` : "";
      errorMessage = `Error fetching page ${page} for ${repoFullName}: [${resp.status}] ${statusText}`;
    }
    throw new Error(errorMessage);
  }
  const stars: GitHubStargazer[] = await resp.json();
  if (stars.length === 0) {
    return { stars, oldest: null, newest: null };
  }
  const oldest = new Date(stars[0].starred_at);
  const newest = new Date(stars[stars.length - 1].starred_at);
  return { stars, oldest, newest };
};

export type PageInfo = {
  status:
    | "pending"
    | "scheduled"
    | "fetched"
    | "skipped"
    | "predicted"
    | "failed";
  oldest?: Date | null;
  newest?: Date | null;
};
