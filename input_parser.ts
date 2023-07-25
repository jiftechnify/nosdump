import {
  ArgumentValue,
  Command,
  FetchAllOptions,
  FetchFilter,
  FetchTimeRangeFilter,
  ValidationError,
  ZodError,
  fromZodError,
  z,
} from "./deps.ts";

import { MiscOptions, NosdumpParams, Result } from "./types.ts";

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

const nonTagFilterSchema = z
  .object({
    ids: z.string().array(),
    authors: z.string().array(),
    kinds: z.number().nonnegative().array(),
    since: z.number(),
    until: z.number(),
    search: z.string(),
  })
  .partial();

const tagQuerySchema = z.record(
  z.string().startsWith("#").length(2),
  z.string().array()
);

/**
 * parse text as Nostr filter.
 * if `extractFromReq` is true, parse text as REQ message instead and extract the first filter.
 */
const parseFilterFromText = (
  text: string,
  extractFromReq: boolean
): Result<[FetchFilter, FetchTimeRangeFilter], Error> => {
  // regard empty string as empty filter
  if (text === "") {
    return Result.ok([{}, {}]);
  }

  try {
    const rawJson = JSON.parse(text) as unknown;

    let rawFilter: unknown = rawJson;
    if (extractFromReq) {
      //  extract the first filter from REQ message
      if (!Array.isArray(rawJson) || rawJson.length <= 2) {
        return Result.err(Error("malformed REQ message!"));
      }
      rawFilter = rawJson[2];
    }

    // validate non-tag filter schema
    const nonTagFilter = nonTagFilterSchema.parse(rawFilter);
    const { since, until, ...restFilter } = nonTagFilter;

    // validate tag query schema
    for (const k of Object.keys(nonTagFilter)) {
      delete (rawFilter as Record<string, unknown>)[k];
    }
    const tagQuery = tagQuerySchema.parse(rawFilter);

    const fetchFilter = cleanupObj({
      ...restFilter,
      ...tagQuery,
    }) as FetchFilter;

    const fetchTimeRange: FetchTimeRangeFilter = cleanupObj({
      since,
      until,
    });

    return Result.ok([fetchFilter, fetchTimeRange]);
  } catch (err) {
    if (err instanceof ZodError) {
      return Result.err(fromZodError(err));
    }
    if (err instanceof Error) {
      return Result.err(err);
    }
    return Result.err(Error(err));
  }
};

export const parseInput = async (
  rawArgs: string[],
  stdinText: string
): Promise<NosdumpParams & { miscOptions: MiscOptions }> => {
  const { args, options } = await new Command()
    .name("nosdump")
    .version("0.2.0")
    .description("A tool to dump events stored in Nostr relays")
    .usage("[options...] <relay-URLs...>")
    .type("kind", kindType)
    .type("tag-spec", tagSpecType)
    .option(
      "-n, --dry-run",
      "Just print parsed options instead of running actual dumping.",
      { default: false }
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
      "Fetch only events newer than the timestamp if specified."
    )
    .option(
      "--until <unixtime:number>",
      "Fetch only events older than the timestamp if specified."
    )
    .group("Fetch options")
    .option("--skip-verification", "Skip event signature verification.", {
      default: false,
    })
    .group("Input options")
    .option(
      "-R, --stdin-req",
      "Read stdin as a Nostr REQ message and extract the first filter from it.",
      {
        default: false,
      }
    )
    .arguments("<relay-URLs...>")
    .parse(rawArgs);

  // read stdin and parse as a filter
  const parseStdinRes = parseFilterFromText(stdinText, options.stdinReq);
  if (!parseStdinRes.isOk) {
    console.error("Couldn't parse stdin as Nostr filter:");
    console.error(parseStdinRes.err.message);
    Deno.exit(1);
  }
  const [stdinFilter, stdinTimeRange] = parseStdinRes.val;

  // construct filter from options
  const optTagQuery = mergeTagSpecs(options.tag ?? []);
  const optFilter = cleanupObj({
    ids: options.ids,
    authors: options.authors,
    kinds: options.kinds,
    ...optTagQuery,
    search: options.search,
  } as FetchFilter);

  const optTimeRange: FetchTimeRangeFilter = cleanupObj({
    since: options.since,
    until: options.until,
  });

  // other options
  const fetchOptions: FetchAllOptions = cleanupObj({
    skipVerification: options.skipVerification,
  });
  const miscOptions: MiscOptions = cleanupObj({
    dryRun: options.dryRun,
  });

  // filter props specified by CLI option overrides props parsed from stdin.
  return {
    relayUrls: args,
    fetchFilter: { ...stdinFilter, ...optFilter },
    fetchTimeRange: { ...stdinTimeRange, ...optTimeRange },
    fetchOptions,
    miscOptions,
  };
};
