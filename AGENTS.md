# LLM Agent Guidelines for github-star-growth-mapper

> Note: This document is intended as a guide for LLM based AI programming agents. It provides essential context about the project structure, development practices, and key architectural decisions to help agents understand and interact with the codebase effectively.

This repository contains a React application built with Vite and pnpm. The app visualizes the star history of a GitHub user's repositories. Key directories:

- `src/`
  - `components/` – React components including `GitHubStarTracker` (main component), `RepoStarChart`, `RepoStatsTable`, UI primitives under `ui/`, and other helpers.
    - `ui/` – prebuilt shadcn-ui components. These come from the library and usually shouldn't be modified directly.
  - `pages/` – Routable pages (`Index.tsx`, `NotFound.tsx`).
  - `services/` – Logic for interacting with the GitHub API (fetching repos and stargazers, concurrency utilities).
  - `hooks/` – Custom React hooks.
  - `types/` – TypeScript interfaces used throughout.
- `public/` – Static assets and HTML template.
- `vite.config.ts` – Vite configuration with alias `@` pointing to `src`.
- `tailwind.config.ts`, `postcss.config.js` – Tailwind CSS setup.

## Installing Dependencies
Use pnpm for package management:
```bash
pnpm install
```

## Useful Scripts
Run scripts via pnpm:
```bash
pnpm dev        # Start development server
pnpm build      # Build for production
pnpm lint --fix # Run ESLint (No output if everything is fine)
pnpm preview    # Preview production build
```

## Development Notes
- Code formatting follows the settings in `.prettierrc.json`.
- ESLint is configured in `eslint.config.js`. When modifying TypeScript/React code, run `pnpm lint` before committing.
- Main entry is `src/main.tsx`; React app is rendered in `index.html` inside the `#root` element.
- The main application logic is encapsulated within the `GitHubStarTracker` component. It manages state for the user input, loading process, API data, and error handling.
- API interactions are split across services:
  - `src/services/github.ts`: Handles user repository fetching, token management (`get/set/verify`), rate limit checking, and final data processing (`processRepoStarHistory`).
  - `src/services/githubHeavy.ts`: Contains the logic for fetching individual stargazer pages, designed to be used in a concurrent environment.
  - `src/services/githubApi.ts`: Shared REST and GraphQL helpers. `fetchReposREST` and `fetchStargazersREST` are used by the services above, while `fetchReposGraphQL` and `fetchStargazersGraphQL` expose equivalent GraphQL functionality (numeric repository IDs and `oldest`/`newest` timestamps).
  - `src/services/concurrency.ts`: Provides a `ConcurrencyPool` class to manage and limit simultaneous API requests, preventing rate limit errors and browser overload.

### Advanced Stargazer Fetching Strategy

To efficiently analyze repositories with thousands of stars without fetching every single stargazer, the application employs a sophisticated, multi-stage fetching strategy orchestrated by `GitHubStarTracker`:

1.  **Stage 0: Fetch Repositories**: It first fetches a list of all user repositories with stars, using a concurrent fetch for paginated results.
2.  **Stage 1: Deep Scan Stargazers**: Instead of fetching all stargazer pages for every repo, it uses an intelligent, adaptive approach:
    -   **Concurrency Pool**: All stargazer page requests are managed by a `ConcurrencyPool` (set to a limit of 50) to control the flow of API calls.
    -   **Initial Sampling**: For each repo, it doesn't start from page 1. Instead, it begins by fetching a few sample pages from different points in the star history (e.g., at 25%, 50%, 75% of the pages). This provides a quick overview of the star date distribution.
    -   **Time-Based Pruning**: The data from these initial samples is used to make smart decisions. If a fetched page's star dates are entirely outside the user's selected time range (e.g., all stars on a page are too new or too old), the algorithm can infer that entire sections of pages don't need to be fetched, and skips them.
    -   **Same-Day Prediction**: If the newest star on one fetched page (e.g., page 10) and the oldest star on the next fetched page (e.g., page 20) fall on the same calendar day, the algorithm assumes all pages in between (11-19) also contain stars from that day and marks them as "predicted" without fetching them. This dramatically reduces API calls for repos with rapid growth spurts.
    -   **Adaptive Queue**: The process is managed by a dynamic task queue. Based on the results of each fetched page, new tasks are added to the queue to explore promising page ranges, while other ranges are pruned or predicted.

This strategy allows the application to build a sufficiently accurate star history for the chart and table while minimizing API usage and speeding up the analysis, especially for large repositories and long time ranges.

## Contribution Guidelines
- Components under `src/components/ui` come from the shadcn-ui library. Avoid editing them unless upgrading the library.
- When creating a pull request, use an English branch name. Commit messages should be written in Chinese and may use prefixes like `feat:` or `fix:` similar to existing commits.
- Before submitting a PR, ensure your code passes ESLint checks and is formatted with Prettier, successfully passes `pnpm lint`, and builds without errors using `pnpm build`.
