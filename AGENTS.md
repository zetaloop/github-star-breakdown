# github-star-growth-mapper

This is a browser-only React application for analysing the star contributions of a GitHub user's repositories. GitHub requests use a personal access token stored in localStorage.

## Development

Use the pnpm version declared in `package.json`.

```sh
pnpm install
pnpm dev
pnpm lint --fix
pnpm build
```

Commit messages use Chinese Conventional Commits. Changes should follow the surrounding source style. Components under `src/components/ui` originate from shadcn-ui.

## Structure

- `src/components/GitHubStarTracker.tsx` coordinates the search form and analysis views.
- `src/hooks/useStarAnalysis.ts` owns analysis state, pause/resume promises and AbortControllers.
- `src/services/githubApi.ts` handles authenticated REST requests and errors.
- `src/services/github.ts` fetches repository lists and history with bounded concurrency.
- `src/services/history.ts` maps calendar ranges to history pages and expands weekly data.
- `src/types/github.ts` contains the data shared by the services and views.

## Star history

`GET /repos/{owner}/{repo}/stargazers/history` returns weeks in reverse chronological order, with 30 weeks per page and seven daily counts starting on Sunday. Use the response's pagination links to determine available pages.

Counts represent currently active stars grouped by their original creation dates. GitHub's week boundaries may use an aggregation timezone different from UTC, so a Sunday bucket can begin on Saturday in UTC.

An analysis processes at most six repositories concurrently. Pause stops new requests; active requests can finish. Request errors pause the analysis for manual retry. Cancellation aborts requests and releases the pause promise.
