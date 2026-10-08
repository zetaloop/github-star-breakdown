import { AlertCircle, ChartNoAxesCombined, ExternalLink } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { useStarAnalysis } from "@/hooks/useStarAnalysis";
import { getGitHubToken } from "@/services/githubApi";
import { rangeLabel } from "@/services/history";
import LoadingProgress from "./LoadingProgress";
import RepoStatsTable from "./RepoStatsTable";
import TokenSettings from "./TokenSettings";
import UserRepoSearch from "./UserRepoSearch";
import { Modal } from "./ui";

const RepoStarChart = lazy(() => import("./RepoStarChart"));

export default function GitHubStarTracker() {
  const [hasToken, setHasToken] = useState(!!getGitHubToken());
  const [settingsOpen, setSettingsOpen] = useState(false);
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
        <div className="auth-panel">
          <TokenSettings onChange={setHasToken} />
        </div>
      ) : (
        <>
          <UserRepoSearch
            onSearch={analysis.search}
            isLoading={busy}
            isPaused={status === "paused"}
            hasError={!!error}
            result={result}
            onPauseToggle={analysis.togglePause}
            onStop={analysis.stop}
            onSettings={() => setSettingsOpen(true)}
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
                  <p className="muted">{rangeLabel(result.range)}</p>
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
      {settingsOpen && (
        <Modal title="GitHub 设置" onClose={() => setSettingsOpen(false)}>
          {(close) => (
            <TokenSettings
              onChange={(enabled) => {
                setHasToken(enabled);
                if (!enabled) analysis.reset();
                close();
              }}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
