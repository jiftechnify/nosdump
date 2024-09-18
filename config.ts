import xdg from "xdg";
import { resolve } from "@std/path";
import * as toml from "@std/toml";
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
    ),
  }),
});
type NosdumpConfig = z.infer<typeof NosdumpConfigSchema>;
const emptyConfig: NosdumpConfig = {
  relay: {
    aliases: {},
  },
};

export class NosdumpConfigRepo {
  private relayAliasesOps: RelayAliasesOps;

  private constructor(private conf: NosdumpConfig) {
    this.relayAliasesOps = new RelayAliasesOps(this.conf.relay.aliases);
  }

  static async load(): Promise<NosdumpConfigRepo> {
    try {
      const confFile = await Deno.readTextFile(DEFAULT_CONFIG_PATH);
      const rawConf = toml.parse(confFile) as NosdumpConfig;
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

  static fromConfigObjectForTesting(conf: NosdumpConfig) {
    return new NosdumpConfigRepo(conf);
  }

  async save(): Promise<void> {
    const t = toml.stringify(this.conf);
    await Deno.mkdir(DEFAULT_CONFIG_DIR, { recursive: true });
    await Deno.writeTextFile(DEFAULT_CONFIG_PATH, t);
  }

  get relayAliases(): RelayAliasesOps {
    return this.relayAliasesOps;
  }

  resolveRelaySpecifiers(relaySpecs: string[]): Result<string[], string[]> {
    const resolved = new Set<string>();
    const errors: string[] = [];

    for (const rspec of relaySpecs) {
      // resolve valid relay URL as is
      if (relayUrlIsValid(rspec)) {
        resolved.add(rspec);
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
