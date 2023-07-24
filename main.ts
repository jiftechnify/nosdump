import { Command, NostrFetcher } from "./deps.ts";

const { args, options } = await new Command()
  .name("nosdump")
  .version("0.2.0")
  .description("Dump events stored in Nostr relays")
  .option("--since <unixtime:number>", "fetch events newer than the timestamp")
  .option("--until <unixtime:number>", "fetch events older than the timestamp")
  .option("--skip-verification", "skip event signature verification")
  .arguments("<relay-URLs...>")
  .parse(Deno.args);

console.log("options: %O", options);

const fetcher = NostrFetcher.init();
for await (const ev of fetcher.allEventsIterator(args, {}, options, options)) {
  console.log(JSON.stringify(ev));
}
fetcher.shutdown();
