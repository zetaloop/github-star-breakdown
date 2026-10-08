import { AlertCircle, ChartNoAxesCombined, ExternalLink } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { useStarAnalysis } from "@/hooks/useStarAnalysis";
import { clearGitHubToken, getGitHubToken } from "@/services/githubApi";
import ApiKeyForm from "./ApiKeyForm";
import LoadingProgress from "./LoadingProgress";
import RepoStatsTable from "./RepoStatsTable";
import UserRepoSearch from "./UserRepoSearch";

const RepoStarChart = lazy(() => import("./RepoStarChart"));

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
    <div className="workspace">
      {!result && (
        <header className="welcome">
          <h1>看看项目的成长。</h1>
          <p>从一个 GitHub 账号出发，查看每个仓库的星标贡献。</p>
        </header>
      )}
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
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          {progress && <LoadingProgress progress={progress} status={status} />}
          {result && (
            <div className="analysis-results" aria-busy={busy}>
              <header className="result-header">
                {result.repos[0] && (
                  <img
                    className="avatar"
                    src={result.repos[0].owner.avatar_url}
                    alt=""
                    width={48}
                    height={48}
                  />
                )}
                <div>
                  <a
                    className="profile-link"
                    href={`https://github.com/${encodeURIComponent(result.username)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <h1>{result.username}</h1>
                    <ExternalLink size={15} />
                  </a>
                  <p className="muted">
                    {result.range.type === "all"
                      ? "全部历史"
                      : result.range.type === "year"
                        ? "最近一年"
                        : "自定义时间范围"}
                  </p>
                </div>
              </header>
              <dl className="overview">
                <div>
                  <dt>当前星标</dt>
                  <dd>
                    {result.repos
                      .reduce((sum, repo) => sum + repo.stargazers_count, 0)
                      .toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt>获得星标的仓库</dt>
                  <dd>{result.repos.length.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>
                    {status === "complete" ? "范围内星标" : "范围内已读取"}
                  </dt>
                  <dd>
                    {[...increments.values()]
                      .reduce((sum, stars) => sum + stars, 0)
                      .toLocaleString()}
                  </dd>
                </div>
              </dl>
              {result.history.length > 0 && (
                <Suspense
                  fallback={
                    <div className="plot-placeholder" role="status">
                      正在准备图表…
                    </div>
                  }
                >
                  <RepoStarChart
                    starHistory={result.history}
                    timeRange={result.range.type}
                  />
                </Suspense>
              )}
              {result.repos.length > 0 ? (
                <RepoStatsTable
                  repos={result.repos}
                  timeRange={result.range.type}
                  yearlyIncrements={increments}
                />
              ) : (
                <p className="empty-state">此用户没有获得星标的公开仓库。</p>
              )}
            </div>
          )}
          {!result && !busy && (
            <div className="empty-state">
              <ChartNoAxesCombined size={36} strokeWidth={1.2} />
              <p>输入用户名，展开星标历史</p>
              <span>项目之间的贡献与变化，会汇集在同一张图里。</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
