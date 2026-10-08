import { AlertCircle, ChartNoAxesCombined } from "lucide-react";
import { useState } from "react";
import { useStarAnalysis } from "@/hooks/useStarAnalysis";
import { getGitHubToken } from "@/services/githubApi";
import { rangeLabel } from "@/services/history";
import AnalysisResults from "./AnalysisResults";
import LoadingProgress from "./LoadingProgress";
import TokenSettings from "./TokenSettings";
import UserRepoSearch from "./UserRepoSearch";
import { Modal } from "./ui";

export default function GitHubStarTracker() {
  const [hasToken, setHasToken] = useState(!!getGitHubToken());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const analysis = useStarAnalysis();
  const { result, status, progress, error } = analysis;
  const busy = status === "loading" || status === "paused";
  return (
    <div className="workspace">
      {!result && (
        <header className="welcome">
          <h1>看看项目的成长。</h1>
          <p>从一个 GitHub 账号出发，查看每个仓库的星标贡献。</p>
        </header>
      )}
      {!hasToken ? (
        <div className="auth-panel">
          <TokenSettings onChange={setHasToken} />
        </div>
      ) : (
        <>
          <UserRepoSearch
            onSearch={analysis.search}
            isLoading={busy}
            isPaused={status === "paused"}
            hasError={!!error}
            result={result}
            onPauseToggle={analysis.togglePause}
            onStop={analysis.stop}
            onSettings={() => setSettingsOpen(true)}
          />
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          {progress && <LoadingProgress progress={progress} status={status} />}
          {result && (
            <AnalysisResults
              key={`${result.username}:${rangeLabel(result.range)}`}
              result={result}
              status={status}
            />
          )}
          {!result && !busy && (
            <div className="empty-state">
              <ChartNoAxesCombined size={36} strokeWidth={1.2} />
              <p>输入用户名，展开星标历史</p>
              <span>项目之间的贡献与变化，会汇集在同一张图里。</span>
            </div>
          )}
        </>
      )}
      {settingsOpen && (
        <Modal title="GitHub 设置" onClose={() => setSettingsOpen(false)}>
          {(close) => (
            <TokenSettings
              onChange={(enabled) => {
                setHasToken(enabled);
                if (!enabled) analysis.reset();
                close();
              }}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
