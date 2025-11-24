import { toText as streamToText } from "@std/streams";

import type { ArgumentValue } from "@cliffy/command";
import { Command, ValidationError } from "@cliffy/command";
import { CompletionsCommand } from "@cliffy/command/completions";
import { UpgradeCommand } from "@cliffy/command/upgrade";
import { JsrProvider } from "@cliffy/command/upgrade/provider/jsr";

import type { AllEventsIterOptions, FetchFilter, FetchTimeRangeFilter } from "nostr-fetch";
import * as nip19 from "nostr-tools/nip19";

import { Duration } from "@retraigo/duration";
import { getUnixTime, isValid as isDateValid, parseISO } from "date-fns";

import { z, ZodError } from "zod";
import { fromError } from "zod-validation-error";

import { printErrorHeaderAndMessages } from "./cli_helpers.ts";
import { NosdumpConfigRepo } from "./config.ts";
import { dumpNostrEvents } from "./dump.ts";
import { relayAliasCommand } from "./subcommand/relay_alias.ts";
import { relaySetCommand } from "./subcommand/relay_set.ts";
import type { MiscOptions, NosdumpParams } from "./types.ts";
import { Result } from "./types.ts";

export const nosdumpCommand = new Command()
  .name("nosdump")
  .version("0.7.1")
  .description("A tool to dump events stored in Nostr relays")
  .usage("[options...] <relays...>")
  .command("completions", new CompletionsCommand())
  .command(
    "upgrade",
    new UpgradeCommand({
      provider: [
        new JsrProvider({
          scope: "jiftechnify",
          package: "@jiftechnify/nosdump",
        }),
      ],
      args: ["--allow-all"], // grant all permissions while upgrading
    }),
  )
  .command("relay-alias", relayAliasCommand).alias("alias")
  .command("relay-set", relaySetCommand).alias("rset")
  .reset()
  .type("kind", kindType)
  .type("tag-spec", tagSpecType)
  .option(
    "-n, --dry-run",
    "Just print parsed options instead of running actual dumping.",
    { default: false },
  )
  .group("Filter options")
  .option(
    "-i, --ids <ids:string[]>",
    "Comma separated list of target event ids.",
  )
  .option(
    "-a, --authors <authors:string[]>",
    "Comma separated list of target author's pubkeys.",
  )
  .option(
    "-k, --kinds <kinds:kind[]>",
    "Comma separated list of target event kinds.",
  )
  .option(
    "-t, --tag <tag-spec:tag-spec>",
    "Tag query specifier. Syntax: <tag name>:<comma separated tag values>. You can specify multiple --tag options.",
    { collect: true },
  )
  .option(
    "-S --search <query:string>",
    "Search query. Note that if you use this filter against relays which don't support NIP-50, no event will be fetched.",
  )
  .option(
    "-s, --since <time-spec:string>",
    "Fetch only events newer than the timestamp if specified.",
  )
  .option(
    "-u, --until <time-spec:string>",
    "Fetch only events older than the timestamp if specified.",
  )
  .option(
    "-e, --e <event-ids:string[]>",
    "Shorthand for --tag e:<event-ids>",
  )
  .option(
    "-p, --p <pubkeys:string[]>",
    "Shorthand for --tag p:<pubkeys>",
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
    },
  )
  .arguments("<relays...>")
  .action((options, ...args) => {
    executeNosdump(options, args);
  });

export type NosdumpCmdOptions = Parameters<
  Parameters<typeof nosdumpCommand.action>[0]
>[0];

async function executeNosdump(
  cmdOptions: NosdumpCmdOptions,
  cmdArgs: [string, ...string[]],
) {
  const config = await NosdumpConfigRepo.load();

  // read from stdin if it's piped (not terminal)
  const stdinText = Deno.stdin.isTerminal() ? "" : await streamToText(Deno.stdin.readable);

  const currUnixtimeSec = getUnixTime(new Date());

  const parseInputRes = parseInput(
    cmdOptions,
    cmdArgs,
    stdinText,
    currUnixtimeSec,
    config,
  );
  if (!parseInputRes.isOk) {
    const { header, msgs } = parseInputRes.err;
    printErrorHeaderAndMessages(header, msgs);
    Deno.exit(1);
  }
  const { miscOptions, ...params } = parseInputRes.val;

  if (miscOptions.dryRun) {
    console.log("Parsed options:");
    console.log(params);
    Deno.exit(0);
  }

  await dumpNostrEvents(params);
}

type ParseInputErrVal = {
  header: string;
  msgs: string[];
};

