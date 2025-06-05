import React, { useState, useEffect, useCallback } from "react";
import { RefreshCcw } from "lucide-react";
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
  const [timeLeft, setTimeLeft] = useState<string>("");

  const fetchAndSetData = useCallback(async () => {
    setLoading(true);
    setReset(null);
    const info = await fetchRateLimit();
    if (info) {
      setLimit(info.limit);
      setUsed(info.used);
      setReset(info.reset);
    }
    setLoading(false);
  }, []);

  const handleOpenChange = useCallback(
    async (value: boolean) => {
      setOpen(value);
      if (value) {
        setLimit(null);
        setUsed(null);
        await fetchAndSetData();
      }
    },
    [fetchAndSetData]
  );

  const handleReset = () => {
    clearGitHubToken();
    toast.success("GitHub token cleared");
    setOpen(false);
    if (onReset) onReset();
  };

  const progress = limit !== null && used !== null ? (used / limit) * 100 : 0;

  useEffect(() => {
    if (!open || reset === null) {
      setTimeLeft("");
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date();
      const resetDate = new Date(reset * 1000);
      const secondsRemaining = differenceInSeconds(resetDate, now);

      if (secondsRemaining <= 0) {
        setTimeLeft("now");
        // Automatically refresh data when time is up
        setTimeout(() => {
          handleOpenChange(true);
        }, 1000);
        return null; // Indicate to clear interval
      }
      if (secondsRemaining < 60) {
        setTimeLeft(
          formatDistanceStrict(resetDate, now, {
            unit: "second",
            addSuffix: true,
          })
        );
      } else if (secondsRemaining < 3600) {
        setTimeLeft(
          formatDistanceStrict(resetDate, now, {
            unit: "minute",
            addSuffix: true,
          })
        );
      } else {
        setTimeLeft(
          formatDistanceStrict(resetDate, now, {
            unit: "hour",
            addSuffix: true,
          })
        );
      }
      return secondsRemaining;
    };

    // Initial calculation
    const initialSeconds = calculateTimeLeft();
    if (initialSeconds === null) return; // Already refreshed

    const intervalId = setInterval(() => {
      const seconds = calculateTimeLeft();
      if (seconds === null) {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [open, reset, handleOpenChange]);

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
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">API Usage</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={fetchAndSetData}
                disabled={loading}
              >
                <RefreshCcw className="h-4 w-4" />
                <span className="sr-only">Refresh usage</span>
              </Button>
            </div>
            <div className="space-y-2">
              <Progress
                value={limit !== null && used !== null ? progress : 0}
              />
              <p className="text-sm text-muted-foreground mt-1">
                {limit !== null && used !== null
                  ? `${used} / ${limit}`
                  : "? / ?"}{" "}
                used
              </p>
              <p className="text-sm">
                {loading
                  ? "Checking..."
                  : limit === null || used === null || reset === null
                    ? "No token data"
                    : `Limit resets ${timeLeft}`}
              </p>
            </div>
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
