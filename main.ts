import { getUnixTime, readAllSync } from "./deps.ts";
import { parseInput } from "./input_parser.ts";
import { dumpNostrEvents } from "./mod.ts";

// if Deno.isatty(Deno.stdin.rid) returns false, stdin is connected to a pipe.
// cf. https://zenn.dev/kawarimidoll/articles/5559a185156bf4#deno.stdin%E3%81%AE%E5%87%A6%E7%90%86
const stdinText = !Deno.isatty(Deno.stdin.rid)
  ? new TextDecoder("utf-8").decode(readAllSync(Deno.stdin))
  : "";

const currUnixtimeSec = getUnixTime(new Date());

const { miscOptions, ...params } = await parseInput(
  Deno.args,
  stdinText,
  currUnixtimeSec
);

if (miscOptions.dryRun) {
  console.log("Parsed options:");
  console.log(params);
  Deno.exit(0);
}

await dumpNostrEvents(params);
