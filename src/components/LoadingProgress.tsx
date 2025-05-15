import React, { useRef, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Define the possible stages
type LoadingStage = 0 | 1 | 2;

// Updated interface to use currentStage
interface LoadingProgressProps {
  totalRepos: number; // Represents total pages in stage 0, total repos in stage 1, total star pages in stage 2
  processedRepos: number; // Represents processed pages/repos/star pages based on stage
  log: Array<{ name: string; status: string }>;
  currentStage: LoadingStage; // Use a specific type for the stage
}

// Updated component implementation to handle three stages
const LoadingProgress: React.FC<LoadingProgressProps> = ({
  totalRepos,
  processedRepos,
  log,
  currentStage,
}) => {
  // When totalRepos is 0 (e.g. total pages unknown in stage 0), progressPercentage will be 0.
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
  }, [log]);

  // Determine bar color and text based on the current stage
  let barColorClass = "";
  let progressText = "";
  let logPrefixFn: (index: number, total: number) => string;

  switch (currentStage) {
    case 0: // Stage 0: Fetching repository list pages
      barColorClass = "bg-gray-400"; // Gray color for initial repo list fetching
      if (currentStage === 0 && totalRepos === 0) {
        // Total pages unknown
        progressText = `Fetching repository list... (Processed ${processedRepos} page(s), total unknown)`;
        logPrefixFn = (index) => `[Repo Page ${index + 1}]`;
      } else {
        // Total pages known
        const remainingPages = totalRepos - processedRepos;
        progressText = `Fetching repository list... ${processedRepos}/${totalRepos} pages (Remaining: ${remainingPages > 0 ? remainingPages : 0})`;
        logPrefixFn = (index, total) => `[Repo Page ${index + 1}/${total}]`;
      }
      break;
    case 1: // Stage 1: Fetching first page of stars for each repo
      barColorClass = "bg-blue-500"; // Blue color for fetching initial stars
      progressText = `Fetching first page of stars... (${processedRepos} / ${totalRepos} repositories processed)`;
      logPrefixFn = (index, total) => `[Repo ${index + 1}/${total}]`;
      break;
    case 2: // Stage 2: Loading remaining star pages
      barColorClass = "bg-green-500"; // Green color for loading remaining star pages
      progressText = `Loading remaining pages... (${processedRepos} / ${totalRepos} pages processed)`;
      // For stage 2, the log index doesn't directly map to total pages, so we don't show total.
      logPrefixFn = (index) => `[Star Page ${index + 1}]`;
      break;
    default: // Default case (should not happen with TypeScript)
      barColorClass = "bg-gray-400";
      progressText = "Processing...";
      logPrefixFn = (index) => `[${index + 1}]`;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          {/* Display dynamic progress text */}
          <span>{progressText}</span>
        </div>
        {/* Apply dynamic color class to Progress bar */}
        <Progress
          value={progressPercentage}
          className={cn("w-full", barColorClass)} // Removed animate-indeterminate-progress
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
