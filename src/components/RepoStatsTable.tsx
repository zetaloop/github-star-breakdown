import React from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { GitHubRepo } from "@/types/github";
import { Star } from "lucide-react";

interface RepoStatsTableProps {
  repos: GitHubRepo[];
  timeRange: "year" | "all";
  yearlyIncrements?: Map<string, number>;
}

const RepoStatsTable: React.FC<RepoStatsTableProps> = ({
  repos,
  timeRange,
  yearlyIncrements,
}) => {
  const sortedRepos = [...repos].sort((a, b) => {
    if (timeRange === "year" && yearlyIncrements) {
      const incrementA = yearlyIncrements.get(a.name) || 0;
      const incrementB = yearlyIncrements.get(b.name) || 0;
      if (incrementB !== incrementA) {
        return incrementB - incrementA; // Sort by yearly increment (desc)
      }
    } else {
      // Primary sort: by total stars (descending)
      if (b.stargazers_count !== a.stargazers_count) {
        return b.stargazers_count - a.stargazers_count;
      }
    }

    // Secondary sort: by creation date (newest first)
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    if (dateB.getTime() !== dateA.getTime()) {
      return dateB.getTime() - dateA.getTime();
    }

    // Tertiary sort: alphabetically by name
    return a.name.localeCompare(b.name);
  });

  const reposToDisplay =
    timeRange === "year" && yearlyIncrements
      ? sortedRepos.filter(
          (repo) => (yearlyIncrements.get(repo.name) || 0) !== 0
        )
      : sortedRepos;

  const getStarDisplay = (repo: GitHubRepo) => {
    if (timeRange === "year" && yearlyIncrements) {
      const increment = yearlyIncrements.get(repo.name) || 0;
      // Already filtered out 0, so increment here will be > 0 or < 0
      if (increment > 0) {
        return `+${increment.toLocaleString()}`;
      }
      return increment.toLocaleString(); // Handles negative (though unlikely for stars)
    }
    return repo.stargazers_count.toLocaleString();
  };

  return (
    <Card className="w-full overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Repository</TableHead>
            <TableHead>Language</TableHead>
            <TableHead className="text-left">
              {timeRange === "year" ? "Stars (Last Year)" : "Stars (Total)"}
            </TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reposToDisplay.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-4">
                {timeRange === "year"
                  ? "No repositories with star changes in the last year."
                  : "No repositories found."}
              </TableCell>
            </TableRow>
          ) : (
            reposToDisplay.map((repo) => (
              <TableRow key={repo.id}>
                <TableCell className="font-medium">
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-github-blue"
                  >
                    {repo.name}
                  </a>
                  {repo.description && (
                    <p className="text-xs text-muted-foreground truncate max-w-xs">
                      {repo.description}
                    </p>
                  )}
                </TableCell>
                <TableCell>{repo.language || "—"}</TableCell>
                <TableCell className="text-left">
                  <span className="flex items-center justify-start gap-1">
                    <Star className="h-4 w-4 text-amber-500" />
                    {getStarDisplay(repo)}
                  </span>
                </TableCell>
                <TableCell>
                  {new Date(repo.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
};

export default RepoStatsTable;
