import React, { useState, useCallback } from "react";
import { toast } from "sonner";
import ApiKeyForm from "./ApiKeyForm";
import UserRepoSearch from "./UserRepoSearch";
import RepoStarChart from "./RepoStarChart";
import RepoStatsTable from "./RepoStatsTable";
import LoadingProgress from "./LoadingProgress";
import {
  GitHubRepo,
  GitHubStargazer,
  RepoStarHistoryItem,
} from "@/types/github";
import {
  fetchUserRepos,
  processRepoStarHistory,
  getGitHubToken,
  clearGitHubToken,
  RateLimitError,
} from "@/services/github";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type LoadingStage = 0 | 1 | 2 | null;

const GitHubStarTracker: React.FC = () => {
  const [hasValidToken, setHasValidToken] =
    useState<boolean>(!!getGitHubToken());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [starHistory, setStarHistory] = useState<RepoStarHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentTimeRange, setCurrentTimeRange] = useState<
    "year" | "all" | "custom"
  >("all");
  const [yearlyIncrements, setYearlyIncrements] = useState<Map<string, number>>(
    new Map()
  );
  const [totalItemsToProcess, setTotalItemsToProcess] = useState<number>(0);
  const [processedItemsCount, setProcessedItemsCount] = useState<number>(0);
  const [loadingLog, setLoadingLog] = useState<
    Array<{ name: string; status: string }>
  >([]);
  const [currentStage, setCurrentStage] = useState<LoadingStage>(null);

  const handleResetToken = () => {
    clearGitHubToken();
    setHasValidToken(false);
    setUsername("");
    setRepos([]);
    setStarHistory([]);
    setYearlyIncrements(new Map());
    setError(null);
  };

  const handleSearch = useCallback(
    async (
      usernameInput: string,
      timeRangeInput: "year" | "all" | "custom",
      customRange?: { from?: Date; to?: Date }
    ) => {
      setIsLoading(true);
      setError(null);
      setUsername(usernameInput);
      setCurrentTimeRange(timeRangeInput);
      setStarHistory([]);
      setRepos([]);
      setYearlyIncrements(new Map());
      setCurrentStage(0);
      setTotalItemsToProcess(0);
      setProcessedItemsCount(0);
      setLoadingLog([
        { name: "Stage 0", status: "🔍 Fetching repository list..." },
      ]);

      try {
        const now = new Date();
        let sinceDateForRange: Date | undefined;
        let untilDateForRange: Date = now;

        if (timeRangeInput === "year") {
          sinceDateForRange = new Date(
            now.getFullYear() - 1,
            now.getMonth(),
            now.getDate()
          );
        } else if (
          timeRangeInput === "custom" &&
          customRange?.from &&
          customRange.to
        ) {
          sinceDateForRange = customRange.from;
          untilDateForRange = customRange.to;
        }

        const userRepos = await fetchUserRepos(
          usernameInput,
          (delta, totalPages) => {
            let currentProcessedCount = 0;
            setProcessedItemsCount((prevCount) => {
              currentProcessedCount = prevCount + delta;
              return currentProcessedCount;
            });

            if (totalPages) {
              setTotalItemsToProcess(totalPages);
            } else {
              setTotalItemsToProcess(0);
            }
            setLoadingLog((prev) => {
              const logEntry = `🔍 Fetching repository list... Page ${currentProcessedCount}${totalPages ? `/${totalPages}` : " (determining total...)"}`;
              if (prev.length > 0 && prev[prev.length - 1].name === "Stage 0") {
                const updatedLog = [...prev];
                updatedLog[updatedLog.length - 1] = {
                  name: "Stage 0",
                  status: logEntry,
                };
                return updatedLog;
              }
              return [...prev, { name: "Stage 0", status: logEntry }];
            });
          }
        );

        if (userRepos.length === 0) {
          toast.info("No public repositories with stars found for this user.");
          setCurrentStage(null);
          setIsLoading(false);
          return;
        }

        setRepos(userRepos);

        setCurrentStage(2);
        const stargazersMap = new Map<string, GitHubStargazer[]>();
        let totalPagesToProcess = 0;
        const repoPageMap: Record<string, { start: number; end: number }> = {};
        for (const repo of userRepos) {
          const totalStars =
            typeof repo.stargazers_count === "number"
              ? repo.stargazers_count
              : 0;
          if (totalStars === 0) continue;
          const endPage = Math.ceil(totalStars / 100);
          let startPage = 1;
          if (
            (timeRangeInput === "year" || timeRangeInput === "custom") &&
            sinceDateForRange
          ) {
            const repoCreated = new Date(repo.created_at);
            const repoAgeDays =
              (now.getTime() - repoCreated.getTime()) / 86_400_000;
            const rangeDays =
              (untilDateForRange.getTime() - sinceDateForRange.getTime()) /
              86_400_000;
            const fraction =
              repoAgeDays > 0 ? Math.min(1, rangeDays / repoAgeDays) : 1;
            if (fraction < 1) {
              const estimatedStarsInRange = Math.ceil(totalStars * fraction);
              const pagesInRange = Math.ceil(estimatedStarsInRange / 100);
              startPage = Math.max(1, endPage - pagesInRange + 1);
            }
          }
          totalPagesToProcess += endPage - startPage + 1;
          repoPageMap[repo.full_name] = { start: startPage, end: endPage };
        }
        if (totalPagesToProcess === 0 && userRepos.length > 0) {
          totalPagesToProcess = userRepos.length;
        }
        setTotalItemsToProcess(totalPagesToProcess);
        setProcessedItemsCount(0);
        setLoadingLog((prev) => [
          ...prev,
          {
            name: "Stage 2",
            status: `📗 Starting deep scan of ${userRepos.length} repos (${totalPagesToProcess} estimated pages)`,
          },
        ]);
        toast.info(
          `Fetching stargazers for ${userRepos.length} repositories...`
        );

        const { ConcurrencyPool } = await import("@/services/concurrency");
        const { fetchStargazersInRange } = await import(
          "@/services/githubHeavy"
        );
        const pool = new ConcurrencyPool(50);
        const promises: Promise<void>[] = [];
        for (const repo of userRepos) {
          const pageInfo = repoPageMap[repo.full_name];
          if (!pageInfo) continue;
          const stars: GitHubStargazer[] = [];
          promises.push(
            (async () => {
              try {
                await fetchStargazersInRange(
                  repo.full_name,
                  pageInfo.start,
                  pageInfo.end,
                  pool,
                  (delta = 1) => {
                    setProcessedItemsCount((prev) => prev + delta);
                  },
                  (pageStars) => {
                    stars.push(...pageStars);
                  },
                  sinceDateForRange,
                  untilDateForRange
                );
                stargazersMap.set(repo.full_name, stars);
                setLoadingLog((prev) => [
                  ...prev,
                  {
                    name: repo.full_name,
                    status: `✅ Full data loaded (${stars.length} stars)`,
                  },
                ]);
              } catch (err) {
                setLoadingLog((prev) => [
                  ...prev,
                  {
                    name: repo.full_name,
                    status: `❌ Error loading pages: ${err instanceof Error ? err.message : "Unknown error"}`,
                  },
                ]);
              }
            })()
          );
        }
        await Promise.all(promises);
        const processedStarHistory = processRepoStarHistory(
          userRepos,
          stargazersMap,
          {
            type: timeRangeInput,
            from: sinceDateForRange,
            to: untilDateForRange,
          }
        );
        setStarHistory(processedStarHistory);

        const newYearlyIncrements = new Map<string, number>();
        if (timeRangeInput === "year" || timeRangeInput === "custom") {
          processedStarHistory.forEach((item) => {
            newYearlyIncrements.set(
              item.repoName,
              (newYearlyIncrements.get(item.repoName) || 0) + item.stars
            );
          });
        }
        setYearlyIncrements(newYearlyIncrements);

        if (
          processedStarHistory.length === 0 &&
          (timeRangeInput === "year" || timeRangeInput === "custom")
        ) {
          toast.info("No star data found for the selected time range.");
        } else if (processedStarHistory.length === 0 && userRepos.length > 0) {
          toast.info("No star data found for the selected criteria.");
        } else if (userRepos.length > 0) {
          toast.success("Star history analysis complete!");
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error("Error analyzing repositories:", error);
        if (error instanceof RateLimitError) {
          setError(
            `Rate Limit: ${error.message} Please wait and try again later.`
          );
          toast.error("Rate Limit", {
            description: error.message,
          });
        } else {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          setError(
            `Failed to fetch data from GitHub API: ${errorMessage}. Please check the username, API token, and network connection.`
          );
          toast.error("Error fetching GitHub data", {
            description: errorMessage,
          });
        }
      } finally {
        setIsLoading(false);
        setCurrentStage(null);
      }
    },
    []
  );

  return (
    <div className="space-y-6">
      {!hasValidToken ? (
        <ApiKeyForm onTokenValidated={() => setHasValidToken(true)} />
      ) : (
        <>
          <UserRepoSearch
            onSearch={handleSearch}
            isLoading={isLoading}
            onResetToken={handleResetToken}
          />

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && currentStage !== null ? (
            <LoadingProgress
              totalRepos={totalItemsToProcess}
              processedRepos={processedItemsCount}
              log={loadingLog}
              currentStage={currentStage}
            />
          ) : (
            username &&
            !isLoading &&
            (starHistory.length > 0 || repos.length > 0) && (
              <div className="space-y-6">
                {starHistory.length > 0 ? (
                  <RepoStarChart
                    starHistory={starHistory}
                    timeRange={currentTimeRange}
                  />
                ) : (
                  !error &&
                  repos.length > 0 && (
                    <p className="text-center text-muted-foreground">
                      No star history data to display for the selected range.
                    </p>
                  )
                )}
                {repos.length > 0 && (
                  <RepoStatsTable
                    repos={repos}
                    timeRange={currentTimeRange}
                    yearlyIncrements={yearlyIncrements}
                  />
                )}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};

export default GitHubStarTracker;
