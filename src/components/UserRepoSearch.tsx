import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import DateRangePicker, { DateRange } from "./DateRangePicker";
import { format } from "date-fns";
import { Search, Star } from "lucide-react";

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
  const [customRange, setCustomRange] = useState<DateRange>({});

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
            className="bg-github-blue hover:bg-github-darkBlue"
          >
            <Star className="mr-2 h-4 w-4" />
            {isLoading ? "Loading..." : "Analyze Stars"}
          </Button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-4">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(val) => val && setTimeRange(val as TimeRangeOption)}
            className="gap-1"
          >
            <ToggleGroupItem value="year">Last Year</ToggleGroupItem>
            <ToggleGroupItem value="all">All Time</ToggleGroupItem>
            <ToggleGroupItem value="custom">
              {timeRange === "custom" && customRange.from && customRange.to
                ? `${format(customRange.from, "yyyy-MM-dd")}-${format(customRange.to, "yyyy-MM-dd")}`
                : "Custom"}
            </ToggleGroupItem>
          </ToggleGroup>
          {timeRange === "custom" && (
            <DateRangePicker value={customRange} onChange={setCustomRange} />
          )}
          {onResetToken && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResetToken}
              disabled={isLoading}
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
