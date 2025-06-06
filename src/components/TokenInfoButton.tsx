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
  const [restLimit, setRestLimit] = useState<number | null>(null);
  const [restUsed, setRestUsed] = useState<number | null>(null);
  const [restReset, setRestReset] = useState<number | null>(null);
  const [restTimeLeft, setRestTimeLeft] = useState<string>("");

  const [gqlLimit, setGqlLimit] = useState<number | null>(null);
  const [gqlUsed, setGqlUsed] = useState<number | null>(null);
  const [gqlReset, setGqlReset] = useState<number | null>(null);
  const [gqlTimeLeft, setGqlTimeLeft] = useState<string>("");

  const fetchAndSetData = useCallback(async () => {
    setLoading(true);
    setRestReset(null);
    setGqlReset(null);
    const info = await fetchRateLimit();
    if (info) {
      setRestLimit(info.core.limit);
      setRestUsed(info.core.used);
      setRestReset(info.core.reset);
      setGqlLimit(info.graphql.limit);
      setGqlUsed(info.graphql.used);
      setGqlReset(info.graphql.reset);
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

  const getBarColor = (progress: number) => {
    if (progress >= 100) return "bg-red-500";
    if (progress >= 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  const setupTimeLeft = (
    resetValue: number | null,
    setValue: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (resetValue === null) {
      setValue("");
      return null;
    }
    const now = new Date();
    const resetDate = new Date(resetValue * 1000);
    const secondsRemaining = differenceInSeconds(resetDate, now);
    if (secondsRemaining <= 0) {
      setValue("now");
      setTimeout(() => {
        handleOpenChange(true);
      }, 1000);
      return null;
    }
    if (secondsRemaining < 120) {
      setValue(
        formatDistanceStrict(resetDate, now, {
          unit: "second",
          addSuffix: true,
        })
      );
    } else if (secondsRemaining < 3600) {
      setValue(
        formatDistanceStrict(resetDate, now, {
          unit: "minute",
          addSuffix: true,
        })
      );
    } else {
      setValue(
        formatDistanceStrict(resetDate, now, {
          unit: "hour",
          addSuffix: true,
        })
      );
    }
    return secondsRemaining;
  };

  useEffect(() => {
    if (!open) return;

    const first = setupTimeLeft(restReset, setRestTimeLeft);
    if (first === null) return;
    const interval = setInterval(() => {
      const seconds = setupTimeLeft(restReset, setRestTimeLeft);
      if (seconds === null) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [open, restReset]);

  useEffect(() => {
    if (!open) return;

    const first = setupTimeLeft(gqlReset, setGqlTimeLeft);
    if (first === null) return;
    const interval = setInterval(() => {
      const seconds = setupTimeLeft(gqlReset, setGqlTimeLeft);
      if (seconds === null) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [open, gqlReset]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="link" className="text-foreground">
          Token Info
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem]">
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">API Usage</p>
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
            <div className="space-y-1.5">
              <p className="text-sm font-medium">REST</p>
              <Progress
                value={
                  restLimit !== null && restUsed !== null ? restProgress : 0
                }
                indicatorColor={getBarColor(restProgress)}
                backgroundColor="bg-secondary"
              />
              <p className="text-sm text-muted-foreground flex justify-between">
                <span>
                  {loading
                    ? "- / - reqs"
                    : restLimit !== null &&
                        restUsed !== null &&
                        restReset !== null
                      ? `${restUsed} / ${restLimit} reqs`
                      : "- / - reqs"}
                </span>
                <span>
                  {loading
                    ? "Checking"
                    : restLimit !== null &&
                        restUsed !== null &&
                        restReset !== null
                      ? `Resets ${restTimeLeft}`
                      : "No data"}
                </span>
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">GraphQL</p>
              <Progress
                value={gqlLimit !== null && gqlUsed !== null ? gqlProgress : 0}
                indicatorColor={getBarColor(gqlProgress)}
                backgroundColor="bg-secondary"
              />
              <p className="text-sm text-muted-foreground flex justify-between">
                <span>
                  {loading
                    ? "- / - pts"
                    : gqlLimit !== null && gqlUsed !== null && gqlReset !== null
                      ? `${gqlUsed} / ${gqlLimit} pts`
                      : "- / - pts"}
                </span>{" "}
                <span>
                  {loading
                    ? "Checking"
                    : gqlLimit !== null && gqlUsed !== null && gqlReset !== null
                      ? `Resets ${gqlTimeLeft}`
                      : "No data"}
                </span>
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
