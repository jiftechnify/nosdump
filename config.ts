import xdg from "xdg";
import { resolve } from "@std/path";
import * as toml from "@std/toml";
import { distinct, union, withoutAll } from "@std/collections";
import { z, type ZodError } from "zod";
import { normalizeURL as normalizeRelayUrl } from "nostr-tools/utils";
import { ValidationError } from "@cliffy/command";
import { Result } from "./types.ts";

const DEFAULT_CONFIG_DIR = resolve(xdg.config(), "nosdump");
const DEFAULT_CONFIG_PATH = resolve(DEFAULT_CONFIG_DIR, "config.toml");

const reRelayAlias = /^[a-zA-Z0-9_-]+$/;
function assertRelayAliasIsValid(alias: string) {
  if (!reRelayAlias.test(alias)) {
    throw new ValidationError(
      `relay alias can contain only alphanumeric letters, '-' and '_' (input: ${alias}).`,
    );
  }
}

const reRelaySetName = /^[a-zA-Z0-9_-]+$/;
function assertRelaySetNameIsValid(name: string) {
  if (!reRelaySetName.test(name)) {
    throw new ValidationError(
      `name of relay set can contain only alphanumeric letters, '-' and '_' (input: ${name}).`,
    );
  }
}

const reRelayUrl = new RegExp("^wss?://");
function assertRelayUrlIsValid(url: string) {
  if (!URL.canParse(url)) {
    throw new ValidationError(`invalid URL: ${url}`);
  }
  if (!reRelayUrl.test(url)) {
    throw new ValidationError(
      `relay URL must start with wss:// or ws:// (input: ${url}).`,
    );
  }
}
function assertRelayUrlsAreValid(urls: string[]) {
  const errMsgs: string[] = [];
  for (const url of urls) {
    try {
      assertRelayUrlIsValid(url);
    } catch (err) {
      if (err instanceof Error) {
        errMsgs.push(err.message);
      } else {
        errMsgs.push(`unknown error while validating: ${url}`);
      }
    }
  }
  if (errMsgs.length > 0) {
    throw new ValidationError(errMsgs.join("\n"));
  }
}
function relayUrlIsValid(url: string): boolean {
  return URL.canParse(url) && reRelayUrl.test(url);
}

export const NosdumpConfigSchema = z.object({
  relay: z.object({
    aliases: z.record(
      z.string()
        .regex(
          reRelayAlias,
          "relay alias can contain only alphanumeric letters, '-' and '_'",
        ),
      z.string()
        .url()
        .regex(
          reRelayUrl,
          "relay URL must start with wss:// or ws://",
        )
        .transform((url) => normalizeRelayUrl(url)),
    ).default({}),
    sets: z.record(
      z.string()
        .regex(
          reRelaySetName,
          "name of relay set can contain only alphanumeric letters, '-' and '_'",
        ),
      z.array(
        z.string()
          .url()
          .regex(
            reRelayUrl,
            "relay URL must start with wss:// or ws://",
          )
          .transform((url) => normalizeRelayUrl(url)),
      ).transform((urls) => distinct(urls)),
    ).default({}),
  }),
});
type NosdumpConfig = z.infer<typeof NosdumpConfigSchema>;
const emptyConfig: NosdumpConfig = {
  relay: {
    aliases: {},
    sets: {},
  },
};

export class NosdumpConfigRepo {
  private relayAliasesOps: RelayAliasesOps;
  private relaySetsOps: RelaySetsOps;

  private constructor(private conf: NosdumpConfig) {
    this.relayAliasesOps = new RelayAliasesOps(this.conf.relay.aliases);
    this.relaySetsOps = new RelaySetsOps(this.conf.relay.sets);
  }

