import { GitHubStargazer } from "@/types/github";
import { fetchStargazersREST, fetchStargazersGraphQL } from "./githubApi";
import { RateLimitError } from "./github";

let restReset: number | null = null;
let graphqlReset: number | null = null;
const canUseRest = () => !restReset || Date.now() >= restReset * 1000;
const canUseGraphQL = () => !graphqlReset || Date.now() >= graphqlReset * 1000;
const cursorCache: Map<string, Map<number, string | null>> = new Map();
const pageCache: Map<
  string,
  Map<
    number,
    { stars: GitHubStargazer[]; oldest: Date | null; newest: Date | null }
  >
> = new Map();

export const fetchStargazerPage = async (
  repoFullName: string,
  page: number,
  signal?: AbortSignal
) => {
  const preferGraphQL = page > 400 || !canUseRest();
  if (!preferGraphQL && canUseRest()) {
    try {
      const { stars, oldest, newest } = await fetchStargazersREST(
        repoFullName,
        page,
        signal
      );
      return { stars, oldest, newest };
    } catch (err) {
      if (err instanceof RateLimitError) {
        restReset = err.resetTimestamp || null;
        if (canUseGraphQL()) {
          return fetchStargazerPage(repoFullName, page, signal);
        }
      }
      throw err;
    }
  }

  let pCache = pageCache.get(repoFullName);
  if (!pCache) {
    pCache = new Map();
    pageCache.set(repoFullName, pCache);
  }
  if (pCache.has(page)) {
    return pCache.get(page)!;
  }
  let cCache = cursorCache.get(repoFullName);
  if (!cCache) {
    cCache = new Map();
    cursorCache.set(repoFullName, cCache);
  }
  const sorted = Array.from(cCache.keys()).sort((a, b) => a - b);
  let last = 0;
  for (const k of sorted) {
    if (k < page) last = k;
  }
  let after = last > 0 ? cCache.get(last) || undefined : undefined;
  for (let p = last + 1; p <= page; p++) {
    try {
      const res = await fetchStargazersGraphQL(repoFullName, after, signal);
      pCache.set(p, {
        stars: res.stars,
        oldest: res.oldest,
        newest: res.newest,
      });
      cCache.set(p, res.endCursor);
      after = res.endCursor || undefined;
    } catch (err) {
      if (err instanceof RateLimitError) {
        graphqlReset = err.resetTimestamp || null;
        if (canUseRest() && p <= 400) {
          return fetchStargazerPage(repoFullName, p, signal);
        }
      }
      throw err;
    }
  }
  return pCache.get(page)!;
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
