import { GitHubRepo, GitHubStargazer } from "@/types/github";
import { getGitHubToken, RateLimitError } from "./github";

export interface RepoPageResult {
  repos: GitHubRepo[];
  linkHeader: string | null;
}

export const fetchReposREST = async (
  username: string,
  page: number,
  perPage = 100,
  signal?: AbortSignal
): Promise<RepoPageResult> => {
  const token = getGitHubToken();
  const headers = token ? { Authorization: `token ${token}` } : {};
  const resp = await fetch(
    `https://api.github.com/users/${username}/repos?per_page=${perPage}&page=${page}&sort=updated`,
    { headers, signal }
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
  const linkHeader = resp.headers.get("Link");
  return { repos, linkHeader };
};

export interface StargazerPageResult {
  stars: GitHubStargazer[];
  oldest: Date | null;
  newest: Date | null;
}

export const fetchStargazersREST = async (
  repoFullName: string,
  page: number,
  signal?: AbortSignal
): Promise<StargazerPageResult> => {
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
    let errorMessage = `Error fetching page ${page} for ${repoFullName}: [${resp.status}]`;
    try {
      const errorData = await resp.json();
      if (errorData.message) {
        errorMessage = `Error fetching page ${page} for ${repoFullName}: [${resp.status}] ${errorData.message}`;
      }
    } catch (e) {
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

export interface GraphQLRepoPageResult {
  repos: GitHubRepo[];
  endCursor: string | null;
  hasNextPage: boolean;
}

export const fetchReposGraphQL = async (
  username: string,
  after?: string,
  signal?: AbortSignal
): Promise<GraphQLRepoPageResult> => {
  const token = getGitHubToken();
  if (!token) throw new Error("GitHub token is required");
  const query = `query($login: String!, $after: String) {
    user(login: $login) {
      repositories(first: 100, after: $after, orderBy: {field: UPDATED_AT, direction: DESC}) {
        nodes {
          databaseId
          name
          nameWithOwner
          description
          stargazerCount
          createdAt
          updatedAt
          pushedAt
          primaryLanguage { name }
          isFork
          url
          owner { login avatarUrl }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;
  const resp = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { login: username, after } }),
    signal,
  });
  if (!resp.ok) {
    if (resp.status === 403) {
      const reset = resp.headers.get("X-RateLimit-Reset");
      const resetTimestamp = reset ? parseInt(reset, 10) : undefined;
      let message = `GitHub GraphQL API rate limit exceeded while fetching repos for ${username}.`;
      if (resetTimestamp) {
        message += ` Try again after ${new Date(resetTimestamp * 1000).toLocaleTimeString()}.`;
      }
      throw new RateLimitError(message, resetTimestamp);
    }
    throw new Error(
      `GitHub GraphQL API Error: ${resp.status} - ${resp.statusText}`
    );
  }
  const data = await resp.json();
  if (data.errors) {
    throw new Error(
      data.errors.map((e: { message: string }) => e.message).join("; ")
    );
  }
  const repoNodes = (data.data.user?.repositories.nodes || []) as Array<{
    databaseId: number;
    name: string;
    nameWithOwner: string;
    description: string | null;
    stargazerCount: number;
    createdAt: string;
    updatedAt: string;
    pushedAt: string;
    primaryLanguage: { name: string } | null;
    isFork: boolean;
    url: string;
    owner: { login: string; avatarUrl: string };
  }>;
  const repos: GitHubRepo[] = repoNodes.map((node) => ({
    id: node.databaseId,
    name: node.name,
    full_name: node.nameWithOwner,
    description: node.description,
    stargazers_count: node.stargazerCount,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
    pushed_at: node.pushedAt,
    language: node.primaryLanguage ? node.primaryLanguage.name : null,
    fork: node.isFork,
    html_url: node.url,
    owner: {
      login: node.owner.login,
      avatar_url: node.owner.avatarUrl,
    },
  }));
  const pageInfo = data.data.user?.repositories.pageInfo;
  return {
    repos,
    endCursor: pageInfo.endCursor,
    hasNextPage: pageInfo.hasNextPage,
  };
};

export interface GraphQLStargazerPageResult {
  stars: GitHubStargazer[];
  endCursor: string | null;
  hasNextPage: boolean;
}

export const fetchStargazersGraphQL = async (
  repoFullName: string,
  after?: string,
  signal?: AbortSignal
): Promise<GraphQLStargazerPageResult> => {
  const token = getGitHubToken();
  if (!token) throw new Error("GitHub token is required");
  const [owner, name] = repoFullName.split("/");
  const query = `query($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      stargazers(first: 100, after: $after) {
        edges {
          starredAt
          node { login }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;
  const resp = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { owner, name, after } }),
    signal,
  });
  if (!resp.ok) {
    if (resp.status === 403) {
      const reset = resp.headers.get("X-RateLimit-Reset");
      const resetTimestamp = reset ? parseInt(reset, 10) : undefined;
      let message = `GitHub GraphQL API rate limit exceeded while fetching stargazers for ${repoFullName}.`;
      if (resetTimestamp) {
        message += ` Try again after ${new Date(resetTimestamp * 1000).toLocaleTimeString()}.`;
      }
      throw new RateLimitError(message, resetTimestamp);
    }
    throw new Error(
      `GitHub GraphQL API Error: ${resp.status} - ${resp.statusText}`
    );
  }
  const data = await resp.json();
  if (data.errors) {
    throw new Error(
      data.errors.map((e: { message: string }) => e.message).join("; ")
    );
  }
  const edges = (data.data.repository?.stargazers.edges || []) as Array<{
    starredAt: string;
    node: { login: string };
  }>;
  const stars: GitHubStargazer[] = edges.map((edge) => ({
    starred_at: edge.starredAt,
    user: { login: edge.node.login },
  }));
  const pageInfo = data.data.repository?.stargazers.pageInfo;
  return {
    stars,
    endCursor: pageInfo.endCursor,
    hasNextPage: pageInfo.hasNextPage,
  };
};
