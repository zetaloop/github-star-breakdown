import type { AnalysisProgress, AnalysisStatus } from "@/types/github";

interface LoadingProgressProps {
  progress: AnalysisProgress;
  status: AnalysisStatus;
}

export default function LoadingProgress({
  progress,
  status,
}: LoadingProgressProps) {
  const { stage, completed, total, requests } = progress;
  const label =
    status === "complete"
      ? "分析完成"
      : status === "stopped"
        ? "已停止"
        : status === "paused"
          ? "已暂停"
          : stage === "repos"
            ? "正在读取仓库列表"
            : "正在读取星标历史";
  return (
    <div className={`analysis-progress ${status}`} role="status">
      <div className="progress-caption">
        <span>{label}</span>
        <span className="progress-details">
          <span>
            {completed}/{total || "?"} {stage === "repos" ? "页" : "个仓库"}
          </span>
          <span>{requests} 次请求</span>
        </span>
      </div>
      {(status === "loading" || status === "paused") && (
        <progress
          value={total ? completed : undefined}
          max={total || 1}
          aria-label={label}
        />
      )}
    </div>
  );
}
