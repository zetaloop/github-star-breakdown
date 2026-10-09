# [GitHub Star Breakdown](https://zetaloop.github.io/github-star-breakdown/)

Visualise how a GitHub user's repositories contribute to their total stars.

## Usage

Enter a GitHub personal access token, a username and a date range. Select repositories from the list to compare their cumulative or daily star counts.

The [GitHub history API](https://docs.github.com/en/rest/activity/starring#get-repository-star-history) counts currently active stars by their original creation dates.

## Development

Requires Node.js, pnpm and Biome on the system PATH.

```sh
pnpm install
pnpm dev
```

```sh
pnpm format
pnpm check
pnpm build
```

The static site is built in `dist/`. Use `pnpm preview` to serve it locally.
