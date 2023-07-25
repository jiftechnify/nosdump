import { parseInput } from "./input_parser.ts";
import { dumpNostrEvents } from "./mod.ts";

const { miscOptions, ...params } = await parseInput(Deno.args);

if (miscOptions.dryRun) {
  console.log("Parsed options:");
  console.log(params);
  Deno.exit(0);
}

await dumpNostrEvents(params);
