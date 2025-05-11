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
}

const RepoStatsTable: React.FC<RepoStatsTableProps> = ({ repos }) => {
  // Sort repositories: 1. by star count (desc), 2. by creation date (newest first), 3. by name (alphabetical)
  const sortedRepos = [...repos].sort((a, b) => {
    // Primary sort: by stars (descending)
    if (b.stargazers_count !== a.stargazers_count) {
      return b.stargazers_count - a.stargazers_count;
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

  return (
    <Card className="w-full overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Repository</TableHead>
            <TableHead>Language</TableHead>
            <TableHead className="text-right">Stars</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRepos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-4">
                No repositories found.
              </TableCell>
            </TableRow>
          ) : (
            sortedRepos.map((repo) => (
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
                <TableCell className="text-right">
                  <span className="flex items-center justify-end gap-1">
                    <Star className="h-4 w-4 text-amber-500" />
                    {repo.stargazers_count.toLocaleString()}
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
