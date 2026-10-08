import type {
  AnalysisProgress,
  GitHubRepo,
  RepoStarHistoryItem,
  StarHistoryWeek,
  TimeRange,
} from "@/types/github";
import type { GitHubPage } from "./githubApi";
import { dailyHistory, dateBounds, historyPages } from "./history";

interface AnalysisCallbacks {
  request: <T>(path: string) => Promise<GitHubPage<T>>;
  onRepos: (repos: GitHubRepo[]) => void;
  onHistory: (history: RepoStarHistoryItem[]) => void;
  onProgress: (progress: Omit<AnalysisProgress, "requests">) => void;
}

export async function analyzeUser(
  username: string,
  range: TimeRange,
  { request, onRepos, onHistory, onProgress }: AnalysisCallbacks
) {
  const repos: GitHubRepo[] = [];
  const repoPath = `users/${encodeURIComponent(username)}/repos?per_page=100&sort=full_name`;
  let repoPages = 1;
  for (let page = 1; page <= repoPages; page++) {
    const result = await request<GitHubRepo[]>(`${repoPath}&page=${page}`);
    if (page === 1) repoPages = result.pages;
    repos.push(...result.data.filter((repo) => repo.stargazers_count > 0));
    onProgress({ stage: "repos", completed: page, total: repoPages });
  }
  onRepos(repos);
  onProgress({ stage: "history", completed: 0, total: repos.length });
  const bounds = dateBounds(range);
  let index = 0;
  let completed = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, repos.length) }, async () => {
      while (index < repos.length) {
        const repo = repos[index++];
        const path = `repos/${repo.full_name}/stargazers/history`;
        const initial = await request<StarHistoryWeek[]>(path);
        const weeks: StarHistoryWeek[] = [];
        if (initial.data.length) {
          const pages = historyPages(initial.data[0].week, initial.pages, bounds);
          if (pages.first === 1) weeks.push(...initial.data);
          for (let page = Math.max(2, pages.first); page <= pages.last; page++) {
            const result = await request<StarHistoryWeek[]>(`${path}?page=${page}`);
            weeks.push(...result.data);
          }
        }
        onHistory(dailyHistory(repo.name, weeks, bounds));
        onProgress({ stage: "history", completed: ++completed, total: repos.length });
      }
    })
  );
}
