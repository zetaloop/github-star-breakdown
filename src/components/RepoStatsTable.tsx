
import React from 'react';
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { GitHubRepo } from '@/types/github';
import { Star } from 'lucide-react';

interface RepoStatsTableProps {
  repos: GitHubRepo[];
}

const RepoStatsTable: React.FC<RepoStatsTableProps> = ({ repos }) => {
  // Sort repositories by star count in descending order
  const sortedRepos = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count);
  
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
                <TableCell>{repo.language || '—'}</TableCell>
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
