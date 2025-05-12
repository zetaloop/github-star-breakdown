import React, { useRef, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea
import { cn } from "@/lib/utils"; // Import cn for conditional classes

interface LoadingProgressProps {
  totalRepos: number;
  processedRepos: number;
  log: Array<{ name: string; status: string }>; // Use log prop
}

const LoadingProgress: React.FC<LoadingProgressProps> = ({
  totalRepos,
  processedRepos,
  log, // Destructure log prop
}) => {
  const progressPercentage =
    totalRepos > 0 ? (processedRepos / totalRepos) * 100 : 0;
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll smoothly to the bottom of the log
  useEffect(() => {
    const logContainer = scrollAreaRef.current?.querySelector(".space-y-1"); // Get the container of log entries
    if (logContainer && logContainer.lastElementChild) {
      // Use requestAnimationFrame to ensure scrolling happens after render
      requestAnimationFrame(() => {
        logContainer.lastElementChild?.scrollIntoView({
          behavior: "smooth",
          block: "end", // Scroll to the end of the element
        });
      });
    }
  }, [log]); // Scroll when log updates

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            Fetching data... ({processedRepos} / {totalRepos} repositories
            processed)
          </span>
        </div>
        <Progress value={progressPercentage} className="w-full" />
      </div>

      {/* Detailed Log */}
      <ScrollArea
        className="h-48 w-full rounded-md border p-4 bg-muted/40"
        ref={scrollAreaRef}
      >
        <div className="space-y-1">
          {log.map((entry, index) => (
            <p
              key={index}
              // Remove animation class
              className="text-xs font-mono whitespace-pre-wrap break-words"
            >
              <span
                className={cn(
                  "mr-1", // Add some spacing
                  entry.status.startsWith("✅") ? "text-green-500" : "",
                  entry.status.startsWith("❌") ? "text-red-500" : ""
                )}
              >
                [{index + 1}/{totalRepos}]
              </span>
              <span className="font-semibold mr-1">{entry.name}:</span>{" "}
              {/* Bold repo name */}
              <span>{entry.status}</span>
            </p>
          ))}
          {log.length === 0 &&
            totalRepos > 0 && ( // Initial message before first log entry
              <p className="text-xs font-mono text-muted-foreground animate-pulse pt-1">
                Starting fetch process...
              </p>
            )}
        </div>
      </ScrollArea>

      {/* Skeleton placeholders - Abstract list style with more pronounced staggered animation */}
      {/* Increased spacing (space-y-4) and removed border-t */}
      <div className="space-y-4 mt-4 pt-4">
        {/* Create 7 simpler horizontal bar skeletons */}
        {[...Array(7)].map((_, index) => (
          <Skeleton
            key={index}
            className="h-5 w-full animate-enhanced-pulse" // Use the custom animation class
            // Apply more pronounced staggered animation delay
            style={{ animationDelay: `${index * 0.3}s` }} // Increased delay increment
          />
        ))}
      </div>
      {/* Second skeleton block is removed as requested */}
    </div>
  );
};

export default LoadingProgress;
