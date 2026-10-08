export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  created_at: string;
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

export interface StarHistoryDay {
  date: string;
  stars: number;
}

export interface RepoHistory {
  days: StarHistoryDay[];
  total: number;
}

export interface DateBounds {
  from: string;
  to: string;
}

export type AnalysisStatus =
  | "idle"
  | "loading"
  | "paused"
  | "complete"
  | "stopped";

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
  bounds: DateBounds;
  repos: GitHubRepo[];
  history: Map<number, RepoHistory>;
}
