import {
  ArgumentValue,
  Command,
  FetchAllOptions,
  FetchFilter,
  FetchTimeRangeFilter,
  ValidationError,
} from "./deps.ts";

import { MiscOptions, NosdumpParams } from "./types.ts";

const kindType = ({ label, name, value }: ArgumentValue): number => {
  const n = Number(value);
  if (isNaN(n) || n < 0) {
    throw new ValidationError(
      `${label} "${name}" must be non-negative number, but got "${value}".`
    );
  }
  return n;
};

type TagSpec = {
  name: string;
  values: string[];
};
const tagSpecType = ({ value }: ArgumentValue): TagSpec => {
  const [tagName, tagVals] = value.split(":");
  if (tagName === undefined || tagVals === undefined) {
    throw new ValidationError(
      `Tag spec "${value}" is malformed. It must follow "<tag name>:<comma separated list of tag values>" format.`
    );
  }
  return {
    name: tagName,
    values: tagVals.split(",").map((v) => v.trim()),
  };
};

const mergeTagSpecs = (tagSpecs: TagSpec[]): Record<string, string[]> => {
  const m = new Map<string, Set<string>>();
  for (const { name, values } of tagSpecs) {
    const acc = m.get(name) ?? new Set();
    for (const v of values) {
      acc.add(v);
    }
    m.set(name, acc);
  }
  return Object.fromEntries(
    [...m.entries()].map(
      ([name, values]) => [`#${name}`, [...values]] as [string, string[]]
    )
  );
};

const cleanupObj = <T extends Record<string, unknown>>(obj: T): T => {
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) {
      delete obj[k];
    }
  }
  return obj;
};

export const parseInput = async (
  rawArgs: string[]
): Promise<NosdumpParams & { miscOptions: MiscOptions }> => {
  const { args, options } = await new Command()
    .name("nosdump")
    .version("0.2.0")
    .description("A Tool to dump events stored in Nostr relays")
    .usage("[options...] <relay-URLs...>")
    .type("kind", kindType)
    .type("tag-spec", tagSpecType)
    .option(
      "-n, --dry-run",
      "Just print parsed options instead of running actual dumping."
    )
    .group("Filter options")
    .option("--ids <ids:string[]>", "Comma separated list of target event ids.")
    .option(
      "--authors <authors:string[]>",
      "Comma separated list of target author's pubkeys."
    )
    .option(
      "--kinds <kinds:kind[]>",
      "Comma separated list of target event kinds."
    )
    .option(
      "--tag <tag-spec:tag-spec>",
      "Tag query specifier. Syntax: <tag name>:<comma separated tag values>. You can specify multiple --tag options.",
      { collect: true }
    )
    .option(
      "--search <query:string>",
      "Search query. Note that if you use this filter against relays which don't support NIP-50, no event will be fetched."
    )
    .option(
      "--since <unixtime:number>",
      "If specified, it fetches only events newer than the timestamp."
    )
    .option(
      "--until <unixtime:number>",
      "If specified, it fetches only events older than the timestamp."
    )
    .group("Fetch options")
    .option(
      "--skip-verification",
      "If enabled, it skips event signature verification."
    )
    .arguments("<relay-URLs...>")
    .parse(rawArgs);

  const tagQuery = mergeTagSpecs(options.tag ?? []);
  const fetchFilter = cleanupObj({
    ids: options.ids,
    authors: options.authors,
    kinds: options.kinds,
    ...tagQuery,
    search: options.search,
  } as FetchFilter);

  const fetchTimeRange: FetchTimeRangeFilter = cleanupObj({
    since: options.since,
    until: options.until,
  });

  const fetchOptions: FetchAllOptions = cleanupObj({
    skipVerification: options.skipVerification,
  });

  const miscOptions: MiscOptions = cleanupObj({
    dryRun: options.dryRun,
  });

  return {
    relayUrls: args,
    fetchFilter,
    fetchTimeRange,
    fetchOptions,
    miscOptions,
  };
};
