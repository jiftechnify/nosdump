export { dumpNostrEvents } from "./dump.ts";

import { nosdumpCommand } from "./command.ts";

if (import.meta.main) {
  await nosdumpCommand.parse(Deno.args);
}
