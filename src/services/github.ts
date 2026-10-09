import type {
  AnalysisProgress,
  DateBounds,
  GitHubRepo,
  RepoHistory,
  StarHistoryWeek,
  TimeRange,
} from "@/types/github";
import type { GitHubPage } from "./githubApi";
import { dailyHistory, dateBounds, historyPages } from "./history";

interface AnalysisCallbacks {
  request: <T>(path: string) => Promise<GitHubPage<T>>;
  onRepos: (repos: GitHubRepo[], bounds: DateBounds) => void;
  onHistory: (id: number, history: RepoHistory) => void;
  onProgress: (progress: Omit<AnalysisProgress, "requests">) => void;
}

export async function analyzeUser(
  username: string,
  range: TimeRange,
  { request, onRepos, onHistory, onProgress }: AnalysisCallbacks,
) {
  const bounds = dateBounds(range);
  const repoPath = `users/${encodeURIComponent(username)}/repos?per_page=100&sort=full_name`;
  const first = await request<GitHubRepo[]>(`${repoPath}&page=1`);
  let completedPages = 1;
  onProgress({ stage: "repos", completed: completedPages, total: first.pages });
  const remaining = await Promise.all(
    Array.from({ length: first.pages - 1 }, async (_, index) => {
      const result = await request<GitHubRepo[]>(
        `${repoPath}&page=${index + 2}`,
      );
      onProgress({
        stage: "repos",
        completed: ++completedPages,
        total: first.pages,
      });
      return result.data;
    }),
  );
  const repos = [first.data, ...remaining]
    .flat()
    .filter((repo) => repo.stargazers_count > 0);
  onRepos(repos, bounds);
  onProgress({ stage: "history", completed: 0, total: repos.length });
  let completed = 0;
  await Promise.all(
    repos.map(async (repo) => {
      const path = `repos/${repo.full_name}/stargazers/history`;
      const initial = await request<StarHistoryWeek[]>(path);
      let weeks: StarHistoryWeek[] = [];
      if (initial.data.length) {
        const { first, last } = historyPages(
          initial.data[0].week,
          initial.pages,
          bounds,
        );
        const pages = await Promise.all(
          Array.from(
            { length: Math.max(0, last - first + 1) },
            async (_, index) => {
              const page = first + index;
              return page === 1
                ? initial.data
                : (await request<StarHistoryWeek[]>(`${path}?page=${page}`))
                    .data;
            },
          ),
        );
        weeks = pages.flat();
      }
      const days = dailyHistory(weeks, bounds);
      onHistory(repo.id, {
        days,
        total: days.reduce((sum, entry) => sum + entry.stars, 0),
      });
      onProgress({
        stage: "history",
        completed: ++completed,
        total: repos.length,
      });
    }),
  );
}
