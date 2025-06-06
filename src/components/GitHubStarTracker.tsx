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
import { ConcurrencyPool } from "@/services/concurrency";
import { fetchStargazerPage } from "@/services/githubHeavy";

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
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const logDebug = useCallback((message: string) => {
    console.log(`[StarTrackerDebug] ${message}`);
    setDebugLog((prev) => [...prev, message]);
    setLoadingLog((prev) => {
      // Avoid duplicating the final "Full data loaded" message
      if (
        prev.length > 0 &&
        prev[prev.length - 1].status.includes("Full data loaded")
      ) {
        return prev;
      }
      return [...prev, { name: "Debug", status: message }];
    });
  }, []);

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
      setDebugLog([]);

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

        const pool = new ConcurrencyPool(50);

        type PageInfo = {
          status: "pending" | "scheduled" | "fetched" | "skipped" | "predicted";
          oldest?: Date | null;
          newest?: Date | null;
        };

        type Task = { repo: string; page: number; start: number; end: number };
        const pagesMap = new Map<string, Record<number, PageInfo>>();
        const taskQueue: Task[] = [];
        const repoErrors: Record<string, unknown> = {};
        userRepos.forEach((repo) => {
          const pageInfo = repoPageMap[repo.full_name];
          if (!pageInfo) return;
          const pages: Record<number, PageInfo> = {};
          for (let p = pageInfo.start; p <= pageInfo.end; p++) {
            pages[p] = { status: "pending" };
          }
          pagesMap.set(repo.full_name, pages);
        });

        const starsMap = new Map<string, GitHubStargazer[]>();
        userRepos.forEach((r) => starsMap.set(r.full_name, []));

        const initialByRepo: Record<string, number[]> = {};
        userRepos.forEach((repo) => {
          const { start, end } = repoPageMap[repo.full_name];
          const total = end - start + 1;
          const list: number[] = [];
          if (total <= 3) {
            for (let p = start; p <= end; p++) list.push(p);
          } else {
            const q1 = start + Math.floor((total - 1) * 0.25);
            const q2 = start + Math.floor((total - 1) * 0.5);
            const q3 = start + Math.floor((total - 1) * 0.75);
            for (const p of [q1, q2, q3]) {
              if (p >= start && p <= end && !list.includes(p)) list.push(p);
            }
          }
          initialByRepo[repo.full_name] = list;
        });

        const repoNames = userRepos.map((r) => r.full_name);
        const maxLen = Math.max(
          ...repoNames.map((n) => initialByRepo[n].length)
        );
        for (let i = 0; i < maxLen; i++) {
          for (const name of repoNames) {
            const p = initialByRepo[name][i];
            if (p !== undefined) {
              const bounds = repoPageMap[name];
              taskQueue.push({
                repo: name,
                page: p,
                start: bounds.start,
                end: bounds.end,
              });
              logDebug(
                `[InitQueue] Enqueued ${name} page ${p} (initial quantile)`
              );
            }
          }
        }

        const sameDay = (
          a: Date | null | undefined,
          b: Date | null | undefined
        ) => {
          return (
            a &&
            b &&
            a.toISOString().split("T")[0] === b.toISOString().split("T")[0]
          );
        };

        const markRange = (repo: string, s: number, e: number) => {
          const pages = pagesMap.get(repo);
          if (!pages) return 0;
          let count = 0;
          for (let p = s; p <= e; p++) {
            const info = pages[p];
            if (!info) continue;
            if (info.status === "pending") {
              info.status = "predicted";
              count++;
            } else if (info.status === "scheduled") {
              info.status = "predicted";
            }
          }
          if (count) setProcessedItemsCount((prev) => prev + count);
          return count;
        };

        const findPrevFetched = (repo: string, p: number, start: number) => {
          const pages = pagesMap.get(repo);
          if (!pages) return null;
          for (let i = p - 1; i >= start; i--) {
            if (pages[i] && pages[i].status === "fetched") return i;
          }
          return null;
        };

        const findNextFetched = (repo: string, p: number, end: number) => {
          const pages = pagesMap.get(repo);
          if (!pages) return null;
          for (let i = p + 1; i <= end; i++) {
            if (pages[i] && pages[i].status === "fetched") return i;
          }
          return null;
        };

        const enqueueRange = (repo: string, s: number, e: number) => {
          if (s > e) return;
          const mid = Math.floor((s + e) / 2);
          const repoPages = pagesMap.get(repo);
          if (!repoPages) return;
          if (repoPages[mid].status !== "pending") return;
          taskQueue.push({ repo, page: mid, start: s, end: e });
          logDebug(`[Enqueue] Added ${repo} page ${mid} to queue.`);
        };

        const pump = () => {
          while (
            taskQueue.length > 0 &&
            pool.getActiveCount() + pool.getQueueLength() < pool.getLimit()
          ) {
            const task = taskQueue.shift()!;
            const repoPages = pagesMap.get(task.repo)!;
            if (repoPages[task.page].status !== "pending") continue;
            repoPages[task.page].status = "scheduled";
            logDebug(`[Pump] Starting task for ${task.repo} page ${task.page}`);
            pool.add(async () => {
              if (repoPages[task.page].status !== "scheduled") {
                logDebug(
                  `[Pump] Skipped task for ${task.repo} page ${task.page} because status changed to ${repoPages[task.page].status}`
                );
                return;
              }
              try {
                const { stars, oldest, newest } = await fetchStargazerPage(
                  task.repo,
                  task.page
                );
                setProcessedItemsCount((prev) => prev + 1);
                logDebug(
                  `[FetchOK] Fetched ${task.repo} page ${task.page}. Stars: ${stars.length}, Oldest: ${oldest?.toISOString()}, Newest: ${newest?.toISOString()}`
                );
                if (!stars.length) {
                  repoPages[task.page].status = "skipped";
                  logDebug(`[Skip] ${task.repo} page ${task.page} is empty.`);
                } else if (
                  untilDateForRange &&
                  oldest &&
                  oldest > untilDateForRange
                ) {
                  repoPages[task.page].status = "skipped";
                  logDebug(
                    `[Skip] ${task.repo} page ${task.page} is out of range (too new).`
                  );
                  const predictedCount = markRange(
                    task.repo,
                    task.page + 1,
                    task.end
                  );
                  if (predictedCount > 0)
                    logDebug(
                      `[Predict] Marked ${predictedCount} pages after ${task.page} as predicted for ${task.repo}.`
                    );
                  enqueueRange(task.repo, task.start, task.page - 1);
                } else if (
                  sinceDateForRange &&
                  newest &&
                  newest < sinceDateForRange
                ) {
                  repoPages[task.page].status = "skipped";
                  logDebug(
                    `[Skip] ${task.repo} page ${task.page} is out of range (too old).`
                  );
                  const predictedCount = markRange(
                    task.repo,
                    task.start,
                    task.page - 1
                  );
                  if (predictedCount > 0)
                    logDebug(
                      `[Predict] Marked ${predictedCount} pages before ${task.page} as predicted for ${task.repo}.`
                    );
                  enqueueRange(task.repo, task.page + 1, task.end);
                } else {
                  repoPages[task.page] = { status: "fetched", oldest, newest };
                  starsMap.get(task.repo)!.push(...stars);
                  const prev = findPrevFetched(
                    task.repo,
                    task.page,
                    task.start
                  );
                  if (
                    prev !== null &&
                    sameDay(repoPages[prev].newest, oldest)
                  ) {
                    const predictedCount = markRange(
                      task.repo,
                      prev + 1,
                      task.page - 1
                    );
                    if (predictedCount > 0)
                      logDebug(
                        `[Predict] Marked ${predictedCount} pages between ${prev} and ${task.page} as predicted for ${task.repo} (same day).`
                      );
                  }
                  const next = findNextFetched(task.repo, task.page, task.end);
                  if (
                    next !== null &&
                    sameDay(newest, repoPages[next].oldest)
                  ) {
                    const predictedCount = markRange(
                      task.repo,
                      task.page + 1,
                      next - 1
                    );
                    if (predictedCount > 0)
                      logDebug(
                        `[Predict] Marked ${predictedCount} pages between ${task.page} and ${next} as predicted for ${task.repo} (same day).`
                      );
                  }
                  enqueueRange(task.repo, task.start, task.page - 1);
                  enqueueRange(task.repo, task.page + 1, task.end);
                }
              } catch (err) {
                repoErrors[task.repo] = err;
                const remaining = markRange(task.repo, task.start, task.end);
                logDebug(
                  `[Error] Failed fetching ${task.repo} page ${task.page}: ${err instanceof Error ? err.message : "Unknown"}. Skipping ${remaining} pages for this repo.`
                );
              }
              pump();
            });
          }
        };

        pump();
        await pool.awaitAll();

        for (const repo of userRepos) {
          const stars = starsMap.get(repo.full_name) || [];
          stargazersMap.set(repo.full_name, stars);
          const err = repoErrors[repo.full_name];
          if (err) {
            setLoadingLog((prev) => [
              ...prev,
              {
                name: repo.full_name,
                status: `❌ Error loading pages: ${err instanceof Error ? err.message : "Unknown error"}`,
              },
            ]);
          } else {
            setLoadingLog((prev) => [
              ...prev,
              {
                name: repo.full_name,
                status: `✅ Full data loaded (${stars.length} stars)`,
              },
            ]);
          }
        }

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
    [logDebug]
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
