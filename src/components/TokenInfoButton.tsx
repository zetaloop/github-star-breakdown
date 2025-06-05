import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { fetchRateLimit, clearGitHubToken } from "@/services/github";
import { formatDistanceStrict, differenceInSeconds } from "date-fns";
import { toast } from "sonner";

interface TokenInfoButtonProps {
  onReset?: () => void;
  disabled?: boolean;
}

const TokenInfoButton: React.FC<TokenInfoButtonProps> = ({
  onReset,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);
  const [used, setUsed] = useState<number | null>(null);
  const [reset, setReset] = useState<number | null>(null);

  const handleOpenChange = async (value: boolean) => {
    setOpen(value);
    if (value) {
      setLoading(true);
      const info = await fetchRateLimit();
      if (info) {
        setLimit(info.limit);
        setUsed(info.used);
        setReset(info.reset);
      }
      setLoading(false);
    }
  };

  const handleReset = () => {
    clearGitHubToken();
    toast.success("GitHub token cleared");
    setOpen(false);
    if (onReset) onReset();
  };

  const progress = limit !== null && used !== null ? (used / limit) * 100 : 0;

  const getFormattedResetTime = (resetTimestamp: number): string => {
    const now = new Date();
    const resetDate = new Date(resetTimestamp * 1000);
    const secondsRemaining = differenceInSeconds(resetDate, now);

    if (secondsRemaining <= 0) {
      return "now";
    }
    if (secondsRemaining < 60) {
      return formatDistanceStrict(resetDate, now, {
        unit: "second",
        addSuffix: true,
      });
    }
    if (secondsRemaining < 3600) {
      return formatDistanceStrict(resetDate, now, {
        unit: "minute",
        addSuffix: true,
      });
    }
    return formatDistanceStrict(resetDate, now, {
      unit: "hour",
      addSuffix: true,
    });
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="link" className="text-foreground">
          Token Info
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">API Usage</p>
            {loading ? (
              <p className="text-sm text-muted-foreground mt-1">Checking...</p>
            ) : limit === null || used === null || reset === null ? (
              <p className="text-sm">No token data</p>
            ) : (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground mt-1">
                  {used} / {limit} used
                </p>
                <p className="text-sm">
                  Limit resets {getFormattedResetTime(reset)}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleReset}
            disabled={disabled}
          >
            Clear Token
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TokenInfoButton;
