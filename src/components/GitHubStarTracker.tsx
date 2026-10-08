import { AlertCircle } from "lucide-react";
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
          <h1>GitHub 星标分析</h1>
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
