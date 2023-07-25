import { NostrFetcher } from "./deps.ts";
import { NosdumpParams } from "./types.ts";

export const dumpNostrEvents = async ({
  relayUrls,
  fetchFilter,
  fetchTimeRange,
  fetchOptions,
}: NosdumpParams) => {
  const fetcher = NostrFetcher.init({ minLogLevel: "warn" });
  for await (const ev of fetcher.allEventsIterator(
    relayUrls,
    fetchFilter,
    fetchTimeRange,
    fetchOptions
  )) {
    console.log(JSON.stringify(ev));
  }
  fetcher.shutdown();
};
