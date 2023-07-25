import { parseInput } from "./input_parser.ts";
import { dumpNostrEvents } from "./mod.ts";

const params = await parseInput(Deno.args);
await dumpNostrEvents(params);
