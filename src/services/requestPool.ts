import { ConcurrencyPool } from "./concurrency";

const restPool = new ConcurrencyPool(50);
const graphqlPool = new ConcurrencyPool(50);

export const getRestPool = () => restPool;
export const getGraphqlPool = () => graphqlPool;
