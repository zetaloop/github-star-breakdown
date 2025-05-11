
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

export interface GitHubStargazer {
  starred_at: string;
  user: {
    login: string;
  };
}

export interface RepoStarHistoryItem {
  repoName: string;
  date: string;
  stars: number;
}
