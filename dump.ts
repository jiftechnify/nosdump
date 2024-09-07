import { NostrFetcher } from "nostr-fetch";

import type { NosdumpParams } from "./types.ts";

export const dumpNostrEvents = async ({
  relayUrls,
  fetchFilter,
  fetchTimeRange,
  fetchOptions,
}: NosdumpParams): Promise<void> => {
  const fetcher = NostrFetcher.init({ minLogLevel: "warn" });
  for await (
    const ev of fetcher.allEventsIterator(
      relayUrls,
      fetchFilter,
      fetchTimeRange,
      { enableBackpressure: true, ...fetchOptions },
    )
  ) {
    console.log(JSON.stringify(ev));
  }
  fetcher.shutdown();
};
