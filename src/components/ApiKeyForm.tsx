import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import {
  getGitHubToken,
  setGitHubToken,
  verifyGitHubToken,
} from "@/services/github";
import { toast } from "sonner";

interface ApiKeyFormProps {
  onTokenValidated: () => void;
}

const ApiKeyForm: React.FC<ApiKeyFormProps> = ({ onTokenValidated }) => {
  const [token, setToken] = useState<string>("");
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const validateAndSetToken = async () => {
    if (!token.trim()) {
      setError("GitHub token is required");
      return;
    }

    setIsValidating(true);
    setError("");

    try {
      const isValid = await verifyGitHubToken(token);

      if (isValid) {
        setGitHubToken(token);
        toast.success("GitHub token has been set successfully");
        onTokenValidated();
      } else {
        setError("Invalid GitHub token. Please check and try again.");
      }
    } catch (error) {
      setError("Error validating token. Please try again.");
      console.error(error);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>GitHub API Authentication</CardTitle>
        <CardDescription>
          Enter your GitHub personal access token to access the GitHub API. The
          token needs to have 'repo' and 'read:user' scopes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="github-token">GitHub Personal Access Token</Label>
            <Input
              id="github-token"
              type="text"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
            />
            <p className="text-sm text-muted-foreground">
              <a
                href="https://github.com/settings/tokens/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Create a new token
              </a>
              , if you don't have one.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={validateAndSetToken}
          disabled={isValidating}
          className="w-full bg-github-blue hover:bg-github-darkBlue text-destructive-foreground"
        >
          {isValidating ? "Validating..." : "Set Token"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ApiKeyForm;
