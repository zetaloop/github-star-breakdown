# GitHub Star Growth Mapper

A React + Vite application that analyses how each repository contributes to a GitHub user's stars. It fetches data via the GitHub API and visualises growth with Recharts and Tailwind CSS. Dependencies are managed with pnpm.

## Features

- **GitHub authentication** – validate and store a personal access token to raise API limits.
- **Token info popover** – view remaining requests and clear the token when needed.
- **User search** – analyse any public GitHub username.
- **Custom date ranges** – inspect the last year, all time or a calendar‑based range.
- **Interactive star chart** – stacked area chart with animated tooltips showing per‑repo totals.
- **Repository table** – sorted by star change or total stars with links to each repo.
- **Progress indicator** – multi‑stage loader with real‑time log of API requests.
- **Theme toggle** – switch between light, dark or system theme.

Behind the scenes a concurrency pool and binary search strategy speed up fetching stargazer pages while handling rate limits gracefully.

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
pnpm lint     # Run ESLint
```

## Usage

1. Launch the app and enter your GitHub personal access token (requires `repo` and `read:user`).
2. Type a GitHub username and pick **Last Year**, **All Time** or **Custom** dates.
3. Follow the progress log as repositories and stargazers are fetched.
4. Explore the stacked chart and stats table to see how repositories contributed to the star count.
5. Use **Token Info** to check remaining API quota or clear the token.

## Project Structure

- `src/components` – UI components such as `GitHubStarTracker`, `RepoStarChart`, `RepoStatsTable`, `LoadingProgress`, `ThemeToggle` and helpers.
- `src/services/github.ts` – token management, concurrency utilities and data processing.
- `src/pages` – routable pages (`Index.tsx`, `NotFound.tsx`).
- `src/hooks` and `src/types` – custom hooks and TypeScript definitions.
- `src/components/ui` – shadcn‑ui building blocks (avoid editing directly).

Configuration files like `vite.config.ts` and `tailwind.config.ts` define the build and Tailwind setup.

## Contributing

Run `pnpm lint` before submitting changes. Components in `src/components/ui` originate from shadcn‑ui and generally should not be modified.

---

This README documents the current codebase and its features.
