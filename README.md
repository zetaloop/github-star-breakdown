# GitHub Star Growth Mapper

A browser-only application for exploring how each repository contributes to a GitHub user's stars. Built with React, Vite, Recharts and plain CSS.

## Explore

- Analyse a GitHub user's public repositories over the last year, all time or a custom date range.
- Switch between cumulative contributions and daily star counts.
- Select repositories in the searchable, sortable list, or isolate a repository from the chart legend.
- Compare large collections with smaller contributions grouped together, and expand the complete chart when needed.
- Follow repository progress and pause, resume, retry or cancel an analysis.
- Manage the GitHub token and inspect API quota in settings.
- Choose light, dark or system appearance.

## Usage

Enter a GitHub personal access token to connect. The token is stored in the current browser and sent to GitHub's API. Public repository history uses public metadata access.

Enter a username, select **最近一年**, **全部历史** or **自定义日期**, and choose **分析星标**. The result heading identifies the range used for that analysis. Repository checkboxes control the chart; the eye button and legend isolate a contribution. **全部** restores all repositories.

The repository list shows both selected-range counts and current star totals. Repositories whose history has not arrived are marked **未读取**. Failed requests pause the analysis and show GitHub's error; use **重试** after resolving the error, or update the token in **GitHub 设置**.

## Data

History comes from GitHub's [repository star history API](https://docs.github.com/en/rest/activity/starring#get-repository-star-history), which returns 30 weeks per page with daily counts. Requests cover the selected date range, with up to six repositories processed concurrently.

Counts represent stars that are still active, grouped by their original creation dates. Removing a star changes its original date's count. Calendar days follow GitHub's aggregation weeks. The chart fills inactive dates with zero and accumulates counts from the selected range's starting point.

## Development

Use pnpm and a system installation of Biome.

```sh
pnpm install
pnpm dev
pnpm format
pnpm check
pnpm build
```

`pnpm check` runs Biome and TypeScript. `pnpm build` type-checks and builds the static site in `dist/`; `pnpm preview` serves the production build locally.

## Structure

- `src/components` contains the search controls, account settings, chart and repository list.
- `src/hooks/useStarAnalysis.ts` owns analysis state, pause, retry and cancellation.
- `src/services/githubApi.ts` handles authenticated REST requests and quota information.
- `src/services/github.ts` fetches repository lists and paginated history.
- `src/services/history.ts` maps calendar ranges to pages and expands weekly counts.
- `src/lib/chart.ts` prepares repository groups and chart series.
- `src/index.css` defines shared appearance, responsive layouts and motion.
