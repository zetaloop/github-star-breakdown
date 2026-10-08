import type { DateBounds, GitHubRepo, RepoHistory } from "../types/github";

export interface RepoSeries extends GitHubRepo {
  color: string;
  history: RepoHistory | undefined;
}

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  repoIds: number[];
}

export type ChartMode = "cumulative" | "daily";
export type ChartPoint = { date: number; [key: string]: number };

export const palette = [
  "#718fc5",
  "#c58f69",
  "#75a395",
  "#a18bbe",
  "#ca858f",
  "#a8a56b",
  "#69a5b5",
  "#bd91ae",
  "#93a27a",
  "#b39880",
  "#808f9e",
  "#9a9ac3",
];

export function chartData(
  repos: RepoSeries[],
  bounds: DateBounds,
  mode: ChartMode,
  grouped: boolean,
) {
  const active = repos
    .filter((repo) => (repo.history?.total || 0) > 0)
    .toSorted((a, b) => (b.history?.total || 0) - (a.history?.total || 0));
  const individual = grouped ? active.slice(0, 10) : active;
  const series: ChartSeries[] = individual.map((repo) => ({
    key: `r${repo.id}`,
    name: repo.name,
    color: repo.color,
    repoIds: [repo.id],
  }));
  if (grouped && active.length > 10) {
    series.push({
      key: "others",
      name: `其他 ${active.length - 10} 个仓库`,
      color: "#a3a3a3",
      repoIds: active.slice(10).map((repo) => repo.id),
    });
  }
  if (!series.length) return { series, points: [] };
  const keys = new Map(
    series.flatMap((entry) =>
      entry.repoIds.map((id) => [id, entry.key] as const),
    ),
  );
  const days = new Map<number, Record<string, number>>();
  for (const repo of active) {
    const key = keys.get(repo.id);
    if (!key || !repo.history) continue;
    for (const entry of repo.history.days) {
      const date = Date.parse(entry.date);
      let values = days.get(date);
      if (!values) {
        values = {};
        days.set(date, values);
      }
      values[key] = (values[key] || 0) + entry.stars;
    }
  }
  const totals: Record<string, number> = {};
  const points: ChartPoint[] = [];
  const from = Math.max(
    Date.parse(bounds.from),
    Math.min(...active.map((repo) => Date.parse(repo.created_at.slice(0, 10)))),
  );
  const to = Date.parse(bounds.to);
  for (let date = from; date <= to; date += 86_400_000) {
    const point: ChartPoint = { date };
    for (const entry of series) {
      const stars = days.get(date)?.[entry.key] || 0;
      totals[entry.key] = (totals[entry.key] || 0) + stars;
      point[entry.key] = mode === "cumulative" ? totals[entry.key] : stars;
    }
    points.push(point);
  }
  return { series, points };
}
