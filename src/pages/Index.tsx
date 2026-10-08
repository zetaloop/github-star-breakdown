import GitHubStarTracker from "@/components/GitHubStarTracker";
import { GitHubIcon } from "@/components/icons/GitHubIcon";
import RepoButton from "@/components/RepoButton";
import ThemeToggle from "@/components/ThemeToggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const Index = () => {
  return (
    <div className="container max-w-7xl py-6 sm:py-10 space-y-8">
      <div className="flex justify-end gap-2">
        <ThemeToggle />
        <RepoButton />
      </div>
      <header className="text-center">
        <div className="flex justify-center mb-2">
          <GitHubIcon className="h-16 w-16" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          GitHub User Star Tracker
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Analyze how each repository contributes to a GitHub user's total stars
          over time
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Repository Star Analysis</CardTitle>
          <CardDescription>
            Enter a GitHub username to view their repositories and analyze star
            growth contribution over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GitHubStarTracker />
        </CardContent>
      </Card>

      <footer className="text-center text-sm text-muted-foreground py-4">
        <p>Have fun uwu</p>
      </footer>
    </div>
  );
};

export default Index;
