import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { fetchRateLimit, clearGitHubToken } from "@/services/github";
import { formatDistanceToNow } from "date-fns";
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
  const [remaining, setRemaining] = useState<number | null>(null);
  const [reset, setReset] = useState<number | null>(null);

  const handleOpenChange = async (value: boolean) => {
    setOpen(value);
    if (value) {
      setLoading(true);
      const info = await fetchRateLimit();
      if (info) {
        setLimit(info.limit);
        setRemaining(info.remaining);
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

  const progress =
    limit !== null && remaining !== null
      ? ((limit - remaining) / limit) * 100
      : 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="link"
          disabled={disabled}
          className="text-foreground"
        >
          Token Info
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        {loading ? (
          <p className="text-sm">Loading...</p>
        ) : limit === null || remaining === null || reset === null ? (
          <p className="text-sm">No token data</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">API Usage</p>
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground mt-1">
                {remaining} / {limit} remaining
              </p>
            </div>
            <p className="text-sm">
              Limit resets{" "}
              {formatDistanceToNow(new Date(reset * 1000), { addSuffix: true })}
            </p>
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleReset}
            >
              Clear Token
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default TokenInfoButton;
