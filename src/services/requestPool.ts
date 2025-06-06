import { ConcurrencyPool } from "./concurrency";

const sharedPool = new ConcurrencyPool(50);

export const getRequestPool = () => sharedPool;
