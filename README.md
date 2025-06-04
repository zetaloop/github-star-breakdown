# GitHub Star Growth Mapper

A React application that visualizes how each repository contributes to a GitHub user's star count over time. The project uses Vite and Bun and relies on the GitHub API to fetch repository and stargazer data.

## Features

- **GitHub authentication** – enter a personal access token to increase API limits.
- **User search** – analyze any public GitHub username.
- **Star history** – stacked area chart shows cumulative star growth.
- **Repository table** – sort repositories by star count or yearly increment.
- **Last year or all time** – focus on recent growth or complete history.
- **Progress indicator** – multi‑stage loader tracks API requests and remaining work.

## Installation

Install dependencies with Bun and start the development server:

```bash
bun install
bun run dev
```

Other useful commands:

```bash
bun run build    # Build for production
bun run preview  # Preview the production build
bun run lint     # Run ESLint
```

## Usage

1. Start the app and provide your GitHub personal access token when prompted (requires `repo` and `read:user` scopes).
2. Enter a GitHub username and choose the time range (last year or all time).
3. View the chart and table to explore how each repository contributes to the user's stars.

## Project Structure

- `src/components` – main React components including `GitHubStarTracker`, `RepoStarChart`, `RepoStatsTable`, and helpers.
- `src/services/github.ts` – functions for fetching repositories, stargazers and processing star history.
- `src/pages` – routable pages (`Index.tsx`, `NotFound.tsx`).
- `src/hooks` and `src/types` – reusable hooks and TypeScript definitions.
- `src/components/ui` – shadcn‑ui components (do not edit directly).

Configuration files like `vite.config.ts` and `tailwind.config.ts` set up the Vite build and Tailwind CSS.

## Contributing

Run `bun run lint` before submitting code changes. Components under `src/components/ui` originate from shadcn‑ui and generally should not be modified.

---

This README replaces the previous template and describes the actual code in this repository.