  static async load(): Promise<NosdumpConfigRepo> {
    try {
      const confFile = await Deno.readTextFile(DEFAULT_CONFIG_PATH);
      const rawConf = toml.parse(confFile);
      const validated = NosdumpConfigSchema.safeParse(rawConf);
      if (!validated.success) {
        const errMsg = formatValidationErrorsOnLoad(
          validated.error,
          DEFAULT_CONFIG_PATH,
        );
        throw new ValidationError(errMsg);
      }
      return new NosdumpConfigRepo(validated.data);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        return new NosdumpConfigRepo(emptyConfig);
      }
      throw err;
    }
  }

  static fromConfigObjectForTesting(
    conf: {
      [K in keyof NosdumpConfig]: {
        [K2 in keyof NosdumpConfig[K]]?: NosdumpConfig[K][K2];
      };
    },
  ): NosdumpConfigRepo {
    return new NosdumpConfigRepo({
      relay: {
        aliases: conf.relay.aliases ?? {},
        sets: conf.relay.sets ?? {},
      },
    });
  }

  async save(): Promise<void> {
    const t = toml.stringify(this.conf);
    await Deno.mkdir(DEFAULT_CONFIG_DIR, { recursive: true });
    await Deno.writeTextFile(DEFAULT_CONFIG_PATH, t);
  }

  get relayAliases(): RelayAliasesOps {
    return this.relayAliasesOps;
  }

  get relaySets(): RelaySetsOps {
    return this.relaySetsOps;
  }

  resolveRelaySpecifiers(relaySpecs: string[]): Result<string[], string[]> {
    const resolved = new Set<string>();
    const errors: string[] = [];

    for (const rspec of relaySpecs) {
      // resolve valid relay URL as is
      if (relayUrlIsValid(rspec)) {
        resolved.add(normalizeRelayUrl(rspec));
        continue;
      }

      // resolve relay alias as referent
      const aliased = this.relayAliases.get(rspec);
      if (aliased !== undefined) {
        resolved.add(aliased);
        continue;
      }

      // all attempts failed
      errors.push(`"${rspec}" is not a valid relay URL or a relay alias.`);
    }

    if (errors.length > 0) {
      return Result.err(errors);
    }
    return Result.ok([...resolved]);
  }
}

function formatValidationErrorsOnLoad(err: ZodError, confPath: string): string {
  const lines = [
    "Config file validation error!",
    `Please check and fix the config at: ${confPath}`,
    "",
    err.issues.map((i) => `* ${i.path.join(".")}: ${i.message}`).join("\n"),
  ];
  return lines.join("\n");
}

type RelayAliases = NosdumpConfig["relay"]["aliases"];

export class RelayAliasesOps {
  constructor(private aliases: RelayAliases) {}

  list(): RelayAliases {
    return Object.assign({}, this.aliases);
  }

  get(alias: string): string | undefined {
    return this.aliases[alias];
  }

  has(alias: string): boolean {
    return alias in this.aliases;
  }

  set(alias: string, relayUrl: string): void {
    assertRelayAliasIsValid(alias);
    assertRelayUrlIsValid(relayUrl);
    this.aliases[alias] = normalizeRelayUrl(relayUrl);
  }

  unset(alias: string): boolean {
    if (!this.has(alias)) {
      return false;
    }
    delete this.aliases[alias];
    return true;
  }
}

type RelaySets = NosdumpConfig["relay"]["sets"];

export class RelaySetsOps {
  constructor(private sets: RelaySets) {}

  listAll(): RelaySets {
    return Object.fromEntries(
      Object.entries(this.sets).map(([name, set]) => [name, [...set]]),
    );
  }

  listRelaysOf(name: string): string[] | undefined {
    const set = this.sets[name];
    return set !== undefined ? [...set] : undefined;
  }

  has(name: string): boolean {
    return name in this.sets;
  }

  addRelayUrlsTo(name: string, relayUrls: string[]): boolean {
    assertRelaySetNameIsValid(name);
    assertRelayUrlsAreValid(relayUrls);

    const set = this.listRelaysOf(name) ?? [];
    const newSet = union(set, relayUrls.map(normalizeRelayUrl));

    if (newSet.length === set.length) {
      return false;
    }
    this.sets[name] = newSet;
    return true;
  }

  delete(name: string): boolean {
    if (!this.has(name)) {
      return false;
    }
    delete this.sets[name];
    return true;
  }

  removeRelayUrlsFrom(name: string, relayUrls: string[]): boolean {
    const set = this.listRelaysOf(name);
    if (set === undefined) {
      return false;
    }

    const newSet = withoutAll(set, relayUrls.map(normalizeRelayUrl));
    if (newSet.length === set.length) {
      return false;
    }

    if (newSet.length === 0) {
      this.delete(name);
      return true;
    }

    this.sets[name] = newSet;
    return true;
  }

  copy(srcName: string, dstName: string) {
    if (srcName === dstName) {
      throw new ValidationError(
        "destination relay set must be different from source relay set.",
      );
    }
    assertRelaySetNameIsValid(dstName);
    const srcSet = this.listRelaysOf(srcName);
    if (srcSet === undefined) {
      throw new ValidationError(`relay set "${srcName}" not found.`);
    }

    this.sets[dstName] = srcSet;
  }

  rename(oldName: string, newName: string) {
    if (oldName === newName) {
      throw new ValidationError(
        "new relay set name must be different from the old one.",
      );
    }
    assertRelaySetNameIsValid(newName);
    const oldSet = this.listRelaysOf(oldName);
    if (oldSet === undefined) {
      throw new ValidationError(`relay set "${oldName}" not found.`);
    }

    this.sets[newName] = oldSet;
    this.delete(oldName);
  }
}
