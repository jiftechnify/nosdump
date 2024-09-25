import { Command } from "@cliffy/command";
import { Table } from "@cliffy/table";

import { promptConfirmation } from "../cli_helpers.ts";
import { NosdumpConfigRepo } from "../config.ts";

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
    console.error(`Relay alias "${alias}" not found.`);
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
      console.error("Operation cancelled.");
      Deno.exit(1);
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
  .description("Show a relay URL associated with an alias.")
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

const descriptionText = `Manage relay aliases.

You set "aliases" for relay URLs:  
  $ nosdump alias set foo wss://relay.foo.com/
  $ nosdump alias set bar wss://relay.bar.com/

then you can refer to relays with aliases when you dump events:
  $ nosdump --kinds 1 foo bar

Shorthands:
  * nosdump alias                     === nosdump alias list
  * nosdump alias <alias>             === nosdump alias get <alias>
  * nosdump alias <alias> <relay-URL> === nosdump alias set <alias> <relay-URL>`;

export const relayAliasCommand = new Command()
  .command("list", aliasListCmd).alias("ls")
  .command("get", aliasGetCmd)
  .command("set", aliasSetCmd)
  .command("unset", aliasUnsetCmd).alias("rm")
  .reset()
  .description(descriptionText)
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
    // `nosdump alias <alias> <relay-URL>` === `nosdump alias set <alias> <relay-URL>`
    await setAlias(alias, relayUrl);
  });
