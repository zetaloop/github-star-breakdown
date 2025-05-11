import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import ApiKeyForm from "./ApiKeyForm";
import UserRepoSearch from "./UserRepoSearch";
import RepoStarChart from "./RepoStarChart";
import RepoStatsTable from "./RepoStatsTable";
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
import { Skeleton } from "@/components/ui/skeleton";
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

  const handleSearch = async (
    usernameInput: string,
    timeRangeInput: "year" | "all"
  ) => {
    setIsLoading(true);
    setError(null);
    setUsername(usernameInput);
    setCurrentTimeRange(timeRangeInput); // Save timeRange to state

    try {
      // Calculate date cutoff for API requests
      const now = new Date();
      const sinceDate =
        timeRangeInput === "year"
          ? new Date(
              now.getFullYear() - 1,
              now.getMonth(),
              now.getDate()
            ).toISOString()
          : undefined;

      // Fetch repositories (already filtered for repos with stars > 0)
      const userRepos = await fetchUserRepos(usernameInput);
      setRepos(userRepos);

      if (userRepos.length === 0) {
        setStarHistory([]);
        setYearlyIncrements(new Map());
        toast.info("No public repositories with stars found for this user.");
        setIsLoading(false);
        return;
      }

      // Fetch stargazers for each repository (in parallel)
      const stargazersMap = new Map<string, GitHubStargazer[]>();

      // We limit to avoid hitting rate limits - GitHub API has strict rate limits
      const reposToProcess = userRepos.slice(0, 30);

      toast.info(`Processing ${reposToProcess.length} repositories...`);

      await Promise.all(
        reposToProcess.map(async (repo) => {
          try {
            const stargazers = await fetchRepoStargazers(
              repo.full_name,
              sinceDate
            );
            stargazersMap.set(repo.full_name, stargazers);
          } catch (error) {
            console.error(
              `Error fetching stargazers for ${repo.full_name}:`,
              error
            );
          }
        })
      );

      // Process data into time-series format for the chart
      const processedStarHistory = processRepoStarHistory(
        reposToProcess,
        stargazersMap,
        timeRangeInput
      );
      setStarHistory(processedStarHistory);

      // Calculate yearly increments if timeRange is "year"
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
            <div className="space-y-6">
              <Skeleton className="h-[400px] w-full" />
              <Skeleton className="h-[300px] w-full" />
            </div>
          ) : (
            username &&
            starHistory.length > 0 && (
              <div className="space-y-6">
                <RepoStarChart
                  starHistory={starHistory}
                  timeRange={currentTimeRange}
                />
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
