import type { DateBounds, GitHubRepo, RepoHistory } from "../types/github";

export interface RepoSeries extends GitHubRepo {
  color: string;
  history: RepoHistory | undefined;
}

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  repoId: number;
}

export type ChartMode = "cumulative" | "daily";
export type ChartPoint = { date: number; [key: string]: number };

const palette = [
  "#4C51BF",
  "#E53E3E",
  "#38A169",
  "#D69E2E",
  "#805AD5",
  "#3182CE",
  "#DD6B20",
  "#319795",
  "#D53F8C",
  "#718096",
  "#2C7A7B",
  "#975A16",
];

function hexToHsl(hex: string) {
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
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function repoColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  hash = Math.abs(hash);
  const { h, s, l } = hexToHsl(palette[hash % palette.length]);
  const hue = (h + ((hash & 0xff) % 40) - 20 + 360) % 360;
  const saturation = Math.min(
    95,
    Math.max(45, s + (((hash >> 8) & 0xff) % 200) - 100),
  );
  const lightness = Math.min(
    75,
    Math.max(35, l + (((hash >> 16) & 0xff) % 20) - 10),
  );
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function chartData(
  repos: RepoSeries[],
  bounds: DateBounds,
  mode: ChartMode,
) {
  const active = repos
    .filter((repo) => (repo.history?.total || 0) > 0)
    .toSorted((a, b) => (b.history?.total || 0) - (a.history?.total || 0));
  const series: ChartSeries[] = active.map((repo) => ({
    key: `r${repo.id}`,
    name: repo.name,
    color: repo.color,
    repoId: repo.id,
  }));
  if (!series.length) return { series, points: [] };
  const keys = new Map(series.map((entry) => [entry.repoId, entry.key]));
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
