import React, { useState, useEffect } from "react";
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
import { cn } from "@/lib/utils"; // Import cn utility
import { Search, Star, Calendar as CalendarIcon } from "lucide-react";

type TimeRangeOption = "year" | "all" | "custom";

interface UserRepoSearchProps {
  onSearch: (
    username: string,
    timeRange: TimeRangeOption,
    customRange?: DateRange
  ) => void;
  isLoading: boolean;
  onResetToken?: () => void;
}

const UserRepoSearch: React.FC<UserRepoSearchProps> = ({
  onSearch,
  isLoading,
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
    if (username.trim()) {
      onSearch(
        username.trim(),
        timeRange,
        timeRange === "custom" ? customRange : undefined
      );
    }
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
        </div>

        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            {" "}
            {/* Wrapper for ToggleGroup and Custom Button */}
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
                // If val is "", it means deselection, which type="single" should prevent if an item is clicked.
                // If timeRange was "custom" and user clicks "year"/"all", this correctly updates.
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
                    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-accent-foreground", // Base toggle styles
                    "bg-transparent",
                    "h-10 px-3",
                    "w-auto",
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
            <Button
              type="button"
              variant="link"
              onClick={onResetToken}
              disabled={isLoading}
              className="text-foreground"
            >
              Reset Token
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
};

export default UserRepoSearch;
