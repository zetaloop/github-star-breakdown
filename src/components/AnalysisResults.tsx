import { ExternalLink } from "lucide-react";
import { lazy, memo, Suspense, useCallback, useMemo, useState } from "react";
import { type RepoSeries, repoColor } from "@/lib/chart";
import { rangeLabel } from "@/services/history";
import type { AnalysisResult, AnalysisStatus } from "@/types/github";
import RepoStatsTable from "./RepoStatsTable";

const RepoStarChart = lazy(() => import("./RepoStarChart"));

export default memo(function AnalysisResults({
  result,
  status,
}: {
  result: AnalysisResult;
  status: AnalysisStatus;
}) {
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const repos: RepoSeries[] = useMemo(
    () =>
      result.repos.map((repo) => ({
        ...repo,
        color: repoColor(repo.name),
        history: result.history.get(repo.id),
      })),
    [result.repos, result.history],
  );
  const visible = useMemo(
    () => repos.filter((repo) => !selected || selected.has(repo.id)),
    [repos, selected],
  );
  const { total, inRange } = useMemo(
    () => ({
      total: repos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
      inRange: repos.reduce((sum, repo) => sum + (repo.history?.total || 0), 0),
    }),
    [repos],
  );

  const toggle = useCallback(
    (id: number) => {
      setSelected((value) => {
        const next = new Set(value || repos.map((repo) => repo.id));
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [repos],
  );
  const selectOnly = useCallback(
    (id: number) => setSelected(new Set([id])),
    [],
  );

  return (
    <section
      className="analysis-results"
      aria-label={`${result.username} 的星标分析`}
    >
      <header className="result-header">
        {repos[0] && (
          <img
            className="avatar"
            src={repos[0].owner.avatar_url}
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
          <dd>{total.toLocaleString()}</dd>
        </div>
        <div>
          <dt>获得星标的仓库</dt>
          <dd>{repos.length.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{status === "complete" ? "范围内星标" : "范围内已读取"}</dt>
          <dd>{inRange.toLocaleString()}</dd>
        </div>
      </dl>
      {repos.length ? (
        <div className="analysis-detail">
          <Suspense
            fallback={
              <div className="plot-placeholder" role="status">
                正在准备图表…
              </div>
            }
          >
            <RepoStarChart
              repos={visible}
              bounds={result.bounds}
              status={status}
              highlighted={highlighted}
              onHighlight={setHighlighted}
              onOnly={selectOnly}
            />
          </Suspense>
          <RepoStatsTable
            repos={repos}
            selected={selected}
            highlighted={highlighted}
            onToggle={toggle}
            onSelect={setSelected}
            onHighlight={setHighlighted}
          />
        </div>
      ) : (
        <p className="empty-state">此用户没有获得星标的公开仓库。</p>
      )}
    </section>
  );
});
