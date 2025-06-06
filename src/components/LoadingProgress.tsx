import React, { useRef, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LogEntry } from "./GitHubStarTracker";
import { WorkerStatus } from "@/services/concurrency";
import {
  CheckCircle2,
  XCircle,
  Info,
  ChevronsRight,
  CircleEllipsis,
} from "lucide-react";

type LoadingStage = 0 | 1;

interface LoadingProgressProps {
  totalItems: number;
  processedItems: number;
  log: LogEntry[];
  currentStage: LoadingStage;
  workerStatuses: WorkerStatus[];
}

const LogIcon = ({ type }: { type: LogEntry["type"] }) => {
  switch (type) {
    case "success":
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case "error":
      return <XCircle className="h-3 w-3 text-red-500" />;
    case "info":
      return <Info className="h-3 w-3 text-blue-500" />;
    case "stage":
      return <ChevronsRight className="h-3 w-3 text-gray-500" />;
    case "debug":
      return <CircleEllipsis className="h-3 w-3 text-purple-500" />;
    default:
      return null;
  }
};

const LoadingProgress: React.FC<LoadingProgressProps> = ({
  totalItems,
  processedItems,
  log,
  currentStage,
  workerStatuses,
}) => {
  const progressPercentage =
    totalItems > 0 ? (processedItems / totalItems) * 100 : 0;

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      "div[data-radix-scroll-area-viewport]"
    );
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight;
      });
    }
  }, [log]);

  let barColorClass = "";
  let barBgClass = "";
  let progressText = "";

  switch (currentStage) {
    case 0:
      barColorClass = "bg-gray-400";
      barBgClass = "bg-secondary";
      progressText = `Fetching repository list... ${processedItems}/${totalItems || "?"} pages`;
      break;
    case 1:
      barColorClass = "bg-blue-500";
      barBgClass = "bg-gray-400";
      progressText = `Deep scanning repositories... ${processedItems}/${totalItems} pages`;
      break;
    default:
      barColorClass = "bg-primary";
      barBgClass = "bg-secondary";
      progressText = "Processing...";
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{progressText}</span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
        <Progress
          key={currentStage}
          value={progressPercentage}
          indicatorColor={barColorClass}
          backgroundColor={barBgClass}
        />
      </div>

      {workerStatuses.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            Worker Threads ({workerStatuses.length})
          </p>
          <div className="flex h-3 w-full space-x-px rounded-sm overflow-hidden border">
            {workerStatuses.map((status, index) => (
              <div
                key={index}
                className={cn("w-full h-full", {
                  "bg-green-500/80": status === "active",
                  "bg-red-500/80": status === "error",
                  "bg-secondary": status === "idle",
                })}
                title={`Worker ${index + 1}: ${status}`}
              />
            ))}
          </div>
        </div>
      )}

      <ScrollArea
        className="h-64 w-full rounded-md border p-3 bg-muted/40"
        ref={scrollAreaRef}
      >
        <div className="space-y-1.5">
          {log.map((entry, index) => (
            <div
              key={index}
              className="flex items-start text-xs font-mono whitespace-pre-wrap break-words"
            >
              <div className="flex items-center w-[105px] flex-shrink-0">
                <span className="text-gray-500 mr-2">
                  {entry.timestamp.toLocaleTimeString()}
                </span>
                <LogIcon type={entry.type} />
              </div>
              <p>
                <span
                  className={cn("font-semibold mr-1.5", {
                    "text-blue-500": entry.type === "info",
                    "text-green-500": entry.type === "success",
                    "text-red-500": entry.type === "error",
                    "text-gray-500": entry.type === "debug",
                  })}
                >
                  [{entry.source}]
                </span>
                <span>{entry.message}</span>
              </p>
            </div>
          ))}
          {log.length === 0 && (
            <p className="text-xs font-mono text-muted-foreground animate-pulse pt-1">
              Awaiting process to start...
            </p>
          )}
        </div>
      </ScrollArea>

      <div className="space-y-4 mt-4 pt-4">
        {[...Array(3)].map((_, index) => (
          <Skeleton
            key={index}
            className="h-5 w-full animate-enhanced-pulse"
            style={{ animationDelay: `${index * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
};

export default LoadingProgress;
