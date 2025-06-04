import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Search, Star } from "lucide-react";

interface UserRepoSearchProps {
  onSearch: (username: string, timeRange: "year" | "all") => void;
  isLoading: boolean;
  onResetToken?: () => void;
}

const UserRepoSearch: React.FC<UserRepoSearchProps> = ({
  onSearch,
  isLoading,
  onResetToken,
}) => {
  const [username, setUsername] = useState<string>("");
  const [timeRange, setTimeRange] = useState<"year" | "all">("year");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onSearch(username.trim(), timeRange);
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
          <RadioGroup
            value={timeRange}
            onValueChange={(value) => setTimeRange(value as "year" | "all")}
            className="flex space-x-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="year" id="year" />
              <Label htmlFor="year">Last Year</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all">All Time</Label>
            </div>
          </RadioGroup>
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
