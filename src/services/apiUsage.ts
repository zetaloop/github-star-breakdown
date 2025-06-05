import { fetchRestRateLimit, fetchGraphQLRateLimit } from "./github";

let restRemaining: number | null = null;
let graphqlRemaining: number | null = null;
let lastChecked = 0;

export const updateRateLimits = async () => {
  const now = Date.now();
  if (now - lastChecked < 60000) return;
  const rest = await fetchRestRateLimit();
  if (rest) restRemaining = rest.limit - rest.used;
  const graph = await fetchGraphQLRateLimit();
  if (graph) graphqlRemaining = graph.limit - graph.used;
  lastChecked = now;
  checkAutoPause();
};

export const getRestRemaining = () => restRemaining;
export const getGraphQLRemaining = () => graphqlRemaining;

export const recordRestCall = (count = 1) => {
  if (restRemaining !== null) restRemaining -= count;
};

export const recordGraphQLCall = (count = 1) => {
  if (graphqlRemaining !== null) graphqlRemaining -= count;
};

let paused = false;
export const setPaused = (val: boolean) => {
  paused = val;
};
export const isPaused = () => paused;
export const waitIfPaused = async () => {
  while (paused) {
    await new Promise((r) => setTimeout(r, 1000));
  }
};

const THRESHOLD = 100;
export const checkAutoPause = () => {
  if (
    (restRemaining !== null && restRemaining <= THRESHOLD) ||
    (graphqlRemaining !== null && graphqlRemaining <= THRESHOLD)
  ) {
    paused = true;
    return true;
  }
  return false;
};
