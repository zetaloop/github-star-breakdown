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
  fetchRepoStargazersFirstPage,
  RateLimitError, // Import the custom error
} from "@/services/github";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// Define the type for the loading stages
type LoadingStage = 0 | 1 | 2 | null;

const GitHubStarTracker: React.FC = () => {
  const [hasValidToken, setHasValidToken] =
    useState<boolean>(!!getGitHubToken());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [starHistory, setStarHistory] = useState<RepoStarHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentTimeRange, setCurrentTimeRange] = useState<"year" | "all">(
    "all"
  );
  const [yearlyIncrements, setYearlyIncrements] = useState<Map<string, number>>(
    new Map()
  );
  // State for tracking progress across stages
  const [totalItemsToProcess, setTotalItemsToProcess] = useState<number>(0); // Renamed for generic use across stages
  const [processedItemsCount, setProcessedItemsCount] = useState<number>(0); // Renamed for generic use across stages
  const [loadingLog, setLoadingLog] = useState<
    Array<{ name: string; status: string }>
  >([]);
  // New state for tracking the current loading stage
  const [currentStage, setCurrentStage] = useState<LoadingStage>(null); // null: idle, 0: fetching repos, 1: initial scan, 2: deep scan

  const handleSearch = useCallback(
    async (usernameInput: string, timeRangeInput: "year" | "all") => {
      setIsLoading(true);
      setError(null);
      setUsername(usernameInput);
      setCurrentTimeRange(timeRangeInput);
      setStarHistory([]);
      setRepos([]);
      setYearlyIncrements(new Map());
      // Reset progress for Stage 0
      setCurrentStage(0); // Start at stage 0: Fetching repository list
      // Set totalItemsToProcess to 0 to indicate indeterminate progress initially for stage 0
      setTotalItemsToProcess(0);
      setProcessedItemsCount(0);
      setLoadingLog([
        { name: "Stage 0", status: "🔍 Fetching repository list..." },
      ]);

      try {
        const now = new Date();
        // This sinceDate is ONLY for client-side filtering in processRepoStarHistory
        const sinceDateForFiltering =
          timeRangeInput === "year"
            ? new Date(
                now.getFullYear() - 1,
                now.getMonth(),
                now.getDate()
              ).toISOString()
            : undefined;

        // STAGE 0: Fetching User Repos with progress
        const userRepos = await fetchUserRepos(
          usernameInput,
          (delta, totalPages) => {
            // Renamed processedPages to delta for clarity
            // Update progress for stage 0 (fetching repo list pages)
            // Correctly accumulate processed items
            let currentProcessedCount = 0;
            setProcessedItemsCount((prevCount) => {
              currentProcessedCount = prevCount + delta;
              return currentProcessedCount;
            });

            if (totalPages) {
              setTotalItemsToProcess(totalPages); // Update total based on actual pages
            } else {
              // If totalPages is not yet known, keep totalItemsToProcess as 0 for indeterminate state
              setTotalItemsToProcess(0);
            }
            // Update log message for Stage 0 progress
            setLoadingLog((prev) => {
              // Use the most up-to-date processed count for the log
              // We access currentProcessedCount via the closure from setProcessedItemsCount's callback
              // or ensure it's updated before this log setter runs if not using the direct value from state setter.
              // For simplicity and immediate reflection, we'll rely on the closure or a slightly delayed state update.
              // A more robust way if currentProcessedCount isn't reliably updated in time for this specific log:
              // Re-fetch from state if needed, or pass it explicitly.
              // However, given setProcessedItemsCount is called right before, this should be fine.
              // Let's ensure we use the value that *will be* set.
              // The `currentProcessedCount` captured in the outer scope of this callback will be correct.
              const logEntry = `🔍 Fetching repository list... Page ${currentProcessedCount}${totalPages ? `/${totalPages}` : " (determining total...)"}`;
              // Avoid duplicate stage 0 entries if possible, update the last one
              if (prev.length > 0 && prev[prev.length - 1].name === "Stage 0") {
                const updatedLog = [...prev];
                updatedLog[updatedLog.length - 1] = {
                  name: "Stage 0",
                  status: logEntry,
                };
                return updatedLog;
              }
              // Otherwise, add a new entry (should ideally not happen often if initial log is set)
              return [...prev, { name: "Stage 0", status: logEntry }];
            });
          }
        );

        if (userRepos.length === 0) {
          toast.info("No public repositories with stars found for this user.");
          setCurrentStage(null); // Reset stage
          setIsLoading(false);
          return;
        }

        setRepos(userRepos);
        // Limit to avoid hitting rate limits (GitHub API has strict limits)
        const reposToProcess = userRepos.slice(0, 30); // Consider making this configurable

        // STAGE 1: Initializing for first page fetch
        setCurrentStage(1); // Move to stage 1: Initial scan
        setTotalItemsToProcess(reposToProcess.length); // For Stage 1: total repos
        setProcessedItemsCount(0); // Reset for Stage 1: processed repos
        setLoadingLog((prev) => [
          ...prev,
          {
            name: "Stage 1",
            status: `📊 Starting initial scan of ${reposToProcess.length} repos...`,
          },
        ]);
        toast.info(
          `Fetching first page of stars for ${reposToProcess.length} repositories...`
        );

        const incompleteRepos: GitHubRepo[] = [];
        const stargazersMap = new Map<string, GitHubStargazer[]>();

        await Promise.all(
          reposToProcess.map(async (repo) => {
            let statusMsg = "";
            try {
              // Call fetchRepoStargazersFirstPage WITHOUT sinceDate
              const { stargazers: firstPageStars, incomplete } =
                await fetchRepoStargazersFirstPage(repo.full_name); // REMOVED sinceDate

              stargazersMap.set(repo.full_name, firstPageStars);

              if (!incomplete) {
                statusMsg = `✅ Fetched ${firstPageStars.length} stars (complete)`;
              } else {
                statusMsg = `🔄 Fetched ${firstPageStars.length} stars... more pages pending`;
                incompleteRepos.push(repo);
              }
            } catch (err) {
              console.error(
                `Error fetching first page for ${repo.full_name}:`,
                err
              );
              statusMsg = `❌ Error: ${err instanceof Error ? err.message : "Unknown error"}`;
            } finally {
              // Update Stage 1 progress
              setProcessedItemsCount((prev) => prev + 1);
              // Add log entry for this specific repo in stage 1
              setLoadingLog((prev) => [
                ...prev,
                { name: repo.full_name, status: statusMsg },
              ]);
            }
          })
        );

        // STAGE 2: Deep scan for incomplete repos
        if (incompleteRepos.length > 0) {
          setCurrentStage(2); // Move to stage 2: Deep scan
          toast.info(
            `Optimizing load for ${incompleteRepos.length} large repositories...`
          );

          // Calculate total pages needed for stage 2 more accurately
          let totalPagesToProcessForStage2 = 0;
          // Map repo name to its page range
          const repoPageMap: Record<string, { start: number; end: number }> =
            {};
          for (const repo of incompleteRepos) {
            const firstPageStarsCount =
              stargazersMap.get(repo.full_name)?.length || 0;
            const totalStars =
              typeof repo.stargazers_count === "number"
                ? repo.stargazers_count
                : 0;
            if (totalStars > firstPageStarsCount) {
              const remainingStars = totalStars - firstPageStarsCount;
              const startPage = 2;
              const endPage = Math.ceil(totalStars / 100);
              totalPagesToProcessForStage2 += endPage - startPage + 1;
              repoPageMap[repo.full_name] = { start: startPage, end: endPage };
            }
          }
          if (
            totalPagesToProcessForStage2 === 0 &&
            incompleteRepos.length > 0
          ) {
            totalPagesToProcessForStage2 = incompleteRepos.length;
          }
          setTotalItemsToProcess(totalPagesToProcessForStage2); // For Stage 2: total pages
          setProcessedItemsCount(0); // Reset for Stage 2: processed pages
          setLoadingLog((prev) => [
            ...prev,
            {
              name: "Stage 2",
              status: `📗 Starting deep scan of ${incompleteRepos.length} repos (${totalPagesToProcessForStage2} estimated pages)`,
            },
          ]);

          // Import concurrency pool and fetchStargazersInRange
          const { ConcurrencyPool, fetchStargazersInRange } = await import(
            "@/services/github"
          );
          const pool = new ConcurrencyPool(50);
          const promises: Promise<void>[] = [];
          for (const repo of incompleteRepos) {
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
                    }
                  );
                  const currentStars = stargazersMap.get(repo.full_name) || [];
                  stargazersMap.set(repo.full_name, [
                    ...currentStars,
                    ...stars,
                  ]);
                  setLoadingLog((prev) => [
                    ...prev,
                    {
                      name: repo.full_name,
                      status: `✅ Full data loaded (${(currentStars?.length || 0) + stars.length} stars)`,
                    },
                  ]);
                } catch (err) {
                  setLoadingLog((prev) => [
                    ...prev,
                    {
                      name: repo.full_name,
                      status: `❌ Error loading remaining pages: ${err instanceof Error ? err.message : "Unknown error"}`,
                    },
                  ]);
                }
              })()
            );
          }
          await Promise.all(promises);
        }

        // FINAL PROCESSING: Process the aggregated star data using sinceDateForFiltering
        const processedStarHistory = processRepoStarHistory(
          reposToProcess, // Use the list of repos actually processed
          stargazersMap,
          timeRangeInput // Pass the original time range selection
          // sinceDateForFiltering is handled internally by processRepoStarHistory based on timeRange
        );
        setStarHistory(processedStarHistory);

        // Calculate yearly increments if needed
        const newYearlyIncrements = new Map<string, number>();
        if (timeRangeInput === "year") {
          processedStarHistory.forEach((item) => {
            newYearlyIncrements.set(
              item.repoName,
              (newYearlyIncrements.get(item.repoName) || 0) + item.stars
            );
          });
        }
        setYearlyIncrements(newYearlyIncrements);

        // Provide feedback based on results
        if (processedStarHistory.length === 0 && timeRangeInput === "year") {
          toast.info(
            "No star data found for the selected time range (last year)."
          );
        } else if (
          processedStarHistory.length === 0 &&
          reposToProcess.length > 0
        ) {
          // This case might be less common now with multi-stage loading,
          // but good to keep for edge cases (e.g., all repos had 0 stars).
          toast.info("No star data found for the selected criteria.");
        } else if (reposToProcess.length > 0) {
          toast.success("Star history analysis complete!");
          // Let the user take a look at the beautiful 100% progress
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
        setCurrentStage(null); // Reset stage on completion or error
      }
    },
    []
  ); // Add dependencies if needed, e.g., if using external state not passed as args

  return (
    <div className="space-y-6">
      {!hasValidToken ? (
        <ApiKeyForm onTokenValidated={() => setHasValidToken(true)} />
      ) : (
        <>
          <UserRepoSearch onSearch={handleSearch} isLoading={isLoading} />

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && currentStage !== null ? ( // Check currentStage is not null
            <LoadingProgress
              // Pass original prop names and isStage2 based on currentStage
              totalRepos={totalItemsToProcess}
              processedRepos={processedItemsCount}
              log={loadingLog}
              currentStage={currentStage} // Pass the currentStage prop
            />
          ) : (
            username &&
            !isLoading && // Ensure loading is false before showing results
            (starHistory.length > 0 || repos.length > 0) && (
              <div className="space-y-6">
                {starHistory.length > 0 ? (
                  <RepoStarChart
                    starHistory={starHistory}
                    timeRange={currentTimeRange}
                  />
                ) : (
                  // Show message only if loading is finished, there was no error,
                  // repos were found, but no star history for the range exists.
                  !error &&
                  repos.length > 0 && (
                    <p className="text-center text-muted-foreground">
                      No star history data to display for the selected range.
                    </p>
                  )
                )}
                {/* Show table if repos were found, even if star history is empty */}
                {repos.length > 0 && (
                  <RepoStatsTable
                    repos={repos} // Pass all initially fetched repos for the table
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