export function parseInput(
  cmdOptions: NosdumpCmdOptions,
  cmdArgs: [string, ...string[]],
  stdinText: string,
  currUnixtimeSec: number,
  config: NosdumpConfigRepo,
): Result<NosdumpParams & { miscOptions: MiscOptions }, ParseInputErrVal> {
  // read stdin and parse as a filter
  const parseStdinRes = parseFilterFromText(stdinText, cmdOptions.stdinReq);
  if (!parseStdinRes.isOk) {
    return Result.err({
      header: "Failed to parse stdin as Nostr filter",
      msgs: [parseStdinRes.err.message],
    });
  }
  const [stdinFilter, stdinTimeRange] = parseStdinRes.val;

  // construct filter from options
  const parseOptsRes = parseFilterFromOptions(cmdOptions, currUnixtimeSec);
  if (!parseOptsRes.isOk) {
    return Result.err({
      header: "Failed to parse options",
      msgs: parseOptsRes.err,
    });
  }
  const [optFilter, optTimeRange] = parseOptsRes.val;

  // other options
  const fetchOptions: AllEventsIterOptions = deleteUndefinedProps({
    skipVerification: cmdOptions.skipVerification,
  });
  const miscOptions: MiscOptions = deleteUndefinedProps({
    dryRun: cmdOptions.dryRun,
  });

  // resolve relay specifiers (raw URLs, aliases, or relay set spreads)
  const resolveRelaysRes = config.resolveRelaySpecifiers(cmdArgs);
  if (!resolveRelaysRes.isOk) {
    return Result.err({
      header: "Failed to resolve relay specifiers",
      msgs: resolveRelaysRes.err,
    });
  }

  // filter props specified by CLI option overrides props parsed from stdin.
  return Result.ok({
    relayUrls: resolveRelaysRes.val,
    fetchFilter: { ...stdinFilter, ...optFilter },
    fetchTimeRange: { ...stdinTimeRange, ...optTimeRange },
    fetchOptions,
    miscOptions,
  });
}

/**
 * Parse text as Nostr filter.
 * If `extractFromReq` is true, parse text as REQ message instead and extract the first filter.
 */
const parseFilterFromText = (
  text: string,
  extractFromReq: boolean,
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

    const fetchFilter = deleteUndefinedProps({
      ...restFilter,
      ...tagQuery,
    }) as FetchFilter;

    const fetchTimeRange: FetchTimeRangeFilter = deleteUndefinedProps({
      since,
      until,
    });

    return Result.ok([fetchFilter, fetchTimeRange]);
  } catch (err) {
    if (err instanceof ZodError) {
      return Result.err(fromError(err));
    }
    if (err instanceof Error) {
      return Result.err(err);
    }
    return Result.err(new Error("failed to parse a Nostr filter from the input", { cause: err }));
  }
};

type FilterCmdOpts = Omit<
  NosdumpCmdOptions,
  "dryRun" | "skipVerification" | "stdinReq"
>;

/**
 * Parse command line options as Nostr filter.
 *
 * It recognizes various format (e.g. bech32(note1..., npub1..., etc.) or Nostr URI for event IDs and pubkeys, RFC 3339 datetime or duration("1h", "30m" etc) for timestamps)
 * and reports all errors if there are unacceptable values.
 */
const parseFilterFromOptions = (
  filterOpts: FilterCmdOpts,
  currUnixtimeSec: number,
): Result<[FetchFilter, FetchTimeRangeFilter], string[]> => {
  const errs: string[] = [];
  const fetchFilter = {} as FetchFilter;
  const fetchTimeRange = {} as FetchTimeRangeFilter;

  if (filterOpts.ids !== undefined) {
    const res = mergeResultArray(filterOpts.ids.map((s) => toHexEventId(s)));
    if (res.isOk) {
      fetchFilter.ids = res.val;
    } else {
      errs.push(...res.err);
    }
  }
  if (filterOpts.authors !== undefined) {
    const res = mergeResultArray(filterOpts.authors.map((s) => toHexPubkey(s)));
    if (res.isOk) {
      fetchFilter.authors = res.val;
    } else {
      errs.push(...res.err);
    }
  }
  const tagSpecs = filterOpts.tag ?? [];
  if (filterOpts.e !== undefined) {
    tagSpecs.push({ name: "e", values: filterOpts.e });
  }
  if (filterOpts.p !== undefined) {
    tagSpecs.push({ name: "p", values: filterOpts.p });
  }
  if (tagSpecs.length > 0) {
    const res = mergeTagSpecs(tagSpecs);
    if (res.isOk) {
      Object.assign(fetchFilter, res.val);
    } else {
      errs.push(...res.err);
    }
  }
  fetchFilter.kinds = filterOpts.kinds;
  fetchFilter.search = filterOpts.search;

  if (filterOpts.since !== undefined) {
    const res = parseTimestampSpec(filterOpts.since, currUnixtimeSec);
    if (res.isOk) {
      fetchTimeRange.since = res.val;
    } else {
      errs.push(res.err);
    }
  }
  if (filterOpts.until !== undefined) {
    const res = parseTimestampSpec(filterOpts.until, currUnixtimeSec);
    if (res.isOk) {
      fetchTimeRange.until = res.val;
    } else {
      errs.push(res.err);
    }
  }

  if (errs.length > 0) {
    return Result.err(errs);
  }
  return Result.ok([
    deleteUndefinedProps(fetchFilter),
    deleteUndefinedProps(fetchTimeRange),
  ]);
};

