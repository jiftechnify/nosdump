import { Command } from "@cliffy/command";
import { Table } from "@cliffy/table";

import { NosdumpConfigRepo } from "../config.ts";
import { promptConfirmation } from "../prompt.ts";

async function listAliases(asJson: boolean) {
  const conf = await NosdumpConfigRepo.load();
  const ls = conf.relayAliases.list();

  if (asJson) {
    console.log(JSON.stringify(ls));
    return;
  }
  // default, human-readable output
  const table = new Table(...(Object.entries(ls)));
  console.log(table.toString());
}

async function getAlias(alias: string) {
  const conf = await NosdumpConfigRepo.load();
  const url = conf.relayAliases.get(alias);
  if (url === undefined) {
    Deno.exit(1);
  }
  console.log(url);
}

async function setAlias(alias: string, url: string) {
  const conf = await NosdumpConfigRepo.load();
  if (conf.relayAliases.has(alias)) {
    const confirmed = await promptConfirmation({
      message: `Relay alias "${alias}" already exists. Overwrite?`,
      default: false,
    });
    if (!confirmed) {
      return;
    }
  }
  conf.relayAliases.set(alias, url);
  await conf.save();
}

async function unsetAlias(alias: string) {
  const conf = await NosdumpConfigRepo.load();
  const unset = conf.relayAliases.unset(alias);
  if (unset) {
    await conf.save();
  }
}

const aliasListCmd = new Command()
  .description("List all relay aliases.")
  .option("--json", "Output as JSON.", { default: false })
  .action(async ({ json }) => {
    await listAliases(json);
  });

const aliasGetCmd = new Command()
  .description("Show the relay URL associated with the alias.")
  .arguments("<alias:string>")
  .action(async (_, alias) => {
    await getAlias(alias);
  });

const aliasSetCmd = new Command()
  .description("Set a relay alias.")
  .arguments("<alias:string> <relay-URL:string>")
  .action(async (_, alias, relayUrl) => {
    await setAlias(alias, relayUrl);
  });

const aliasUnsetCmd = new Command()
  .description("Unset a relay alias.")
  .arguments("<alias:string>")
  .action(async (_, alias) => {
    await unsetAlias(alias);
  });

const description = `Manage aliases for relays.

If you omit both arguments, lists all aliases (same as "nosdump alias list").
If you only provide <alias>, shows the relay URL of the alias (same as "nosdump alias get <alias>").
If you provide both <alias> and <relay-URL>, sets a new alias (same as "nosdump alias set <alias> <relay-URL>").`;

export const aliasCommand = new Command()
  .command("list", aliasListCmd)
  .command("get", aliasGetCmd)
  .command("set", aliasSetCmd)
  .command("unset", aliasUnsetCmd)
  .reset()
  .description(description)
  .option("--json", "Output as JSON.", { default: false })
  .arguments("[alias:string] [relay-URL:string]")
  .action(async ({ json }, alias, relayUrl) => {
    // `nosdump alias` === `nosdump alias list`
    if (alias === undefined) {
      await listAliases(json);
      return;
    }
    // `nosdump alias <alias>` === `nosdump alias get <alias>`
    if (relayUrl === undefined) {
      await getAlias(alias);
      return;
    }
    // `nosdump alias <alias> <relay-url>` === `nosdump alias set <alias> <relay-url>`
    await setAlias(alias, relayUrl);
  });
