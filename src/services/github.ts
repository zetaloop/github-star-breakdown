
import { GitHubRepo, GitHubStargazer, RepoStarHistoryItem } from "@/types/github";

// Utility to get GitHub token from localStorage
export const getGitHubToken = (): string | null => {
  return localStorage.getItem('github_token');
};

// Utility to set GitHub token in localStorage
export const setGitHubToken = (token: string): void => {
  localStorage.setItem('github_token', token);
};

// Utility to clear GitHub token from localStorage
export const clearGitHubToken = (): void => {
  localStorage.removeItem('github_token');
};

// Function to fetch a user's public repositories
export const fetchUserRepos = async (username: string): Promise<GitHubRepo[]> => {
  const token = getGitHubToken();
  const headers = token ? { Authorization: `token ${token}` } : {};

  try {
    // GitHub API returns maximum 100 repositories per page, so we need to handle pagination
    let page = 1;
    let allRepos: GitHubRepo[] = [];
    let hasMoreRepos = true;

    while (hasMoreRepos) {
      const response = await fetch(
        `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=updated`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status}`);
      }

      const repos: GitHubRepo[] = await response.json();
      
      // Filter out forks as they don't count towards user's stars
      const nonForkRepos = repos.filter(repo => !repo.fork);
      allRepos = [...allRepos, ...nonForkRepos];
      
      // Check if we got the maximum items per page (indicating there might be more)
      hasMoreRepos = repos.length === 100;
      page++;
    }

    return allRepos;
  } catch (error) {
    console.error("Error fetching repositories:", error);
    throw error;
  }
};

// Function to fetch stargazers for a repository
export const fetchRepoStargazers = async (
  repoFullName: string, 
  sinceDate?: string
): Promise<GitHubStargazer[]> => {
  const token = getGitHubToken();
  
  // We need the token for this endpoint as it requires the application/vnd.github.star+json media type
  if (!token) {
    throw new Error("GitHub token is required to fetch stargazers with dates");
  }

  try {
    const headers = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.star+json'
    };

    let page = 1;
    let allStargazers: GitHubStargazer[] = [];
    let hasMoreStargazers = true;

    // Date filter for the API query
    const sinceQuery = sinceDate ? `&since=${sinceDate}` : '';

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

// Process repositories and stargazers into time series data for charting
export const processRepoStarHistory = (
  repos: GitHubRepo[], 
  repoStargazers: Map<string, GitHubStargazer[]>,
  timeRange: 'year' | 'all'
): RepoStarHistoryItem[] => {
  const result: RepoStarHistoryItem[] = [];
  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  
  // Calculate the cutoff date based on selected time range
  const cutoffDate = timeRange === 'year' ? oneYearAgo : new Date(0);
  
  // Process each repository
  repos.forEach(repo => {
    const stargazers = repoStargazers.get(repo.full_name) || [];
    
    // Group stargazers by date (YYYY-MM-DD)
    const starsByDate = new Map<string, number>();
    
    stargazers.forEach(star => {
      const starDate = new Date(star.starred_at);
      // Skip stars before the cutoff date
      if (starDate >= cutoffDate) {
        const dateKey = starDate.toISOString().split('T')[0]; // YYYY-MM-DD
        starsByDate.set(dateKey, (starsByDate.get(dateKey) || 0) + 1);
      }
    });
    
    // Convert to array and sort by date
    const sortedDates = Array.from(starsByDate.keys()).sort();
    
    sortedDates.forEach(date => {
      result.push({
        repoName: repo.name,
        date,
        stars: starsByDate.get(date) || 0
      });
    });
  });
  
  return result;
};

// Verify if GitHub token is valid
export const verifyGitHubToken = async (token: string): Promise<boolean> => {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`
      }
    });
    return response.ok;
  } catch (error) {
    console.error("Error verifying GitHub token:", error);
    return false;
  }
};
