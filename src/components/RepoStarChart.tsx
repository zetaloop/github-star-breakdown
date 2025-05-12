import { useMemo, useRef, createRef } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TransitionGroup, CSSTransition } from "react-transition-group";
import { RepoStarHistoryItem } from "@/types/github";
import "./TooltipAnimation.css";

interface RepoStarChartProps {
  starHistory: RepoStarHistoryItem[];
  timeRange: "year" | "all";
}

// Generate a pseudo-random color based on repository name for consistent coloring
const getRepoColor = (repoName: string): string => {
  let hash = 0;
  for (let i = 0; i < repoName.length; i++) {
    hash = repoName.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use the hash to generate a hue between 0 and 360
  // Limit saturation and lightness for better visibility
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 50%)`;
};

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

  interface TooltipPayloadEntry {
    dataKey: string;
    name: string;
    value: number;
    color: string;
    payload: ChartDataPoint;
  }

  interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadEntry[];
    label?: string;
  }

  // Custom tooltip formatter to sort repos by current stars at the hovered date
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload || !payload.length) return null;

    // Create a sorted array of repositories based on star count at this specific date point
    const reposAtDate = payload
      .filter((entry) => entry.value > 0) // Filter out repos with 0 stars
      .sort((a, b) => b.value - a.value); // Sort by current stars (at tooltip point)

    return (
      <div className="bg-background border border-border p-3 rounded-md shadow-md">
        <p className="font-medium mb-2">
          {label ? new Date(label).toLocaleDateString() : ""}
        </p>
        <div className="tooltip-list space-y-1.5">
          <TransitionGroup component={null}>
            {reposAtDate.map((entry) => {
              // Create a ref for each item for CSSTransition
              const nodeRef = createRef<HTMLDivElement>();
              return (
                <CSSTransition
                  key={entry.dataKey}
                  nodeRef={nodeRef}
                  timeout={300}
                  classNames="tooltip-item"
                >
                  {(state) => {
                    const displayValue =
                      state === "exiting" || state === "exited"
                        ? 0
                        : entry.value;
                    const showPlus = timeRange === "year" && displayValue > 0;

                    return (
                      <div ref={nodeRef} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-sm">
                          {entry.dataKey}: {showPlus ? "+" : ""}
                          {displayValue.toLocaleString()}{" "}
                          {Math.abs(displayValue) === 1 ? "star" : "stars"}
                        </span>
                      </div>
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
            : "Cumulative star contribution of each repository over time"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => {
                  const d = new Date(date);
                  return `${d.getMonth() + 1}/${d.getFullYear() % 100}`;
                }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} animationDuration={0} />
              <Legend
                payload={repoNames.map((repo) => ({
                  value: repo,
                  type: "square",
                  id: repo,
                  color: getRepoColor(repo),
                }))}
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
      </CardContent>
    </Card>
  );
};

export default RepoStarChart;