export function kindType({ label, name, value }: ArgumentValue): number {
  const n = Number(value);
  if (isNaN(n) || n < 0 || !Number.isInteger(n)) {
    throw new ValidationError(
      `${label} "${name}" must be non-negative integer, but got "${value}".`,
    );
  }
  return n;
}

type TagSpec = {
  name: string;
  values: string[];
};

const tagSpecRegex = /^(.):(.+)$/;

export function tagSpecType({ value }: ArgumentValue): TagSpec {
  const match = value.match(tagSpecRegex);
  if (match === null) {
    throw new ValidationError(
      `Tag spec "${value}" is malformed. It must follow "<tag name>:<comma separated list of tag values>" format.`,
    );
  }
  const [, tagName, tagVals] = match;
  return {
    name: tagName,
    values: tagVals.split(",").map((v) => v.trim()),
  };
}

const mergeTagSpecs = (
  tagSpecs: TagSpec[],
): Result<Record<string, string[]>, string[]> => {
  const mergedByName = new Map<string, Set<string>>();
  for (const { name, values } of tagSpecs) {
    const acc = mergedByName.get(name) ?? new Set();
    for (const v of values) {
      acc.add(v);
    }
    mergedByName.set(name, acc);
  }

  const errs: string[] = [];
  const tagQueries = {} as Record<string, string[]>;
  for (const [tagName, values] of mergedByName) {
    switch (tagName) {
      case "e": {
        const res = mergeResultArray([...values].map((s) => toHexEventId(s)));
        if (res.isOk) {
          tagQueries["#e"] = res.val;
        } else {
          errs.push(...res.err);
        }
        break;
      }
      case "p": {
        const res = mergeResultArray([...values].map((s) => toHexPubkey(s)));
        if (res.isOk) {
          tagQueries["#p"] = res.val;
        } else {
          errs.push(...res.err);
        }
        break;
      }
      default:
        tagQueries[`#${tagName}`] = [...values];
        break;
    }
  }

  if (errs.length > 0) {
    return Result.err(errs);
  }
  return Result.ok(tagQueries);
};

const deleteUndefinedProps = <T extends Record<string, unknown>>(obj: T): T => {
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
  z.string().array(),
);

const regex32BytesHex = /^[a-f0-9]{64}$/;

const stripNostrURIPrefix = (s: string): string => s.startsWith("nostr:") ? s.replace("nostr:", "") : s;

const toHexEventId = (s: string): Result<string, string> => {
  if (regex32BytesHex.test(s)) {
    return Result.ok(s);
  }

  try {
    const decoded = nip19.decode(stripNostrURIPrefix(s));
    switch (decoded.type) {
      case "note":
        return Result.ok(decoded.data);
      case "nevent":
        return Result.ok(decoded.data.id);
      default:
        return Result.err(`invalid event ID specifier: ${s}`);
    }
  } catch {
    return Result.err(`invalid event ID specifier: ${s}`);
  }
};

const toHexPubkey = (s: string): Result<string, string> => {
  if (regex32BytesHex.test(s)) {
    return Result.ok(s);
  }

  try {
    const decoded = nip19.decode(stripNostrURIPrefix(s));
    switch (decoded.type) {
      case "npub":
        return Result.ok(decoded.data);
      case "nprofile":
        return Result.ok(decoded.data.pubkey);
      default:
        return Result.err(`invalid pubkey specifier: ${s}`);
    }
  } catch {
    return Result.err(`invalid pubkey specifier: ${s}`);
  }
};

/**
 * try to parse the string as a "timestamp specification", one of:
 *
 * - unixtime in second
 * - ISO 8601 date(-time) string
 * - duration string (to specify relative time)
 */
const parseTimestampSpec = (
  tsSpec: string,
  currUnixtime: number,
): Result<number, string> => {
  // try to parse as unixtime
  if (/^\d+$/.test(tsSpec)) {
    return Result.ok(Number(tsSpec));
  }

  // try to parse as ISO 8601 (maybe RFC 3339?) date string in local timezone
  const parsedISODate = parseISO(tsSpec);
  if (isDateValid(parsedISODate)) {
    return Result.ok(getUnixTime(parsedISODate));
  }

  // try to parse as duration string. if it's valid duration, return (current time) - (the duration).
  const parsedDurationSec = Duration.fromString(tsSpec, false).asSeconds();
  if (parsedDurationSec > 0) {
    return Result.ok(currUnixtime - Math.floor(parsedDurationSec));
  }

  return Result.err(`invalid timestamp specifier: ${tsSpec}`);
};

const mergeResultArray = <T, E>(results: Result<T, E>[]): Result<T[], E[]> => {
  return results.reduce(
    (acc, r) => {
      if (acc.isOk) {
        if (r.isOk) {
          return Result.ok([...acc.val, r.val]);
        } else {
          return Result.err([r.err]);
        }
      } else {
        if (r.isOk) {
          return acc;
        } else {
          return Result.err([...acc.err, r.err]);
        }
      }
    },
    { isOk: true, val: [] } as Result<T[], E[]>,
  );
};
