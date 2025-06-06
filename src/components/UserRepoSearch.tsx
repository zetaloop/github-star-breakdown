import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DateRange } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Search,
  Star,
  Calendar as CalendarIcon,
  Pause,
  Play,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import TokenInfoButton from "./TokenInfoButton";

type TimeRangeOption = "year" | "all" | "custom";

interface UserRepoSearchProps {
  onSearch: (
    username: string,
    timeRange: TimeRangeOption,
    customRange?: DateRange
  ) => void;
  isLoading: boolean;
  isPaused?: boolean;
  onPauseToggle?: () => void;
  onStop?: () => void;
  onResetToken?: () => void;
}

const UserRepoSearch: React.FC<UserRepoSearchProps> = ({
  onSearch,
  isLoading,
  isPaused,
  onPauseToggle,
  onStop,
  onResetToken,
}) => {
  const [username, setUsername] = useState<string>("");
  const [timeRange, setTimeRange] = useState<TimeRangeOption>("year");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(
    undefined
  );
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      return;
    }

    if (timeRange === "custom") {
      if (!customRange?.from || !customRange?.to) {
        toast.error(
          "Invalid custom date range. Both start and end dates are required."
        );
        setTimeRange("all");
        setCustomRange(undefined);
        setPopoverOpen(false);
        return;
      }
    }

    onSearch(
      username.trim(),
      timeRange,
      timeRange === "custom" ? customRange : undefined
    );
  };

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
            <Input
              placeholder="Enter GitHub username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="pl-8"
              type="text"
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="bg-github-blue hover:bg-github-darkBlue text-destructive-foreground"
          >
            <Star className="mr-2 h-4 w-4" />
            {isLoading ? "Loading..." : "Analyze Stars"}
          </Button>
          {isLoading && (
            <>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={onPauseToggle}
              >
                {isPaused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={onStop}
              >
                <Square className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            {" "}
            <ToggleGroup
              type="single"
              value={
                timeRange === "year" || timeRange === "all" ? timeRange : ""
              }
              onValueChange={(val) => {
                if (val === "year" || val === "all") {
                  setTimeRange(val as TimeRangeOption);
                  setCustomRange(undefined);
                  setPopoverOpen(false);
                }
              }}
              className="gap-1"
            >
              <ToggleGroupItem value="year">Last Year</ToggleGroupItem>
              <ToggleGroupItem value="all">All Time</ToggleGroupItem>
            </ToggleGroup>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  aria-label="Custom date range"
                  className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm font-medium",
                    "ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    "text-accent-foreground bg-transparent h-10 px-3 w-auto",
                    timeRange === "custom" && "bg-accent"
                  )}
                  onClick={() => {
                    setTimeRange("custom");
                  }}
                >
                  {customRange?.from && customRange?.to
                    ? `${format(customRange.from, "PPP")} - ${format(
                        customRange.to,
                        "PPP"
                      )}`
                    : customRange?.from
                      ? format(customRange.from, "PPP")
                      : "Custom"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={customRange?.from}
                  selected={customRange}
                  onSelect={(range) => {
                    setCustomRange(range);
                    setTimeRange("custom");
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
          {onResetToken && (
            <TokenInfoButton onReset={onResetToken} disabled={isLoading} />
          )}
        </div>
      </form>
    </Card>
  );
};

export default UserRepoSearch;
