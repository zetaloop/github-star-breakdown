import { useDeferredValue, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { type ChartMode, chartData, type RepoSeries } from "@/lib/chart";
import type { AnalysisStatus, DateBounds } from "@/types/github";
import { Segmented } from "./ui";

const tickDate = new Intl.DateTimeFormat("zh-CN", {
  year: "2-digit",
  month: "numeric",
  timeZone: "UTC",
});
const fullDate = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const compactNumber = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function StarTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload.length || typeof label !== "number") return null;
  const entries = payload
    .filter((entry) => Number(entry.value) > 0)
    .toSorted((a, b) => Number(b.value) - Number(a.value));
  return (
    <div className="chart-tooltip">
      <header>
        <time>{fullDate.format(label)}</time>
        <strong>
          {entries
            .reduce((sum, entry) => sum + Number(entry.value), 0)
            .toLocaleString()}
        </strong>
      </header>
      <ul>
        {entries.map((entry) => (
          <li key={entry.name}>
            <span className="color-dot" style={{ background: entry.color }} />
            <span className="tooltip-name">{entry.name}</span>
            <span>{Number(entry.value).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RepoStarChart({
  repos,
  bounds,
  status,
  highlighted,
  onHighlight,
  onOnly,
}: {
  repos: RepoSeries[];
  bounds: DateBounds;
  status: AnalysisStatus;
  highlighted: number | null;
  onHighlight: (id: number | null) => void;
  onOnly: (id: number) => void;
}) {
  const [mode, setMode] = useState<ChartMode>("cumulative");
  const deferredRepos = useDeferredValue(repos);
  const { series, points } = useMemo(
    () => chartData(deferredRepos, bounds, mode),
    [deferredRepos, bounds, mode],
  );
  const focused =
    highlighted !== null &&
    series.some((entry) => entry.repoId === highlighted);
  return (
    <section className="chart-section" aria-label="星标贡献图">
      <header className="section-heading">
        <h2>星标贡献</h2>
        <Segmented<ChartMode>
          label="图表模式"
          value={mode}
          onChange={setMode}
          options={[
            { value: "cumulative", label: "累计" },
            { value: "daily", label: "每日" },
          ]}
        />
      </header>
      {series.length ? (
        <div className="star-plot" aria-busy={deferredRepos !== repos}>
          <ResponsiveContainer>
            <AreaChart
              data={points}
              margin={{ top: 16, right: 12, bottom: 4, left: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--line)"
                strokeDasharray="3 5"
              />
              <XAxis
                type="number"
                scale="time"
                dataKey="date"
                domain={["dataMin", "dataMax"]}
                axisLine={false}
                tickLine={false}
                minTickGap={35}
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                tickFormatter={(date: number) => tickDate.format(date)}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={48}
                allowDecimals={false}
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                tickFormatter={(value: number) => compactNumber.format(value)}
              />
              <Tooltip
                content={StarTooltip}
                animationDuration={0}
                allowEscapeViewBox={{ x: false, y: true }}
                position={{ y: 0 }}
                wrapperStyle={{ zIndex: 5 }}
              />
              {series.toReversed().map((entry) => (
                <Area
                  key={entry.key}
                  dataKey={entry.key}
                  name={entry.name}
                  stackId="stars"
                  stroke={entry.color}
                  fill={entry.color}
                  className={
                    focused &&
                    highlighted !== null &&
                    entry.repoId !== highlighted
                      ? "dimmed"
                      : undefined
                  }
                  fillOpacity={0.68}
                  strokeWidth={1.4}
                  isAnimationActive={false}
                  activeDot={false}
                  dot={points.length === 1 ? { r: 4 } : false}
                  onMouseEnter={() => onHighlight(entry.repoId)}
                  onMouseLeave={() => onHighlight(null)}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="empty-chart">
          {!repos.length
            ? "未选择仓库"
            : status === "paused"
              ? "分析已暂停"
              : status === "loading"
                ? "正在读取星标历史…"
                : "暂无星标数据"}
        </div>
      )}
      <div className="chart-legend">
        {series.map((entry) => (
          <button
            type="button"
            key={entry.key}
            title={`仅查看 ${entry.name}`}
            onClick={() => onOnly(entry.repoId)}
            onMouseEnter={() => onHighlight(entry.repoId)}
            onMouseLeave={() => onHighlight(null)}
            onFocus={() => onHighlight(entry.repoId)}
            onBlur={() => onHighlight(null)}
          >
            <span className="color-dot" style={{ background: entry.color }} />
            <span>{entry.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
