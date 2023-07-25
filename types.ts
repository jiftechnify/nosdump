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
