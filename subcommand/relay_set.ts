import { Command } from "@cliffy/command";
import { NosdumpConfigRepo } from "../config.ts";
import { promptConfirmation } from "../prompt.ts";

async function listRelaySets(asJson: boolean) {
  const config = await NosdumpConfigRepo.load();
  const sets = config.relaySets.listAll();

  if (asJson) {
    console.log(JSON.stringify(sets));
    return;
  }

  // default, human-readable format
  for (const [name, relays] of Object.entries(sets)) {
    console.log(`${name}:`);
    for (const r of relays) {
      console.log(`  ${r}`);
    }
    console.log();
  }
}

async function listRelaysOfSet(name: string, asJson: boolean) {
  const config = await NosdumpConfigRepo.load();
  const relays = config.relaySets.listRelaysOf(name);
  if (relays === undefined) {
    console.error(`Relay set "${name}" not found.`);
    Deno.exit(1);
  }

  if (asJson) {
    console.log(JSON.stringify(relays));
    return;
  }
  // default format
  for (const r of relays) {
    console.log(r);
  }
}

async function addRelaysToSet(name: string, relays: string[]) {
  const config = await NosdumpConfigRepo.load();
  const resolveRes = config.resolveRelaySpecifiers(relays);
  if (!resolveRes.isOk) {
    console.error("Failed to resolve relay specifiers:");
    for (const e of resolveRes.err) {
      console.error(e);
    }
    Deno.exit(1);
  }

  const added = config.relaySets.addRelayUrlsTo(name, resolveRes.val);
  if (added) {
    await config.save();
  }
}

async function removeRelaysFromSet(name: string, relays: string[]) {
  const config = await NosdumpConfigRepo.load();
  const resolveRes = config.resolveRelaySpecifiers(relays);
  if (!resolveRes.isOk) {
    console.error("Failed to resolve relay specifiers:");
    for (const e of resolveRes.err) {
      console.error(e);
    }
    Deno.exit(1);
  }

  const removed = config.relaySets.removeRelayUrlsFrom(name, resolveRes.val);
  if (removed) {
    await config.save();
  }
}

async function copyRelaySet(srcName: string, dstName: string) {
  const config = await NosdumpConfigRepo.load();
  if (config.relaySets.has(dstName)) {
    const confirmed = await promptConfirmation({
      message: `Relay set "${dstName}" already exists. Overwrite?`,
      default: false,
    });
    if (!confirmed) {
      console.error("Operation cancelled.");
      Deno.exit(1);
    }
  }

  config.relaySets.copy(srcName, dstName);
  await config.save();
}

async function renameRelaySet(oldName: string, newName: string) {
  const config = await NosdumpConfigRepo.load();

  if (config.relaySets.has(newName)) {
    const confirmed = await promptConfirmation({
      message: `Relay set "${newName}" already exists. Overwrite?`,
      default: false,
    });
    if (!confirmed) {
      console.error("Operation cancelled.");
      Deno.exit(1);
    }
  }

  config.relaySets.rename(oldName, newName);
  await config.save();
}

async function deleteRelaySet(name: string) {
  const config = await NosdumpConfigRepo.load();
  const deleted = config.relaySets.delete(name);
  if (deleted) {
    await config.save();
  }
}

const relaySetListAllCommand = new Command()
  .description("List all relay sets.")
  .option("--json", "Output as JSON.", { default: false })
  .action(async ({ json }) => {
    await listRelaySets(json);
  });

const relaySetListCommand = new Command()
  .description("List relays in a relay set.")
  .option("--json", "Output as JSON.", { default: false })
  .arguments("<set:string>")
  .action(async ({ json }, name) => {
    await listRelaysOfSet(name, json);
  });

const relaySetAddCommand = new Command()
  .description("Add relays to a relay set.")
  .arguments("<set:string> <relays...:string>")
  .action(async (_, name, ...relays) => {
    await addRelaysToSet(name, relays);
  });

const relaySetRemoveCommand = new Command()
  .description("Remove relays from a relay set.")
  .arguments("<set:string> <relays...:string>")
  .action(async (_, name, ...relays) => {
    await removeRelaysFromSet(name, relays);
  });

const relaySetCopyCommand = new Command()
  .description("Copy a relay set.")
  .arguments("<src-set:string> <dst-set:string>")
  .action(async (_, srcName, dstName) => {
    await copyRelaySet(srcName, dstName);
  });

const relaySetRenameCommand = new Command()
  .description("Rename a relay set.")
  .arguments("<old-name:string> <new-name:string>")
  .action(async (_, oldName, newName) => {
    await renameRelaySet(oldName, newName);
  });

const relaySetDeleteCommand = new Command()
  .description("Delete a relay set.")
  .arguments("<set:string>")
  .action(async (_, name) => {
    await deleteRelaySet(name);
  });

const descriptionText = `Manage relay sets.

You add multiple relays to a single relay set:
  $ nosdump relay-set add set1 wss://relay1-a.com wss://relay1-b.com
  $ nosdump relay-set add set2 wss://relay2-a.com wss://relay2-b.com

then you can specify all relays in the relay set at once as dump targets, using the "...<relay-set>" syntax:
  $ nosdump --kinds 1 ...set1 ...set2

Shorthands:
  * nosdump relay-set                    === nosdump relay-set list-all
  * nosdump relay-set <set>              === nosdump relay-set list <set>
  * nosdump relay-set <set> <relays...>  === nosdump relay-set add <set> <relays...>
`;

export const relaySetCommand = new Command()
  .command("list-all", relaySetListAllCommand)
  .command("list", relaySetListCommand).alias("ls")
  .command("add", relaySetAddCommand)
  .command("remove", relaySetRemoveCommand).alias("rm")
  .command("copy", relaySetCopyCommand).alias("cp")
  .command("rename", relaySetRenameCommand)
  .command("delete", relaySetDeleteCommand)
  .reset()
  .description(descriptionText)
  .option("--json", "Output as JSON.", { default: false })
  .arguments("[name:string] [relays...:string]")
  .action(async ({ json }, name, ...relays) => {
    // `nosdump relay-set` === `nosdump relay-set list-all`
    if (name === undefined) {
      await listRelaySets(json);
      return;
    }
    // `nosdump relay-set <name>` === `nosdump relay-set list <name>`
    if (relays.length === 0) {
      await listRelaysOfSet(name, json);
      return;
    }
    // `nosdump relay-set <name> <relays...>` === `nosdump relay-set add <name> <relays...>`
    await addRelaysToSet(name, relays as [string, ...string[]]);
  });
