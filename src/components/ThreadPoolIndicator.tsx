import React from "react";
import { cn } from "@/lib/utils";

export type ThreadStatus = "idle" | "active" | "error";

interface ThreadPoolIndicatorProps {
  statuses: ThreadStatus[];
}

const ThreadPoolIndicator: React.FC<ThreadPoolIndicatorProps> = ({
  statuses,
}) => {
  const colorMap: Record<ThreadStatus, string> = {
    idle: "bg-muted",
    active: "bg-green-500",
    error: "bg-red-500",
  };

  return (
    <div
      className="w-full h-2 grid gap-px rounded"
      style={{
        gridTemplateColumns: `repeat(${statuses.length}, minmax(0, 1fr))`,
      }}
    >
      {statuses.map((status, idx) => (
        <div key={idx} className={cn("h-full", colorMap[status])} />
      ))}
    </div>
  );
};

export default ThreadPoolIndicator;
