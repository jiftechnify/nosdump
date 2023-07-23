import { NostrFetcher } from "./deps.ts";

const fetcher = NostrFetcher.init();
for await (const ev of fetcher.allEventsIterator(Deno.args, {}, {})) {
  console.log(JSON.stringify(ev));
}
fetcher.shutdown();
