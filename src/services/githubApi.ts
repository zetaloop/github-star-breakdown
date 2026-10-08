export const getGitHubToken = () => localStorage.getItem("github_token");

export const setGitHubToken = (token: string) =>
  localStorage.setItem("github_token", token.trim());

export const clearGitHubToken = () => localStorage.removeItem("github_token");

export interface GitHubPage<T> {
  data: T;
  pages: number;
}

export async function fetchGitHub<T>(
  path: string,
  signal?: AbortSignal,
  token = getGitHubToken(),
): Promise<GitHubPage<T>> {
  if (!token) throw new Error("请先填写 GitHub Token。");
  const response = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2026-03-10",
    },
    signal,
  });
  if (!response.ok) {
    const detail = await response.json();
    let message = detail.message || response.statusText;
    if (response.status === 401) {
      message = "GitHub Token 无效或已过期，请在设置中更新。";
    } else if (
      response.status === 429 ||
      (response.status === 403 &&
        response.headers.get("X-RateLimit-Remaining") === "0")
    ) {
      const reset = Number(response.headers.get("X-RateLimit-Reset"));
      const retry = Number(response.headers.get("Retry-After"));
      const time = retry ? Date.now() + retry * 1000 : reset * 1000;
      message = time
        ? `GitHub 请求额度不足，可在 ${new Date(time).toLocaleTimeString()} 后重试。`
        : "GitHub 暂时限制了请求频率，请稍后重试。";
    } else if (response.status === 404) {
      message = "GitHub 找不到此用户或仓库，或当前 Token 无权访问。";
    }
    throw new Error(`${message} [${response.status}, ${path}]`);
  }
  const last = response.headers
    .get("Link")
    ?.split(",")
    .find((link) => link.includes('rel="last"'));
  const match = last?.match(/[?&]page=(\d+)/);
  return { data: await response.json(), pages: match ? Number(match[1]) : 1 };
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
}

export async function fetchGitHubUser(token: string, signal?: AbortSignal) {
  const { data } = await fetchGitHub<GitHubUser>("user", signal, token.trim());
  return data;
}

export interface RateLimitItem {
  limit: number;
  used: number;
  reset: number;
}

export async function fetchRateLimit(
  signal?: AbortSignal,
): Promise<RateLimitItem> {
  const { data } = await fetchGitHub<{ resources: { core: RateLimitItem } }>(
    "rate_limit",
    signal,
  );
  return data.resources.core;
}
