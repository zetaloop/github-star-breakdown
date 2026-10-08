import { Eye, Search } from "lucide-react";
import { type CSSProperties, memo, useMemo, useState } from "react";
import type { RepoSeries } from "@/lib/chart";
import { IconButton } from "./ui";

const numberFormat = new Intl.NumberFormat();
const dateFormat = new Intl.DateTimeFormat("zh-CN");

interface RepoStatsTableProps {
  repos: RepoSeries[];
  selected: Set<number> | null;
  highlighted: number | null;
  onToggle: (id: number) => void;
  onSelect: (ids: Set<number> | null) => void;
  onHighlight: (id: number | null) => void;
}

const RepoRow = memo(function RepoRow({
  repo,
  selected,
  highlighted,
  onToggle,
  onSelect,
  onHighlight,
}: {
  repo: RepoSeries;
  selected: boolean;
  highlighted: boolean;
} & Pick<RepoStatsTableProps, "onToggle" | "onSelect" | "onHighlight">) {
  return (
    <tr
      data-highlighted={highlighted}
      data-selected={selected}
      style={{ "--repo-color": repo.color } as CSSProperties}
      onMouseEnter={() => onHighlight(repo.id)}
      onMouseLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(repo.id)}
      onBlur={() => onHighlight(null)}
    >
      <td>
        <input
          type="checkbox"
          aria-label={`显示 ${repo.name}`}
          checked={selected}
          onChange={() => onToggle(repo.id)}
        />
      </td>
      <td>
        <div className="repo-name">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
            title={repo.full_name}
          >
            {repo.name}
          </a>
          <IconButton
            label={`仅查看 ${repo.name}`}
            className="repo-isolate"
            onClick={() => onSelect(new Set([repo.id]))}
          >
            <Eye />
          </IconButton>
        </div>
        {repo.description && (
          <p className="repo-description" title={repo.description}>
            {repo.description}
          </p>
        )}
        <div className="repo-meta">
          {repo.language && <span>{repo.language}</span>}
          <time dateTime={repo.created_at} title="创建时间">
            {dateFormat.format(new Date(repo.created_at))}
          </time>
          {repo.fork && <span>派生</span>}
        </div>
      </td>
      <td className="repo-count">
        <strong>
          {repo.history ? numberFormat.format(repo.history.total) : "未读取"}
        </strong>
        <span>{numberFormat.format(repo.stargazers_count)}</span>
      </td>
    </tr>
  );
});

export default memo(function RepoStatsTable({
  repos,
  selected,
  highlighted,
  onToggle,
  onSelect,
  onHighlight,
}: RepoStatsTableProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("range");
  const selectedCount = useMemo(
    () => repos.filter((repo) => !selected || selected.has(repo.id)).length,
    [repos, selected],
  );
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return repos
      .filter((repo) =>
        `${repo.name} ${repo.description || ""}`.toLowerCase().includes(text),
      )
      .toSorted((a, b) => {
        if (sort === "total")
          return (
            b.stargazers_count - a.stargazers_count ||
            a.name.localeCompare(b.name)
          );
        if (sort === "name") return a.name.localeCompare(b.name);
        return (
          (b.history?.total ?? -1) - (a.history?.total ?? -1) ||
          b.stargazers_count - a.stargazers_count ||
          a.name.localeCompare(b.name)
        );
      });
  }, [repos, query, sort]);
  return (
    <section className="repo-section" aria-label="仓库列表">
      <header className="section-heading">
        <div>
          <h2>
            仓库 <span className="repo-quantity">{repos.length}</span>
          </h2>
        </div>
        <select
          aria-label="仓库排序"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="range">区间星标</option>
          <option value="total">当前星标</option>
          <option value="name">名称</option>
        </select>
      </header>
      <div className="repo-filter">
        <Search size={15} />
        <input
          type="search"
          aria-label="筛选仓库"
          placeholder="筛选仓库"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="repo-selection">
        <span>
          已选 {selectedCount} / {repos.length}
        </span>
        <button type="button" onClick={() => onSelect(null)}>
          全部
        </button>
        <button type="button" onClick={() => onSelect(new Set())}>
          清空
        </button>
      </div>
      <div className="repo-scroll">
        <table className="repo-table">
          <caption className="sr-only">
            各仓库在所选范围内及当前的星标数量
          </caption>
          <colgroup>
            <col className="selection-column" />
            <col />
            <col className="count-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">显示</span>
              </th>
              <th scope="col">仓库</th>
              <th scope="col">范围内 / 当前</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((repo) => (
              <RepoRow
                key={repo.id}
                repo={repo}
                highlighted={highlighted === repo.id}
                selected={!selected || selected.has(repo.id)}
                onToggle={onToggle}
                onSelect={onSelect}
                onHighlight={onHighlight}
              />
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="no-repos">没有匹配的仓库</p>}
      </div>
    </section>
  );
});
