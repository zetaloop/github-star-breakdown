import { createRef, useEffect, useMemo, useRef } from "react";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RepoStarHistoryItem } from "@/types/github";
import "./TooltipAnimation.css";

interface RepoStarChartProps {
  starHistory: RepoStarHistoryItem[];
  timeRange: "year" | "all" | "custom";
}

interface ChartDataPoint {
  date: string;
  [key: string]: string | number | null;
}

const RepoStarChart: React.FC<RepoStarChartProps> = ({
  starHistory,
  timeRange,
}) => {
  // Process data to create a continuous stacked area chart
  const chartData = useMemo(() => {
    if (!starHistory.length) return [];

    // Get unique dates and repos
    const dateSet = new Set<string>();
    const repoSet = new Set<string>();

    starHistory.forEach((item) => {
      dateSet.add(item.date);
      repoSet.add(item.repoName);
    });

    const dates = Array.from(dateSet).sort();
    const repos = Array.from(repoSet);

    // Initialize data structure with zero values
    const stackedData: ChartDataPoint[] = dates.map((date) => {
      const dataPoint: ChartDataPoint = { date };
      repos.forEach((repo) => {
        dataPoint[repo] = 0;
      });
      return dataPoint;
    });

    // Create a map for quick lookup
    const dateMap = new Map<string, number>();
    dates.forEach((date, index) => {
      dateMap.set(date, index);
    });

    // Fill in actual star data
    starHistory.forEach((item) => {
      const index = dateMap.get(item.date);
      if (index !== undefined) {
        stackedData[index][item.repoName] = item.stars;
      }
    });

    // Make the data cumulative for stacked area chart
    // For each repo, stars should accumulate over time
    repos.forEach((repo) => {
      let cumulativeStars = 0;
      for (let i = 0; i < stackedData.length; i++) {
        cumulativeStars += stackedData[i][repo] as number;
        stackedData[i][repo] = cumulativeStars;
      }
    });

    // Convert initial zeros to null but keep one zero before first non-zero to smooth transition
    repos.forEach((repo) => {
      const firstIdx = stackedData.findIndex((dp) => (dp[repo] as number) > 0);
      if (firstIdx > 0) {
        for (let i = 0; i < firstIdx; i++) {
          // keep last zero before data starts, hide earlier zeros
          stackedData[i][repo] = i === firstIdx - 1 ? 0 : null;
        }
      } else if (firstIdx === -1) {
        // repo never appears, hide all
        stackedData.forEach((dp) => {
          dp[repo] = null;
        });
      }
    });
    return stackedData;
  }, [starHistory]);

  // Extract unique repository names for rendering areas
  // Sort repos by the same criteria as the table for consistency
  const repoNames = useMemo(() => {
    if (chartData.length === 0) return [];

    // Get the last data point (most recent) to sort by current star count
    const latestDataPoint = chartData[chartData.length - 1];

    // Filter repos that have stars
    const reposWithStars = Object.entries(latestDataPoint)
      .filter(([key, value]) => key !== "date" && (value as number) > 0)
      .map(([repo, stars]) => ({ repo, stars: stars as number }));

    // Sort by current stars (desc) as the primary criterion
    return reposWithStars
      .sort((a, b) => b.stars - a.stars)
      .map((item) => item.repo);
  }, [chartData]);

  // Map of repo name to total stars for scaling legend items
  const starTotals = useMemo(() => {
    if (chartData.length === 0) return new Map<string, number>();
    const latest = chartData[chartData.length - 1];
    const map = new Map<string, number>();
    Object.entries(latest).forEach(([key, value]) => {
      if (key !== "date") {
        map.set(key, value as number);
      }
    });
    return map;
  }, [chartData]);

  const maxStars = useMemo(
    () => Math.max(0, ...Array.from(starTotals.values())),
    [starTotals],
  );

  // Basic color palette with handpicked colors
  const BASE_PALETTE = [
    "#4C51BF", // Indigo
    "#E53E3E", // Red
    "#38A169", // Green
    "#D69E2E", // Gold
    "#805AD5", // Purple
    "#3182CE", // Blue
    "#DD6B20", // Orange
    "#319795", // Teal
    "#D53F8C", // Pink
    "#718096", // Gray
    "#2C7A7B", // Cyan
    "#975A16", // Brown
  ];
  // Helper to convert HEX to HSL
  const hexToHSL = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) {
        h = (g - b) / d + (g < b ? 6 : 0);
      } else if (max === g) {
        h = (b - r) / d + 2;
      } else {
        h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  };
  // Generate infinite harmonious colors with enhanced variation
  const getRepoColor = (repoName: string): string => {
    // Generate hash from repository name
    let hash = 0;
    for (const ch of repoName) {
      hash = ch.charCodeAt(0) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);

    // Use palette color as base
    const idx = hash % BASE_PALETTE.length;
    const { h: baseH, s: baseS, l: baseL } = hexToHSL(BASE_PALETTE[idx]);

    // Create more color variation with multiple hash bits
    const hashPart1 = hash & 0xff;
    const hashPart2 = (hash >> 8) & 0xff;
    const hashPart3 = (hash >> 16) & 0xff;

    // Apply hue shift
    const hueRange = 20;
    const hueShift = (hashPart1 % (hueRange * 2)) - hueRange;
    const hue = (baseH + hueShift + 360) % 360;

    // Apply saturation variation
    const satRange = 100;
    const satShift = (hashPart2 % (satRange * 2)) - satRange;
    const saturation = Math.min(95, Math.max(45, baseS + satShift));

    // Apply lightness variation
    const lightRange = 10;
    const lightShift = (hashPart3 % (lightRange * 2)) - lightRange;
    const lightness = Math.min(75, Math.max(35, baseL + lightShift));

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  interface TooltipPayloadEntry {
    dataKey: string;
    name: string;
    value: number;
    color: string;
    payload: ChartDataPoint;
  }

  const prevOrderRef = useRef<string[]>([]);

  interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadEntry[];
    label?: string;
  }

  // Custom tooltip formatter to sort repos by current stars at the hovered date
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    const reposAtDate = useMemo(() => {
      if (!payload) return [] as TooltipPayloadEntry[];
      return payload
        .filter((entry) => entry.value > 0)
        .sort((a, b) => b.value - a.value);
    }, [payload]);

    const prevOrder = prevOrderRef.current;

    useEffect(() => {
      prevOrderRef.current = reposAtDate.map((entry) => entry.dataKey);
    }, [reposAtDate]);

    if (!active || reposAtDate.length === 0) return null;

    return (
      <div className="bg-background border border-border p-3 rounded-md shadow-md">
        <p className="font-medium mb-2">
          {label ? new Date(label).toLocaleDateString() : ""}
        </p>
        <div className="tooltip-list space-y-1.5">
          <TransitionGroup component="ul" className="list-none p-0 m-0">
            {reposAtDate.map((entry, index) => {
              const nodeRef = createRef<HTMLLIElement>();
              return (
                <CSSTransition
                  key={entry.dataKey}
                  nodeRef={nodeRef}
                  timeout={300}
                  classNames="tooltip-item"
                >
                  {(state: string) => {
                    const fadingOut = state === "exiting" || state === "exited";
                    const value = fadingOut ? 0 : entry.value;
                    const showPlus =
                      !fadingOut &&
                      (timeRange === "year" || timeRange === "custom") &&
                      value > 0;
                    const prevIndex = prevOrder.indexOf(entry.dataKey);
                    const moveClass =
                      prevIndex === -1
                        ? ""
                        : prevIndex > index
                          ? "tooltip-item-move tooltip-item-move-up"
                          : prevIndex < index
                            ? "tooltip-item-move tooltip-item-move-down"
                            : "";
                    return (
                      <li
                        ref={nodeRef}
                        className={cn("flex items-center gap-2", moveClass)}
                      >
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-sm">
                          {entry.dataKey}: {showPlus ? "+" : ""}
                          {value.toLocaleString()}{" "}
                          {Math.abs(value) === 1 ? "star" : "stars"}
                        </span>
                      </li>
                    );
                  }}
                </CSSTransition>
              );
            })}
          </TransitionGroup>
        </div>
      </div>
    );
  };

  const CustomLegend = () => (
    <ul className="flex flex-wrap justify-center gap-2 mt-4">
      {repoNames.map((repo) => {
        const stars = starTotals.get(repo) || 0;
        const ratio = maxStars ? Math.sqrt(stars / maxStars) : 0;
        const fontSize = 0.75 + 0.25 * ratio; // rem
        const square = 0.75 + 0.5 * ratio; // rem
        return (
          <li
            key={repo}
            className="flex items-center gap-2"
            style={{ fontSize: `${fontSize}rem` }}
          >
            <span
              className="rounded-sm"
              style={{
                backgroundColor: getRepoColor(repo),
                width: `${square}rem`,
                height: `${square}rem`,
              }}
            />
            <span>{repo}</span>
          </li>
        );
      })}
    </ul>
  );

  if (starHistory.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Repository Star Growth</CardTitle>
          <CardDescription>
            No star data available for the selected time range.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Repository Star Growth</CardTitle>
        <CardDescription>
          {timeRange === "year"
            ? "Cumulative star growth over the last year"
            : timeRange === "custom"
              ? "Cumulative star growth for selected range"
              : "Cumulative star contribution of each repository over time"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] relative">
          <ResponsiveContainer
            width="100%"
            height="100%"
            style={{ overflow: "visible" }}
          >
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              accessibilityLayer
              style={{ overflow: "visible" }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => {
                  const d = new Date(date);
                  return `${d.getFullYear() % 100}/${d.getMonth() + 1}`;
                }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                wrapperStyle={{ zIndex: 20 }}
                content={<CustomTooltip />}
                animationDuration={0}
                allowEscapeViewBox={{ x: false, y: true }}
                position={{ y: 0 }}
              />
              {/* Render areas in the same order as the table (by total stars desc) */}
              {[...repoNames].reverse().map((repo) => (
                <Area
                  key={repo}
                  type="linear" // Use linear interpolation to avoid misalignment caused by smoothing algorithm
                  dataKey={repo}
                  name={repo}
                  stackId="1"
                  stroke={getRepoColor(repo)}
                  fill={getRepoColor(repo)}
                  fillOpacity={0.6}
                  isAnimationActive={false} // Disable animation
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <CustomLegend />
      </CardContent>
    </Card>
  );
};

export default RepoStarChart;
