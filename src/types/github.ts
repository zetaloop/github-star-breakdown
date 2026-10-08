// GitHub API response types
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  language: string | null;
  fork: boolean;
  html_url: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface StarHistoryWeek {
  week: number;
  total: number;
  days: number[];
}

export interface RepoStarHistoryItem {
  repoName: string;
  date: string;
  stars: number;
}

export type TimeRange =
  | { type: "year" | "all" }
  | { type: "custom"; from: Date; to: Date };

export interface AnalysisProgress {
  stage: "repos" | "history";
  completed: number;
  total: number;
  requests: number;
}

export interface AnalysisResult {
  username: string;
  range: TimeRange;
  repos: GitHubRepo[];
  history: RepoStarHistoryItem[];
}
