import React, { useState, useEffect } from "react";
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
  fetchRepoStargazers,
  processRepoStarHistory,
  getGitHubToken,
} from "@/services/github";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

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
  const [totalReposToProcess, setTotalReposToProcess] = useState<number>(0);
  const [processedReposCount, setProcessedReposCount] = useState<number>(0);
  // State to store the log messages during loading
  const [loadingLog, setLoadingLog] = useState<
    Array<{ name: string; status: string }>
  >([]);

  const handleSearch = async (
    usernameInput: string,
    timeRangeInput: "year" | "all"
  ) => {
    setIsLoading(true);
    setError(null);
    setUsername(usernameInput);
    setCurrentTimeRange(timeRangeInput);
    setStarHistory([]);
    setRepos([]);
    setYearlyIncrements(new Map());
    setTotalReposToProcess(0);
    setProcessedReposCount(0);
    setLoadingLog([]);

    try {
      const now = new Date();
      const sinceDate =
        timeRangeInput === "year"
          ? new Date(
              now.getFullYear() - 1,
              now.getMonth(),
              now.getDate()
            ).toISOString()
          : undefined;

      const userRepos = await fetchUserRepos(usernameInput);
      setRepos(userRepos);

      if (userRepos.length === 0) {
        toast.info("No public repositories with stars found for this user.");
        setIsLoading(false);
        return;
      }

      const stargazersMap = new Map<string, GitHubStargazer[]>();

      // Limit to avoid hitting rate limits (GitHub API has strict limits)
      const reposToProcess = userRepos.slice(0, 30);

      // Initialize progress state
      setTotalReposToProcess(reposToProcess.length);
      setProcessedReposCount(0);

      toast.info(
        `Fetching star data for ${reposToProcess.length} repositories...`
      );

      // Fetch stargazers for each repo in parallel
      await Promise.all(
        reposToProcess.map(async (repo) => {
          let status = "";
          try {
            const stargazers = await fetchRepoStargazers(
              repo.full_name,
              sinceDate
            );
            stargazersMap.set(repo.full_name, stargazers);
            status = `✅ Fetched ${stargazers.length} stars`;
          } catch (error: unknown) {
            console.error(
              `Error fetching stargazers for ${repo.full_name}:`,
              error
            );
            if (error instanceof Error) {
              status = `❌ Error: ${error.message}`;
            } else {
              status = `❌ Error: Failed to fetch (Unknown error)`;
            }
          } finally {
            // Update log and processed count after each fetch attempt
            setLoadingLog((prevLog) => [
              ...prevLog,
              { name: repo.full_name, status: status },
            ]);
            setProcessedReposCount((prevCount) => prevCount + 1);
          }
        })
      );

      // Process the fetched data for chart and table
      const processedStarHistory = processRepoStarHistory(
        reposToProcess,
        stargazersMap,
        timeRangeInput
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

      if (processedStarHistory.length === 0 && timeRangeInput === "year") {
        toast.info(
          "No star data found for the selected time range (last year)."
        );
      } else if (processedStarHistory.length === 0) {
        toast.info("No star data found.");
      }
    } catch (error) {
      console.error("Error analyzing repositories:", error);
      setError(
        "Failed to fetch data from GitHub API. Please check the username and try again."
      );
      toast.error("Error fetching GitHub data");
    } finally {
      setIsLoading(false);
    }
  };

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

          {isLoading ? (
            <LoadingProgress
              totalRepos={totalReposToProcess}
              processedRepos={processedReposCount}
              log={loadingLog} // Pass log data to the progress component
            />
          ) : (
            // Render results only after a search and if data exists
            username &&
            (starHistory.length > 0 || repos.length > 0) && (
              <div className="space-y-6">
                {starHistory.length > 0 ? (
                  <RepoStarChart
                    starHistory={starHistory}
                    timeRange={currentTimeRange}
                  />
                ) : (
                  // Show message if no star history for the selected range
                  !error && (
                    <p>
                      No star history data to display for the selected range.
                    </p>
                  )
                )}
                {/* Always show the table if repositories were found */}
                <RepoStatsTable
                  repos={repos}
                  timeRange={currentTimeRange}
                  yearlyIncrements={yearlyIncrements}
                />
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};

export default GitHubStarTracker;
