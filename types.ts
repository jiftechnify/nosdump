import { FetchAllOptions, FetchFilter, FetchTimeRangeFilter } from "./deps.ts";

export type NosdumpParams = {
  relayUrls: string[];
  fetchFilter: FetchFilter;
  fetchTimeRange: FetchTimeRangeFilter;
  fetchOptions: FetchAllOptions;
};

export type MiscOptions = {
  dryRun?: boolean;
};

export type Result<T, E> =
  | {
      isOk: true;
      val: T;
    }
  | {
      isOk: false;
      err: E;
    };

export const Result = {
  ok<T>(val: T): Result<T, never> {
    return { isOk: true, val };
  },
  err<E>(err: E): Result<never, E> {
    return { isOk: false, err };
  },
};
