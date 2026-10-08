# GitHub Star Growth Mapper

A React + Vite application that analyses how each repository contributes to a GitHub user's stars. It fetches data via the GitHub API and visualises growth with Recharts and Tailwind CSS. Dependencies are managed with pnpm.

## Features

- **GitHub authentication** – validate and store a personal access token to raise API limits.
- **Token info popover** – view remaining requests and clear the token when needed.
- **User search** – analyse any public GitHub username.
- **Custom date ranges** – inspect the last year, all time or a calendar‑based range.
- **Interactive star chart** – stacked area chart with animated tooltips showing per‑repo totals.
- **Repository table** – sorted by star change or total stars with links to each repo.
- **Progress indicator** – repository progress, request counts, pause, resume and cancellation.
- **Theme toggle** – switch between light, dark or system theme.

Star history comes from GitHub's [repository star history API](https://docs.github.com/en/rest/activity/starring#get-repository-star-history). It returns 30 weeks per page with daily counts. Requests cover the selected date range, with up to six repositories processed concurrently.

The chart groups stars that are still active by their original creation dates. Removing a star changes the count on its original date. Calendar days follow GitHub's aggregation weeks.

## Installation

Install dependencies with pnpm and start the development server:

```bash
pnpm install
pnpm dev
```

Additional commands:

```bash
pnpm build    # Build for production
pnpm preview  # Preview the production build
pnpm check    # Run Biome and TypeScript
pnpm format   # Format code and apply lint fixes
```

## Usage

1. Launch the app and enter your GitHub personal access token. Public repository history requires public metadata access.
2. Type a GitHub username and pick **Last Year**, **All Time** or **Custom** dates.
3. Follow the progress as repositories and their star history are fetched. A failed request pauses the analysis; resume to retry it.
4. Explore the stacked chart and stats table to see how repositories contributed to the star count.
5. Use **Token Info** to check remaining API quota or clear the token.

## Project Structure

- `src/components` – UI components such as `GitHubStarTracker`, `RepoStarChart`, `RepoStatsTable`, `LoadingProgress`, `ThemeToggle` and helpers.
- `src/services/github.ts` – repository pagination and concurrent history fetching.
- `src/services/githubApi.ts` – authenticated REST requests, token management and quota information.
- `src/services/history.ts` – calendar dates, page selection and daily star counts.
- `src/hooks/useStarAnalysis.ts` – analysis state, pause, retry and cancellation.
- `src/pages` – routable pages (`Index.tsx`, `NotFound.tsx`).
- `src/hooks` and `src/types` – custom hooks and TypeScript definitions.
- `src/components/ui` – shadcn‑ui building blocks (avoid editing directly).

Configuration files like `vite.config.ts` and `tailwind.config.ts` define the build and Tailwind setup.

## Contributing

Run `pnpm format`, `pnpm check` and `pnpm build` before submitting changes. Biome is provided by the system PATH. Components in `src/components/ui` originate from shadcn-ui.

---

This README documents the current codebase and its features.
