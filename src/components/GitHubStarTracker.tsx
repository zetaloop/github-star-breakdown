import React, { useState, useCallback, useRef } from "react";
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
  fetchUserReposControlled,
  processRepoStarHistory,
  getGitHubToken,
  clearGitHubToken,
  RateLimitError,
} from "@/services/github";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { ConcurrencyPool, WorkerStatus } from "@/services/concurrency";
import { fetchStargazerPage } from "@/services/githubHeavy";

type LoadingStage = 0 | 1 | null;

export type LogEntry = {
  type: "stage" | "info" | "success" | "warning" | "error" | "debug";
  source: string; // e.g., "App", "RepoFetcher", "StargazerFetcher", or a specific repo name
  message: string;
  timestamp: Date;
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

export type Task = {
  repo: string;
  page: number;
  start: number;
  end: number;
  attempt?: number;
};

const GitHubStarTracker: React.FC = () => {
  const [hasValidToken, setHasValidToken] =
    useState<boolean>(!!getGitHubToken());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
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
  const [predictedItemsCount, setPredictedItemsCount] = useState<number>(0);
  const [failedItemsCount, setFailedItemsCount] = useState<number>(0);
  const [loadingLog, setLoadingLog] = useState<LogEntry[]>([]);
  const [latestEntry, setLatestEntry] = useState<LogEntry | null>(null);
  const [currentStage, setCurrentStage] = useState<LoadingStage>(null);
  const [workerStatuses, setWorkerStatuses] = useState<WorkerStatus[]>([]);
  const processedItemsRef = useRef(0);
  const pumpRef = useRef<() => void>(() => {});
  const taskQueueRef = useRef<Task[]>([]);
  const pausedRef = useRef(false);
  const stopRef = useRef(false);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const resumeResolveRef = useRef<() => void>(() => {});

  const log = useCallback(
    (
      type: LogEntry["type"],
      source: LogEntry["source"],
      message: LogEntry["message"]
    ) => {
      const newEntry: LogEntry = {
        type,
        source,
        message,
        timestamp: new Date(),
      };

      console.log(`[${type.toUpperCase()}] [${source}] ${message}`);

      setLatestEntry((prevEntry) => {
        // If the previous entry was a non-debug log, move it to the history.
        if (prevEntry && prevEntry.type !== "debug") {
          setLoadingLog((prevLog) => {
            const updatedLog = [...prevLog, prevEntry];
            // Keep only the last 50 entries to avoid performance issues
            if (updatedLog.length > 50) {
              return updatedLog.slice(updatedLog.length - 50);
            }
            return updatedLog;
          });
        }

        // The new entry becomes the latest entry.
        return newEntry;
      });
    },
    [setLatestEntry, setLoadingLog]
  );

  const handleResetToken = () => {
    clearGitHubToken();
    setHasValidToken(false);
    setUsername("");
    setRepos([]);
    setStarHistory([]);
    setYearlyIncrements(new Map());
    setError(null);
    setWorkerStatuses([]);
  };

  const handlePauseToggle = () => {
    setIsPaused((prev) => {
      const next = !prev;
      pausedRef.current = next;
      log("info", "App", next ? "⏸ Paused" : "▶️ Resumed");
      if (next) {
        controllersRef.current.forEach((c) => c.abort());
      } else {
        resumeResolveRef.current();
        pumpRef.current();
      }
      return next;
    });
  };

  const handleStop = () => {
    stopRef.current = true;
    pausedRef.current = false;
    setIsPaused(false);
    setIsLoading(false);
    controllersRef.current.forEach((c) => c.abort());
    controllersRef.current.clear();
    taskQueueRef.current = [];
    resumeResolveRef.current();
    log("stage", "App", "⛔ Analysis stopped.");
  };

  const handleSearch = useCallback(
    async (
      usernameInput: string,
      timeRangeInput: "year" | "all" | "custom",
      customRange?: { from?: Date; to?: Date }
    ) => {
      const formatFinishedLoadingMessage = (
        repo: string,
        totalStarsInRepo: number,
        fetchedStars: number,
        pageStats: { status: string }[]
      ): { message: string; type: "success" | "warning" } => {
        const fetched = pageStats.filter((p) => p.status === "fetched").length;
        const failed = pageStats.filter((p) => p.status === "failed").length;
        const skipped = pageStats.filter((p) => p.status === "skipped").length;
        const predicted = pageStats.filter(
          (p) => p.status === "predicted"
        ).length;

        // Calculate total pages and unrecorded pages
        const totalPages = Math.ceil(totalStarsInRepo / 100);
        const accountedPages = fetched + failed + skipped + predicted;
        const unrecorded = Math.max(0, totalPages - accountedPages);

        const parts: string[] = [`total ${totalPages} pages`];
        if (fetched > 0) parts.push(`${fetched} fetched`);
        if (failed > 0) parts.push(`${failed} failed`);
        if (skipped > 0) parts.push(`${skipped} skipped`);
        if (predicted > 0) parts.push(`${predicted} predicted`);
        if (unrecorded > 0) parts.push(`${unrecorded} unrecorded`);
        // `unrecorded` indicates pages that were not processed at all.
        // If this count is greater than zero, it suggests a potential issue with the code that needs immediate attention.

        const starsText =
          fetchedStars === totalStarsInRepo
            ? `${fetchedStars} stars`
            : `${fetchedStars}/${totalStarsInRepo} stars`;

        const message = `Finished loading ${starsText} (${parts.join(", ")})`;
        const type = fetchedStars === totalStarsInRepo ? "success" : "warning";

        return { message, type };
      };

      setIsLoading(true);
      stopRef.current = false;
      pausedRef.current = false;
      setIsPaused(false);
      taskQueueRef.current = [];
      controllersRef.current.clear();
      resumeResolveRef.current = () => {};
      setError(null);
      setUsername(usernameInput);
      setCurrentTimeRange(timeRangeInput);
      setStarHistory([]);
      setRepos([]);
      setYearlyIncrements(new Map());
      setCurrentStage(0);
      setTotalItemsToProcess(0);
      setProcessedItemsCount(0);
      setPredictedItemsCount(0);
      setFailedItemsCount(0);
      processedItemsRef.current = 0;
      setLoadingLog([]);
      setLatestEntry(null);
      setWorkerStatuses([]);

      log("stage", "App", "🚀 Search initiated.");

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

        log("stage", "RepoFetcher", "Fetching repository list...");
        const userRepos = await fetchUserReposControlled(
          usernameInput,
          (processedDelta, total) => {
            processedItemsRef.current += processedDelta;
            setProcessedItemsCount(processedItemsRef.current);
            if (total) {
              setTotalItemsToProcess(total);
            }
            log(
              "info",
              "RepoFetcher",
              `Fetched page ${processedItemsRef.current}/${total || "?"}`
            );
          },
          (statuses) => {
            setWorkerStatuses(statuses);
          },
          {
            pausedRef,
            stopRef,
            controllers: controllersRef.current,
            onError: (err) => {
              pausedRef.current = true;
              setIsPaused(true);
              log("error", "RepoFetcher", err.message);
              toast.error("Error", { description: err.message });
            },
            waitForResume: () =>
              new Promise<void>((resolve) => {
                resumeResolveRef.current = resolve;
              }),
          }
        );
        setWorkerStatuses([]);

        if (stopRef.current) {
          log("stage", "App", "Process aborted by user.");
          return;
        }

        if (pausedRef.current) {
          await new Promise<void>((resolve) => {
            resumeResolveRef.current = resolve;
          });
          if (stopRef.current) {
            log("stage", "App", "Process aborted by user.");
            return;
          }
        }

        if (userRepos.length === 0) {
          toast.info("No public repositories with stars found for this user.");
          log("info", "App", "No public repositories with stars found.");
          setCurrentStage(null);
          setIsLoading(false);
          return;
        }

        log(
          "success",
          "RepoFetcher",
          `Found ${userRepos.length} repositories with stars.`
        );
        setRepos(userRepos);

        setCurrentStage(1);
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
        log(
          "stage",
          "StargazerFetcher",
          `Starting deep scan of ${userRepos.length} repos (${totalPagesToProcess} estimated pages).`
        );
        toast.info(
          `Fetching stargazers for ${userRepos.length} repositories...`
        );

        const pool = new ConcurrencyPool(50);
        pool.setStatusCallback((statuses) => {
          setWorkerStatuses(statuses);
        });

        const pagesMap = new Map<string, Record<number, PageInfo>>();
        const taskQueue = taskQueueRef.current;
        const repoErrors: Record<string, unknown> = {};
        const completedRepos = new Set<string>();
        const loggedErrors = new Set<string>(); // Track which repos have had their errors logged
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
                attempt: 0,
              });
              log(
                "debug",
                "Scheduler",
                `Enqueued ${name} page ${p} (initial quantile)`
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

        const checkRepoCompletion = (repo: string) => {
          if (completedRepos.has(repo)) return;
          const pages = pagesMap.get(repo);
          if (!pages) return;
          const done = Object.values(pages).every(
            (p) => p.status !== "pending" && p.status !== "scheduled"
          );
          if (done) {
            completedRepos.add(repo);
            const stars = starsMap.get(repo) || [];
            const pageStats = Object.values(pages);
            const repoInfo = userRepos.find((r) => r.full_name === repo);
            const totalStarsInRepo = repoInfo?.stargazers_count || 0;

            const { message, type } = formatFinishedLoadingMessage(
              repo,
              totalStarsInRepo,
              stars.length,
              pageStats
            );
            log(type, repo, message);
          }
        };

        const markRange = (
          repo: string,
          s: number,
          e: number,
          status: PageInfo["status"] = "predicted"
        ) => {
          const pages = pagesMap.get(repo);
          if (!pages) return 0;
          let count = 0;
          for (let p = s; p <= e; p++) {
            const info = pages[p];
            if (!info) continue;
            if (info.status === "pending" || info.status === "scheduled") {
              info.status = status;
              count++;
            }
          }
          if (count) {
            setProcessedItemsCount((prev) => prev + count);
            if (status === "predicted") {
              setPredictedItemsCount((prev) => prev + count);
            } else if (status === "failed") {
              setFailedItemsCount((prev) => prev + count);
            }
          }
          checkRepoCompletion(repo);
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
          taskQueue.push({ repo, page: mid, start: s, end: e, attempt: 0 });
          log("debug", "Scheduler", `Enqueued ${repo} page ${mid}.`);
        };

        const pump = () => {
          if (pausedRef.current || stopRef.current) return;
          while (
            !pausedRef.current &&
            !stopRef.current &&
            taskQueue.length > 0 &&
            pool.getActiveCount() + pool.getQueueLength() < pool.getLimit()
          ) {
            const task = taskQueue.shift()!;
            const repoPages = pagesMap.get(task.repo)!;
            if (repoPages[task.page].status !== "pending") continue;
            repoPages[task.page].status = "scheduled";
            log(
              "debug",
              "Pool",
              `Starting task for ${task.repo} page ${task.page}`
            );
            pool.add(async () => {
              const key = `${task.repo}:${task.page}`;
              const controller = new AbortController();
              controllersRef.current.set(key, controller);
              if (repoPages[task.page].status !== "scheduled") {
                log(
                  "debug",
                  "Pool",
                  `Skipped ${task.repo} page ${task.page}, status is now ${repoPages[task.page].status}`
                );
                controllersRef.current.delete(key);
                return;
              }
              try {
                const { stars, oldest, newest } = await fetchStargazerPage(
                  task.repo,
                  task.page,
                  controller.signal
                );
                setProcessedItemsCount((prev) => prev + 1);
                log(
                  "debug",
                  task.repo,
                  `Fetched page ${task.page}. Stars: ${stars.length}`
                );
                if (!stars.length) {
                  repoPages[task.page].status = "skipped";
                  log("info", task.repo, `Page ${task.page} is empty.`);
                  checkRepoCompletion(task.repo);
                } else if (
                  untilDateForRange &&
                  oldest &&
                  oldest > untilDateForRange
                ) {
                  repoPages[task.page].status = "skipped";
                  log(
                    "info",
                    task.repo,
                    `Page ${task.page} is out of range (too new).`
                  );
                  const predictedCount = markRange(
                    task.repo,
                    task.page + 1,
                    task.end
                  );
                  if (predictedCount > 0)
                    log(
                      "info",
                      "Predictor",
                      `Marked ${predictedCount} pages after ${task.page} as predicted for ${task.repo}.`
                    );
                  enqueueRange(task.repo, task.start, task.page - 1);
                  checkRepoCompletion(task.repo);
                } else if (
                  sinceDateForRange &&
                  newest &&
                  newest < sinceDateForRange
                ) {
                  repoPages[task.page].status = "skipped";
                  log(
                    "info",
                    task.repo,
                    `Page ${task.page} is out of range (too old).`
                  );
                  const predictedCount = markRange(
                    task.repo,
                    task.start,
                    task.page - 1
                  );
                  if (predictedCount > 0)
                    log(
                      "info",
                      "Predictor",
                      `Marked ${predictedCount} pages before ${task.page} as predicted for ${task.repo}.`
                    );
                  enqueueRange(task.repo, task.page + 1, task.end);
                  checkRepoCompletion(task.repo);
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
                      log(
                        "info",
                        "Predictor",
                        `Marked ${predictedCount} pages between ${prev} and ${task.page} as predicted for ${task.repo} (same day).`
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
                      log(
                        "info",
                        "Predictor",
                        `Marked ${predictedCount} pages between ${task.page} and ${next} as predicted for ${task.repo} (same day).`
                      );
                  }
                  enqueueRange(task.repo, task.start, task.page - 1);
                  enqueueRange(task.repo, task.page + 1, task.end);
                  checkRepoCompletion(task.repo);
                }
              } catch (err) {
                const errorObj = err as Error;
                if (errorObj.name === "AbortError") {
                  repoPages[task.page].status = "pending";
                  taskQueue.unshift(task);
                } else {
                  task.attempt = (task.attempt || 0) + 1;
                  if (task.attempt < 2) {
                    // First attempt failed, pause and retry
                    repoPages[task.page].status = "pending";
                    taskQueue.unshift(task);
                    if (!pausedRef.current) {
                      pausedRef.current = true;
                      setIsPaused(true);
                      log("error", task.repo, errorObj.message);
                      toast.error("Error", { description: errorObj.message });
                      controllersRef.current.forEach((c) => c.abort());
                    }
                    throw err;
                  } else {
                    // Retry failed, skip this page and continue
                    repoPages[task.page].status = "failed";
                    repoErrors[task.repo] = err;
                    // Mark the range without calling checkRepoCompletion yet
                    const pages = pagesMap.get(task.repo);
                    let remaining = 0;
                    if (pages) {
                      for (let p = task.start; p <= task.end; p++) {
                        const info = pages[p];
                        if (!info) continue;
                        if (
                          info.status === "pending" ||
                          info.status === "scheduled"
                        ) {
                          info.status = "failed";
                          remaining++;
                        }
                      }
                      if (remaining > 0) {
                        setProcessedItemsCount((prev) => prev + remaining);
                        setFailedItemsCount((prev) => prev + remaining);
                      }
                    }
                    // Log the error after marking the range
                    log(
                      "error",
                      task.repo,
                      `Failed fetching page ${task.page} on retry, skipping ${remaining} pages: ${err instanceof Error ? err.message : "Unknown."}`
                    );
                    // Don't pause again on retry failure, just continue
                    // The finally block will handle checkRepoCompletion
                  }
                }
              } finally {
                controllersRef.current.delete(key);
                checkRepoCompletion(task.repo);
                pumpRef.current();
              }
            });
          }
        };

        pumpRef.current = pump;
        pumpRef.current();
        while (true) {
          await pool.awaitAll();
          if (stopRef.current) {
            log("stage", "App", "Process aborted by user.");
            return;
          }
          if (pausedRef.current) {
            await new Promise<void>((resolve) => {
              resumeResolveRef.current = resolve;
            });
            if (stopRef.current) {
              log("stage", "App", "Process aborted by user.");
              return;
            }
          }
          if (
            taskQueue.length === 0 &&
            controllersRef.current.size === 0 &&
            pool.getActiveCount() === 0
          )
            break;
          pumpRef.current();
        }

        log("stage", "App", "Processing final data.");
        for (const repo of userRepos) {
          const stars = starsMap.get(repo.full_name) || [];
          stargazersMap.set(repo.full_name, stars);
          if (!completedRepos.has(repo.full_name)) {
            const pages = pagesMap.get(repo.full_name);
            if (pages) {
              const pageStats = Object.values(pages);
              const { message, type } = formatFinishedLoadingMessage(
                repo.full_name,
                repo.stargazers_count,
                stars.length,
                pageStats
              );
              log(type, repo.full_name, message);
            } else {
              log(
                "success",
                repo.full_name,
                `Finished loading ${stars.length} stars.`
              );
            }
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
        setWorkerStatuses([]);
        log("stage", "App", "✅ Analysis complete.");
      }
    },
    [log, setLoadingLog, setLatestEntry]
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
            isPaused={isPaused}
            onPauseToggle={handlePauseToggle}
            onStop={handleStop}
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
              totalItems={totalItemsToProcess}
              processedItems={processedItemsCount}
              predictedItems={predictedItemsCount}
              failedItems={failedItemsCount}
              log={loadingLog}
              latestEntry={latestEntry}
              currentStage={currentStage}
              workerStatuses={workerStatuses}
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
