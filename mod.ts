export { dumpNostrEvents } from "./dump.ts";

import { nosdumpCommand } from "./command.ts";

if (import.meta.main) {
  try {
    await nosdumpCommand.parse(Deno.args);
  } catch (err) {
    console.error(err);
    Deno.exit(1);
  }
}
