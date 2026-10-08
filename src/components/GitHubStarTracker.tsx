import { useMemo, useState } from "react";
import ApiKeyForm from "./ApiKeyForm";
import UserRepoSearch from "./UserRepoSearch";
import RepoStarChart from "./RepoStarChart";
import RepoStatsTable from "./RepoStatsTable";
import LoadingProgress from "./LoadingProgress";
import { getGitHubToken, clearGitHubToken } from "@/services/githubApi";
import { useStarAnalysis } from "@/hooks/useStarAnalysis";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function GitHubStarTracker() {
  const [hasToken, setHasToken] = useState(!!getGitHubToken());
  const analysis = useStarAnalysis();
  const { result, status, progress, error } = analysis;
  const busy = status === "loading" || status === "paused";
  const increments = useMemo(() => {
    const values = new Map<string, number>();
    for (const item of result?.history || []) {
      values.set(item.repoName, (values.get(item.repoName) || 0) + item.stars);
    }
    return values;
  }, [result?.history]);

  return (
    <div className="space-y-6">
      {!hasToken ? (
        <ApiKeyForm onTokenValidated={() => setHasToken(true)} />
      ) : (
        <>
          <UserRepoSearch
            onSearch={(username, type, range) =>
              analysis.search(username, { type, ...range })
            }
            isLoading={busy}
            isPaused={status === "paused"}
            onPauseToggle={analysis.togglePause}
            onStop={analysis.stop}
            onResetToken={() => {
              clearGitHubToken();
              analysis.reset();
              setHasToken(false);
            }}
          />
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {progress && <LoadingProgress progress={progress} status={status} />}
          {result && (
            <div className="space-y-6">
              {result.history.length > 0 && (
                <RepoStarChart
                  starHistory={result.history}
                  timeRange={result.range.type}
                />
              )}
              {result.repos.length > 0 ? (
                <RepoStatsTable
                  repos={result.repos}
                  timeRange={result.range.type}
                  yearlyIncrements={increments}
                />
              ) : (
                <p className="text-center text-muted-foreground">
                  此用户没有获得星标的公开仓库。
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
