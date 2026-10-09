import { LineChart, type LineSeriesOption } from "echarts/charts";
import {
  DatasetComponent,
  type DatasetComponentOption,
  type GridComponentOption,
  GridSimpleComponent,
} from "echarts/components";
import {
  type ComposeOption,
  color,
  type ECElementEvent,
  type EChartsType,
  type ElementEvent,
  init,
  use,
} from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import {
  memo,
  useCallback,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type ChartMode, chartData, type RepoSeries } from "@/lib/chart";
import type { AnalysisStatus, DateBounds } from "@/types/github";
import StarTooltip from "./StarTooltip";
import { Segmented } from "./ui";

use([LineChart, GridSimpleComponent, DatasetComponent, SVGRenderer]);

const day = 86_400_000;
const grid = { top: 16, right: 12, bottom: 34, left: 48 };
const tickDate = new Intl.DateTimeFormat("zh-CN", {
  year: "2-digit",
  month: "numeric",
  timeZone: "UTC",
});
const fullDate = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "long",
  timeZone: "UTC",
});
const compactNumber = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

type Option = ComposeOption<
  LineSeriesOption | GridComponentOption | DatasetComponentOption
>;
type Cursor = { date: number; x: number; source: "pointer" | "keyboard" };

const Plot = memo(function Plot({
  series,
  points,
  highlighted,
  onHighlight,
}: ReturnType<typeof chartData> & {
  highlighted: number | null;
  onHighlight: (id: number | null) => void;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType | null>(null);
  const pointer = useRef<number | null>(null);
  const active = useRef<Cursor | null>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [width, setWidth] = useState(0);
  const [tooltipWidth, setTooltipWidth] = useState(0);
  const tooltipId = useId();

  const hide = useCallback(() => {
    pointer.current = null;
    active.current = null;
    setCursor(null);
  }, []);

  const selectDate = useCallback(
    (date: number, source: Cursor["source"]) => {
      const instance = chart.current;
      if (!instance) return;
      const index = Math.max(
        0,
        Math.min(
          points.length - 1,
          Math.ceil((date - points[0].date) / day - 0.5),
        ),
      );
      const selected = points[index].date;
      const next = {
        date: selected,
        x: instance.convertToPixel({ xAxisIndex: 0 }, selected),
        source,
      };
      active.current = next;
      setCursor((previous) =>
        previous?.date === next.date &&
        previous.x === next.x &&
        previous.source === next.source
          ? previous
          : next,
      );
    },
    [points],
  );

  const refreshCursor = useEffectEvent(() => {
    const instance = chart.current;
    const current = active.current;
    if (!instance || !current) return;
    selectDate(
      current.source === "pointer" && pointer.current !== null
        ? instance.convertFromPixel({ xAxisIndex: 0 }, pointer.current)
        : current.date,
      current.source,
    );
  });

  const move = useEffectEvent((event: ElementEvent) => {
    const instance = chart.current;
    if (!instance) return;
    if (
      !instance.containPixel({ gridIndex: 0 }, [event.offsetX, event.offsetY])
    ) {
      hide();
      return;
    }
    pointer.current = event.offsetX;
    selectDate(
      instance.convertFromPixel({ xAxisIndex: 0 }, event.offsetX),
      "pointer",
    );
  });

  const leave = useEffectEvent(() => {
    pointer.current = null;
    if (active.current?.source !== "keyboard") hide();
    onHighlight(null);
  });

  const enterSeries = useEffectEvent((event: ECElementEvent) => {
    if (event.componentType !== "series" || event.seriesIndex === undefined)
      return;
    const entry = series[series.length - 1 - event.seriesIndex];
    onHighlight(entry?.repoId ?? null);
  });
  const leaveSeries = useEffectEvent(() => onHighlight(null));

  const highlight = useEffectEvent((id = highlighted) => {
    const instance = chart.current;
    if (!instance) return;
    instance.dispatchAction({ type: "downplay" });
    const index = series.findIndex((entry) => entry.repoId === id);
    if (index >= 0) {
      instance.dispatchAction({
        type: "highlight",
        seriesIndex: series.length - 1 - index,
      });
    }
  });

  const resize = useEffectEvent(() => {
    const instance = chart.current;
    if (!instance) return;
    instance.resize();
    setWidth(instance.getWidth());
    refreshCursor();
  });

  useLayoutEffect(() => {
    const node = surface.current;
    if (!node) return;
    const instance = init(node, undefined, { renderer: "svg" });
    chart.current = instance;
    setWidth(instance.getWidth());
    instance.getZr().on("mousemove", move);
    instance.getZr().on("click", move);
    instance.getZr().on("globalout", leave);
    instance.on("mouseover", enterSeries);
    instance.on("mouseout", leaveSeries);
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const instance = chart.current;
    const node = surface.current;
    if (!instance || !node) return;
    const style = getComputedStyle(node);
    const label = {
      color: "var(--text-muted)",
      fontFamily: style.fontFamily,
      fontSize: 11,
    };
    const single = points.length === 1;
    const option: Option = {
      useUTC: true,
      animation: false,
      stateAnimation: { duration: 0 },
      grid: { ...grid, outerBoundsMode: "none" },
      textStyle: label,
      xAxis: {
        type: "time",
        min: points[0].date - (single ? day / 2 : 0),
        max: points[points.length - 1].date + (single ? day / 2 : 0),
        minInterval: day,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          ...label,
          hideOverlap: true,
          alignMinLabel: "left",
          alignMaxLabel: "right",
          formatter: (date: number) =>
            single && date !== points[0].date ? "" : tickDate.format(date),
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        minInterval: 1,
        splitNumber: 4,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "var(--line)", type: [3, 5] } },
        axisLabel: {
          ...label,
          formatter: (value: number) => compactNumber.format(value),
        },
      },
      dataset: {
        id: "stars",
        dimensions: [
          { name: "date", type: "time" },
          ...series.map((entry) => ({
            name: entry.key,
            type: "float" as const,
          })),
        ],
        source: points,
      },
      series: series.toReversed().map(
        (entry, layer): LineSeriesOption => ({
          // ECharts retains series order by id during merges.
          id: String(layer),
          name: entry.name,
          type: "line",
          z: layer + 3,
          datasetId: "stars",
          encode: { x: "date", y: entry.key },
          stack: "stars",
          triggerEvent: "area",
          clip: false,
          showSymbol: single,
          symbol: "circle",
          symbolSize: 8,
          lineStyle: { color: entry.color, width: 1.4, join: "miter" },
          areaStyle: { color: entry.color, opacity: 0.68 },
          itemStyle: {
            color: color.modifyAlpha(entry.color, 0.68),
            borderColor: entry.color,
            borderWidth: 1.4,
          },
          emphasis: {
            focus: "series",
            scale: false,
            lineStyle: { color: entry.color, width: 1.4, opacity: 1 },
            areaStyle: { color: entry.color, opacity: 0.68 },
            itemStyle: {
              color: color.modifyAlpha(entry.color, 0.68),
              borderColor: entry.color,
            },
          },
          blur: {
            lineStyle: { opacity: 0.2 },
            areaStyle: { opacity: 0.136 },
            itemStyle: { opacity: 0.2 },
          },
        }),
      ),
    };
    instance.setOption(option, { replaceMerge: ["series"] });
    highlight();
    refreshCursor();
  }, [series, points]);

  useLayoutEffect(() => {
    highlight(highlighted);
  }, [highlighted]);

  const index = cursor
    ? Math.max(
        0,
        Math.min(
          points.length - 1,
          Math.round((cursor.date - points[0].date) / day),
        ),
      )
    : 0;
  const tooltipLeft = cursor
    ? Math.max(
        grid.left,
        cursor.x + tooltipWidth + 10 <= width - grid.right
          ? cursor.x + 10
          : cursor.x - tooltipWidth - 10,
      )
    : 0;
  return (
    <div
      className="star-plot"
      role="slider"
      aria-label="星标日期"
      aria-valuemin={points[0].date}
      aria-valuemax={points[points.length - 1].date}
      aria-valuenow={points[index].date}
      aria-valuetext={fullDate.format(points[index].date)}
      aria-describedby={cursor ? tooltipId : undefined}
      tabIndex={0}
      onFocus={(event) => {
        if (
          event.target === event.currentTarget &&
          event.currentTarget.matches(":focus-visible")
        ) {
          pointer.current = null;
          selectDate(active.current?.date ?? points[0].date, "keyboard");
        }
      }}
      onBlur={hide}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          hide();
          return;
        }
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        pointer.current = null;
        const date = active.current?.date ?? points[0].date;
        selectDate(
          date + (event.key === "ArrowRight" ? day : -day),
          "keyboard",
        );
      }}
    >
      <div ref={surface} className="plot-surface" />
      {cursor && (
        <>
          <div
            className="chart-cursor"
            style={{ transform: `translateX(${cursor.x}px)` }}
          />
          <div
            id={tooltipId}
            className="tooltip-positioner"
            style={{ transform: `translateX(${tooltipLeft}px)` }}
            role="tooltip"
            aria-live={cursor.source === "keyboard" ? "polite" : "off"}
          >
            <StarTooltip
              point={points[index]}
              series={series}
              onWidthChange={setTooltipWidth}
            />
          </div>
        </>
      )}
    </div>
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
      {series.length && points.length ? (
        <Plot
          series={series}
          points={points}
          highlighted={highlighted}
          onHighlight={onHighlight}
        />
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
