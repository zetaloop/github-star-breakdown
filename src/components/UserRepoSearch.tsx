import {
  ArrowRight,
  KeyRound,
  LoaderCircle,
  Pause,
  Play,
  Search,
  Square,
} from "lucide-react";
import { useState } from "react";
import { rangeLabel } from "@/services/history";
import type { AnalysisResult, TimeRange } from "@/types/github";
import DateRangePicker from "./DateRangePicker";
import { IconButton } from "./ui";

interface UserRepoSearchProps {
  onSearch: (username: string, range: TimeRange) => void;
  isLoading: boolean;
  isPaused: boolean;
  hasError: boolean;
  result: AnalysisResult | null;
  onPauseToggle: () => void;
  onStop: () => void;
  onSettings: () => void;
}

export default function UserRepoSearch({
  onSearch,
  isLoading,
  isPaused,
  hasError,
  result,
  onPauseToggle,
  onStop,
  onSettings,
}: UserRepoSearchProps) {
  const [username, setUsername] = useState("");
  const [range, setRange] = useState<TimeRange>({ type: "year" });
  const login = username.trim().replace(/^@/, "");
  const changed =
    result &&
    (login.toLowerCase() !== result.username.toLowerCase() ||
      rangeLabel(range) !== rangeLabel(result.range));
  return (
    <form
      className="search-panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (login && !isLoading) onSearch(login, range);
      }}
    >
      <div className="search-row">
        <div className="username-field">
          <Search size={19} />
          <input
            type="text"
            name="username"
            aria-label="GitHub 用户名"
            placeholder="GitHub 用户名"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            disabled={isLoading}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>
        <button
          className="primary-button"
          type="submit"
          disabled={isLoading || !login}
        >
          {isLoading ? (
            <LoaderCircle size={17} className={isPaused ? "" : "spinning"} />
          ) : (
            <ArrowRight size={17} />
          )}
          <span>
            {isPaused ? "已暂停" : isLoading ? "正在分析" : "分析星标"}
          </span>
        </button>
        <IconButton label="GitHub 设置" onClick={onSettings}>
          <KeyRound />
        </IconButton>
      </div>
      <div className="search-options">
        <DateRangePicker
          value={range}
          onChange={setRange}
          disabled={isLoading}
        />
        {isLoading && (
          <div className="run-controls">
            <button
              type="button"
              className="text-button"
              onClick={onPauseToggle}
            >
              {isPaused ? <Play size={15} /> : <Pause size={15} />}
              {isPaused ? (hasError ? "重试" : "恢复") : "暂停"}
            </button>
            <IconButton label="停止分析" onClick={onStop}>
              <Square size={15} />
            </IconButton>
          </div>
        )}
      </div>
      {changed && !isLoading && (
        <p className="search-note">
          筛选条件已更改，下方显示上一次分析的结果。
        </p>
      )}
    </form>
  );
}
