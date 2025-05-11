
import { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RepoStarHistoryItem } from '@/types/github';

interface RepoStarChartProps {
  starHistory: RepoStarHistoryItem[];
}

// Generate a pseudo-random color based on repository name for consistent coloring
const getRepoColor = (repoName: string): string => {
  let hash = 0;
  for (let i = 0; i < repoName.length; i++) {
    hash = repoName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use the hash to generate a hue between 0 and 360
  // Limit saturation and lightness for better visibility
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 50%)`;
};

const RepoStarChart: React.FC<RepoStarChartProps> = ({ starHistory }) => {
  // Process data to create a continuous stacked area chart
  const chartData = useMemo(() => {
    if (!starHistory.length) return [];
    
    // Get unique dates and repos
    const dateSet = new Set<string>();
    const repoSet = new Set<string>();
    
    starHistory.forEach(item => {
      dateSet.add(item.date);
      repoSet.add(item.repoName);
    });
    
    const dates = Array.from(dateSet).sort();
    const repos = Array.from(repoSet);
    
    // Initialize data structure with zero values
    const stackedData = dates.map(date => {
      const dataPoint: Record<string, any> = { date };
      repos.forEach(repo => {
        dataPoint[repo] = 0;
      });
      return dataPoint;
    });
    
    // Create a map for quick lookup
    const dateMap = new Map<string, number>();
    dates.forEach((date, index) => {
      dateMap.set(date, index);
    });
    
    // Fill in actual star data
    starHistory.forEach(item => {
      const index = dateMap.get(item.date);
      if (index !== undefined) {
        stackedData[index][item.repoName] = item.stars;
      }
    });
    
    // Make the data cumulative for stacked area chart
    // For each repo, stars should accumulate over time
    repos.forEach(repo => {
      let cumulativeStars = 0;
      for (let i = 0; i < stackedData.length; i++) {
        cumulativeStars += stackedData[i][repo];
        stackedData[i][repo] = cumulativeStars;
      }
    });
    
    return stackedData;
  }, [starHistory]);

  // Extract unique repository names for rendering areas
  const repoNames = useMemo(() => {
    const repos = new Set<string>();
    starHistory.forEach(item => {
      // Only include repos that have stars
      if (item.stars > 0) {
        repos.add(item.repoName);
      }
    });
    return Array.from(repos);
  }, [starHistory]);

  if (starHistory.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Repository Star Growth</CardTitle>
          <CardDescription>No star data available for the selected time range.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Repository Star Growth</CardTitle>
        <CardDescription>Cumulative star contribution of each repository over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => {
                  const d = new Date(date);
                  return `${d.getMonth() + 1}/${d.getFullYear() % 100}`;
                }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value, name) => [`${value} stars`, name]}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return date.toLocaleDateString();
                }}
              />
              <Legend />
              {repoNames.map(repo => (
                <Area
                  key={repo}
                  type="monotone"
                  dataKey={repo}
                  name={repo}
                  stackId="1"
                  stroke={getRepoColor(repo)}
                  fill={getRepoColor(repo)}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default RepoStarChart;
