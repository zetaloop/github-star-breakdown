import React, { useState, useEffect, useCallback } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  fetchRestRateLimit,
  fetchGraphQLRateLimit,
  clearGitHubToken,
} from "@/services/github";
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
  const [restLimit, setRestLimit] = useState<number | null>(null);
  const [restUsed, setRestUsed] = useState<number | null>(null);
  const [restReset, setRestReset] = useState<number | null>(null);
  const [gqlLimit, setGqlLimit] = useState<number | null>(null);
  const [gqlUsed, setGqlUsed] = useState<number | null>(null);
  const [gqlReset, setGqlReset] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [gqlTimeLeft, setGqlTimeLeft] = useState<string>("");

  const fetchAndSetData = useCallback(async () => {
    setLoading(true);
    setRestReset(null);
    setGqlReset(null);
    const restInfo = await fetchRestRateLimit();
    const gqlInfo = await fetchGraphQLRateLimit();
    if (restInfo) {
      setRestLimit(restInfo.limit);
      setRestUsed(restInfo.used);
      setRestReset(restInfo.reset);
    }
    if (gqlInfo) {
      setGqlLimit(gqlInfo.limit);
      setGqlUsed(gqlInfo.used);
      setGqlReset(gqlInfo.reset);
    }
    setLoading(false);
  }, []);

  const handleOpenChange = useCallback(
    async (value: boolean) => {
      setOpen(value);
      if (value) {
        setRestLimit(null);
        setRestUsed(null);
        setGqlLimit(null);
        setGqlUsed(null);
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

  const restProgress =
    restLimit !== null && restUsed !== null ? (restUsed / restLimit) * 100 : 0;
  const gqlProgress =
    gqlLimit !== null && gqlUsed !== null ? (gqlUsed / gqlLimit) * 100 : 0;

  useEffect(() => {
    if (restReset === null) {
      setTimeLeft("");
    }

    if (!open || restReset === null) {
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date();
      const resetDate = new Date(restReset * 1000);
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
  }, [open, restReset, handleOpenChange]);

  useEffect(() => {
    if (gqlReset === null) {
      setGqlTimeLeft("");
    }

    if (!open || gqlReset === null) {
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date();
      const resetDate = new Date(gqlReset * 1000);
      const secondsRemaining = differenceInSeconds(resetDate, now);

      if (secondsRemaining <= 0) {
        setGqlTimeLeft("now");
        setTimeout(() => {
          handleOpenChange(true);
        }, 1000);
        return null;
      }

      if (secondsRemaining < 60) {
        setGqlTimeLeft(
          formatDistanceStrict(resetDate, now, {
            unit: "second",
            addSuffix: true,
          })
        );
      } else if (secondsRemaining < 3600) {
        setGqlTimeLeft(
          formatDistanceStrict(resetDate, now, {
            unit: "minute",
            addSuffix: true,
          })
        );
      } else {
        setGqlTimeLeft(
          formatDistanceStrict(resetDate, now, {
            unit: "hour",
            addSuffix: true,
          })
        );
      }
      return secondsRemaining;
    };

    const initialSeconds = calculateTimeLeft();
    if (initialSeconds === null) return;

    const id = setInterval(() => {
      const seconds = calculateTimeLeft();
      if (seconds === null) {
        clearInterval(id);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [open, gqlReset, handleOpenChange]);

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
              <Progress value={restLimit !== null && restUsed !== null ? restProgress : 0} />
              <p className="text-sm text-muted-foreground mt-1">
                REST: {restLimit !== null && restUsed !== null ? `${restUsed} / ${restLimit}` : "- / -"}
              </p>
              <p className="text-sm">
                {loading
                  ? "Checking..."
                  : restLimit === null || restUsed === null || restReset === null
                    ? "No token data"
                    : `Resets ${timeLeft}`}
              </p>
              <Progress value={gqlLimit !== null && gqlUsed !== null ? gqlProgress : 0} className="mt-2" />
              <p className="text-sm text-muted-foreground mt-1">
                GraphQL: {gqlLimit !== null && gqlUsed !== null ? `${gqlUsed} / ${gqlLimit}` : "- / -"}
              </p>
              <p className="text-sm">
                {loading
                  ? "Checking..."
                  : gqlLimit === null || gqlUsed === null || gqlReset === null
                    ? "No token data"
                    : `Resets ${gqlTimeLeft}`}
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
