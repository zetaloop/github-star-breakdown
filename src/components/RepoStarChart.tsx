import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import type { CSSTransitionProps } from "react-transition-group/CSSTransition";
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
import {
  type ChartMode,
  type ChartSeries,
  chartData,
  type RepoSeries,
} from "@/lib/chart";
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
const numberFormat = new Intl.NumberFormat();
const chartMargin = { top: 16, right: 12, bottom: 4, left: 0 };

type TooltipEntry = TooltipContentProps["payload"][number];

const TooltipRow = memo(function TooltipRow({
  name,
  color,
  value,
  rank,
}: Pick<TooltipEntry, "name" | "color"> & { value: number; rank: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const previousRank = useRef(rank);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || previousRank.current === rank) return;
    node.classList.toggle("tooltip-up", previousRank.current > rank);
    node.classList.toggle("tooltip-down", previousRank.current < rank);
    previousRank.current = rank;
    for (const animation of node.getAnimations()) {
      animation.currentTime = 0;
      animation.play();
    }
  }, [rank]);
  return (
    <div
      ref={ref}
      className="tooltip-row"
      onAnimationEnd={(event) =>
        event.currentTarget.classList.remove("tooltip-up", "tooltip-down")
      }
    >
      <span className="color-dot" style={{ background: color }} />
      <span className="tooltip-name">{name}</span>
      <span>{numberFormat.format(value)}</span>
    </div>
  );
});

function TooltipItem({
  entry,
  rank,
  ...transition
}: {
  entry: TooltipEntry;
  rank: number;
} & Pick<
  CSSTransitionProps<HTMLLIElement>,
  "in" | "appear" | "enter" | "exit" | "onExited"
>) {
  const ref = useRef<HTMLLIElement>(null);
  return (
    <CSSTransition
      {...transition}
      nodeRef={ref}
      classNames="tooltip-item"
      addEndListener={(done) => {
        void Promise.allSettled(
          (ref.current?.getAnimations() || []).map(
            (animation) => animation.finished,
          ),
        ).then(done);
      }}
    >
      <li ref={ref}>
        <TooltipRow
          name={entry.name}
          color={entry.color}
          value={Number(entry.value)}
          rank={rank}
        />
      </li>
    </CSSTransition>
  );
}

function StarTooltip({ active, payload, label }: TooltipContentProps) {
  const entries = useMemo(
    () =>
      payload
        .filter((entry) => Number(entry.value) > 0)
        .toSorted((a, b) => Number(b.value) - Number(a.value)),
    [payload],
  );
  if (!active || !payload.length || typeof label !== "number") return null;
  return (
    <div className="chart-tooltip">
      <header>
        <time>{fullDate.format(label)}</time>
        <strong>
          {numberFormat.format(
            entries.reduce((sum, entry) => sum + Number(entry.value), 0),
          )}
        </strong>
      </header>
      <TransitionGroup component="ul" className="tooltip-list">
        {entries.map((entry, rank) => (
          <TooltipItem key={String(entry.dataKey)} entry={entry} rank={rank} />
        ))}
      </TransitionGroup>
    </div>
  );
}

const chartFrame = (
  <>
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
  </>
);

const RepoArea = memo(function RepoArea({
  entry,
  highlighted,
  singlePoint,
  onHighlight,
}: {
  entry: ChartSeries;
  highlighted: boolean;
  singlePoint: boolean;
  onHighlight: (id: number | null) => void;
}) {
  const enter = useCallback(
    () => onHighlight(entry.repoId),
    [entry.repoId, onHighlight],
  );
  const leave = useCallback(() => onHighlight(null), [onHighlight]);
  return (
    <Area
      dataKey={entry.key}
      name={entry.name}
      stackId="stars"
      stroke={entry.color}
      fill={entry.color}
      className={highlighted ? "highlighted" : undefined}
      fillOpacity={0.68}
      strokeWidth={1.4}
      isAnimationActive={false}
      activeDot={false}
      dot={singlePoint ? { r: 4 } : false}
      onMouseEnter={enter}
      onMouseLeave={leave}
    />
  );
});

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
  const { series, points } = useMemo(
    () => chartData(repos, bounds, mode),
    [repos, bounds, mode],
  );
  const focused =
    highlighted !== null &&
    series.some((entry) => entry.repoId === highlighted);
  const legend = useMemo(
    () => (
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
    ),
    [series, onOnly, onHighlight],
  );
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
        <div className="star-plot" data-highlighted={focused}>
          <ResponsiveContainer>
            <AreaChart data={points} margin={chartMargin}>
              {chartFrame}
              {series.toReversed().map((entry) => (
                <RepoArea
                  key={entry.key}
                  entry={entry}
                  highlighted={entry.repoId === highlighted}
                  singlePoint={points.length === 1}
                  onHighlight={onHighlight}
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
      {legend}
    </section>
  );
}
