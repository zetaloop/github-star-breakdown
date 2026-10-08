import type {
  RepoStarHistoryItem,
  StarHistoryWeek,
  TimeRange,
} from "../types/github";

const day = 86_400_000;

export function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function dateBounds(range: TimeRange, now = new Date()) {
  const from =
    range.type === "year"
      ? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      : range.type === "custom"
        ? range.from
        : undefined;
  return {
    from: from ? dateKey(from) : "1970-01-01",
    to: dateKey(range.type === "custom" ? range.to : now),
  };
}

export function rangeLabel(range: TimeRange): string {
  if (range.type === "custom") {
    return `${dateKey(range.from)} — ${dateKey(range.to)}`;
  }
  return range.type === "year" ? "最近一年" : "全部历史";
}

export function weekStart(timestamp: number): number {
  const date = new Date(timestamp * 1000);
  // GitHub's aggregation timezone can place Sunday midnight on Saturday in UTC.
  date.setUTCDate(date.getUTCDate() + ((7 - date.getUTCDay()) % 7));
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

export function historyPages(
  newest: number,
  pages: number,
  bounds: ReturnType<typeof dateBounds>,
) {
  const pageAt = (date: string) =>
    Math.max(
      1,
      Math.floor(
        Math.ceil((weekStart(newest) - Date.parse(date)) / (7 * day)) / 30,
      ) + 1,
    );
  return {
    first: pageAt(bounds.to),
    last: Math.min(pages, pageAt(bounds.from)),
  };
}

export function dailyHistory(
  repoName: string,
  weeks: StarHistoryWeek[],
  bounds: ReturnType<typeof dateBounds>,
): RepoStarHistoryItem[] {
  return weeks
    .flatMap((week) =>
      week.days.map((stars, index) => ({
        repoName,
        date: new Date(weekStart(week.week) + index * day)
          .toISOString()
          .slice(0, 10),
        stars,
      })),
    )
    .filter((item) => item.date >= bounds.from && item.date <= bounds.to)
    .sort((a, b) => a.date.localeCompare(b.date));
}
