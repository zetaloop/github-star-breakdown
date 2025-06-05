import React, { useRef, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type LoadingStage = 0 | 1 | 2;

interface LoadingProgressProps {
  totalRepos: number;
  processedRepos: number;
  log: Array<{ name: string; status: string }>;
  currentStage: LoadingStage;
  paused: boolean;
  onToggle: () => void;
}

const LoadingProgress: React.FC<LoadingProgressProps> = ({
  totalRepos,
  processedRepos,
  log,
  currentStage,
  paused,
  onToggle,
}) => {
  const progressPercentage =
    totalRepos > 0 ? (processedRepos / totalRepos) * 100 : 0;

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log area when new entries appear
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
  let logPrefixFn: (index: number, total: number) => string;

  switch (currentStage) {
    case 0:
      barColorClass = "bg-gray-400";
      barBgClass = "bg-secondary";
      if (currentStage === 0 && totalRepos === 0) {
        progressText = `Fetching repository list...`;
        logPrefixFn = (index) => `[Repo Page ${index + 1}]`;
      } else {
        progressText = `Fetching repository list... ${processedRepos}/${totalRepos} pages`;
        logPrefixFn = (index, total) => `[Repo Page ${index + 1}/${total}]`;
      }
      break;
    case 1:
      barColorClass = "bg-blue-500";
      barBgClass = "bg-gray-400";
      progressText = `Fetching first page of stars... ${processedRepos}/${totalRepos} repos`;
      logPrefixFn = (index, total) => `[Repo ${index + 1}/${total}]`;
      break;
    case 2:
      barColorClass = "bg-green-500";
      barBgClass = "bg-blue-500";
      progressText = `Loading remaining pages... ${processedRepos}/${totalRepos} pages`;
      logPrefixFn = (index) => `[Star Page ${index + 1}]`;
      break;
    default:
      barColorClass = "bg-primary";
      barBgClass = "bg-secondary";
      progressText = "Processing...";
      logPrefixFn = (index) => `[${index + 1}]`;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{progressText}</span>
          <button
            type="button"
            onClick={onToggle}
            className="text-xs underline"
          >
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
        <Progress
          key={currentStage}
          value={progressPercentage}
          indicatorColor={barColorClass}
          backgroundColor={barBgClass}
        />
      </div>

      <ScrollArea
        className="h-48 w-full rounded-md border p-4 bg-muted/40"
        ref={scrollAreaRef}
      >
        <div className="space-y-1">
          {log.map((entry, index) => (
            <p
              key={index}
              className="text-xs font-mono whitespace-pre-wrap break-words"
            >
              <span
                className={cn(
                  "mr-1",
                  entry.status.startsWith("✅") ? "text-green-500" : "",
                  entry.status.startsWith("❌") ? "text-red-500" : "",
                  entry.status.startsWith("🔄") ? "text-yellow-500" : ""
                )}
              >
                {logPrefixFn(index, totalRepos)}
              </span>
              <span className="font-semibold mr-1">{entry.name}:</span>
              <span>{entry.status}</span>
            </p>
          ))}
          {log.length === 0 && totalRepos > 0 && (
            <p className="text-xs font-mono text-muted-foreground animate-pulse pt-1">
              Starting fetch process...
            </p>
          )}
        </div>
      </ScrollArea>

      <div className="space-y-4 mt-4 pt-4">
        {[...Array(7)].map((_, index) => (
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
