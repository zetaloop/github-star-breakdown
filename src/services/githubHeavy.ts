import { GitHubStargazer } from "@/types/github";
import { fetchStargazersREST } from "./githubApi";
export const fetchStargazerPage = async (
  repoFullName: string,
  page: number,
  signal?: AbortSignal
) => {
  const { stars, oldest, newest } = await fetchStargazersREST(
    repoFullName,
    page,
    signal
  );
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
