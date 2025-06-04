# Project Guidelines for github-star-growth-mapper

This repository contains a React application built with Vite and Bun. The app visualizes the star history of a GitHub user's repositories. Key directories:

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
Use Bun for package management:
```bash
bun install
```

## Useful Scripts
Run scripts via Bun:
```bash
bun run dev      # Start development server
bun run build    # Build for production
bun run lint     # Run ESLint (bun install eslint first)
bun run preview  # Preview production build
```

## Development Notes
- Code formatting follows the settings in `.prettierrc.json`.
- ESLint is configured in `eslint.config.js`. When modifying TypeScript/React code, run `bun run lint` before committing.
- Main entry is `src/main.tsx`; React app is rendered in `index.html` inside the `#root` element.
- GitHub API helpers in `src/services/github.ts` handle token management, fetching repositories, fetching stargazers with concurrency control, and processing star history.
- `GitHubStarTracker` orchestrates user input, loading stages, and displays charts and tables summarizing repository star growth.

## Contribution Guidelines
- Components under `src/components/ui` come from the shadcn-ui library. Avoid editing them unless upgrading the library.
- When creating a pull request, use an English branch name. Commit messages should be written in Chinese and may use prefixes like `feat:` or `fix:` similar to existing commits.

