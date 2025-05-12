import React, { useRef, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface LoadingProgressProps {
  totalRepos: number;
  processedRepos: number;
  log: Array<{ name: string; status: string }>;
}

const LoadingProgress: React.FC<LoadingProgressProps> = ({
  totalRepos,
  processedRepos,
  log,
}) => {
  const progressPercentage =
    totalRepos > 0 ? (processedRepos / totalRepos) * 100 : 0;
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Effect to automatically scroll the log area to the bottom when new logs arrive
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      "div[data-radix-scroll-area-viewport]" // Target the viewport element of Radix ScrollArea
    );
    if (viewport) {
      // Use rAF to ensure scrolling happens after the DOM update
      requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight; // Jump to bottom
      });
    }
  }, [log]); // Dependency array ensures this runs when the log state changes

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            Fetching data... ({processedRepos} / {totalRepos} repositories
            processed)
          </span>
        </div>
        <Progress value={progressPercentage} className="w-full" />
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
                  entry.status.startsWith("❌") ? "text-red-500" : ""
                )}
              >
                [{index + 1}/{totalRepos}]
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

      {/* Skeleton placeholders mimicking a list with staggered animation */}
      <div className="space-y-4 mt-4 pt-4">
        {[...Array(7)].map((_, index) => (
          <Skeleton
            key={index}
            className="h-5 w-full animate-enhanced-pulse" // Uses custom enhanced pulse animation
            style={{ animationDelay: `${index * 0.15}s` }} // Staggered delay for cascade effect
          />
        ))}
      </div>
    </div>
  );
};

export default LoadingProgress;
