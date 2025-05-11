
import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
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
  // Process data to create a cumulative time series by date for each repository
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
    
    // Initialize cumulative data
    const cumulativeData = dates.map(date => {
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
    
    // Fill in the actual stars data and make it cumulative
    starHistory.forEach(item => {
      const dateIndex = dateMap.get(item.date) as number;
      
      // Add stars for the current date
      cumulativeData[dateIndex][item.repoName] = item.stars;
      
      // Update all future dates to maintain the cumulative count
      for (let i = dateIndex + 1; i < dates.length; i++) {
        cumulativeData[i][item.repoName] += cumulativeData[dateIndex][item.repoName];
      }
    });
    
    return cumulativeData;
  }, [starHistory]);

  // Extract unique repository names for rendering lines
  const repoNames = useMemo(() => {
    const repos = new Set<string>();
    starHistory.forEach(item => repos.add(item.repoName));
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
        <CardDescription>Star contribution of each repository over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
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
                <Line
                  key={repo}
                  type="monotone"
                  dataKey={repo}
                  name={repo}
                  stroke={getRepoColor(repo)}
                  activeDot={{ r: 6 }}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default RepoStarChart;
