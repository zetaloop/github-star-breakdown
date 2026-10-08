import type { AnalysisProgress } from "@/types/github";

interface LoadingProgressProps {
  progress: AnalysisProgress;
  status: string;
}

export default function LoadingProgress({ progress, status }: LoadingProgressProps) {
  const { stage, completed, total, requests } = progress;
  const label =
    status === "complete"
      ? "分析完成"
      : status === "stopped"
        ? "已停止，展示已取得的数据"
        : status === "paused"
          ? "已暂停，可恢复或重试"
          : stage === "repos"
            ? "正在读取仓库列表"
            : "正在读取星标历史";
  return (
    <div className="space-y-2 text-sm text-muted-foreground" role="status">
      <div className="flex justify-between gap-4">
        <span>{label}</span>
        <span>
          {completed}/{total || "?"} {stage === "repos" ? "页" : "个仓库"}
          {" · "}{requests} 次请求
        </span>
      </div>
      {(status === "loading" || status === "paused") && (
        <progress
          className="w-full h-2"
          value={total ? completed : undefined}
          max={total || 1}
          aria-label={label}
        />
      )}
    </div>
  );
}
