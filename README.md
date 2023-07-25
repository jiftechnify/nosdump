# nosdump

[![deno.land shield]][deno.land link]

[deno.land shield]: https://shield.deno.dev/x/nosdump
[deno.land link]: https://deno.land/x/nosdump

A command line tool which dumps events stored in [Nostr](https://github.com/nostr-protocol/nostr) relays, in [JSON-Lines](https://jsonlines.org/) format (also known as [NDJSON](http://ndjson.org/)).

## Installation
[Install Deno](https://deno.land/manual/getting_started/installation) and run:

```sh
deno install --allow-net https://deno.land/x/nosdump@0.3.0/main.ts
```

## Examples
### Basics

Dump all events stored in the relay `wss://relay.damus.io` to a file:

```sh
nosdump wss://relay.damus.io > dump.jsonl
```

Dump all text events (kind:1) and reaction events (kind:7):

```sh
nosdump --kinds 1,7 wss://relay.damus.io > dump.jsonl
```

Dump all your events:

```sh
nosdump --authors <your pubkey (hex)> wss://relay.damus.io > dump.jsonl
```

Dump all reply events to you:

```sh
nosdump --kinds 1 --tag p:<your pubkey (hex)> wss://relay.damus.io > dump.jsonl
```

### Read a filter from stdin
nosdump parses stdin as a Nostr filter by default, so the following command works as expected:

```sh
echo '{ "kinds": [1, 7] }' | nosdump wss://relay.damus.io > dump.jsonl
```

If `-R` (`--stdin-req`) flag is specified, nosdump parses stdin as *a REQ message* instead and extract the *first* filter from it.

This feature makes nosdump interoperable with [nostreq](https://github.com/blakejakopovic/nostreq):

```sh
nostreq --kinds 1,7 | nosdump -R wss://relay.damus.io > dump.jsonl
```

> **Note**
>
> If a filter read from stdin and a filter specified by command line options have the same property, **the latter takes precedence of the former**.


## Usage
```
Usage:   nosdump [options...] <relay-URLs...>
Version: 0.3.0

Description:

  A tool to dump events stored in Nostr relays

Options:

  -h, --help     - Show this help.
  -V, --version  - Show the version number for this program.
  -n, --dry-run  - Just print parsed options instead of running actual dumping.  (Default: false)

Filter options:

  --ids      <ids>       - Comma separated list of target event ids.
  --authors  <authors>   - Comma separated list of target author's pubkeys.
  --kinds    <kinds>     - Comma separated list of target event kinds.
  --tag      <tag-spec>  - Tag query specifier. Syntax: <tag name>:<comma separated tag values>. You can
                           specify multiple --tag options.
  --search   <query>     - Search query. Note that if you use this filter against relays which don't
                           support NIP-50, no event will be fetched.
  --since    <unixtime>  - Fetch only events newer than the timestamp if specified.
  --until    <unixtime>  - Fetch only events older than the timestamp if specified.

Fetch options:

  --skip-verification  - Skip event signature verification.  (Default: false)

Input options:

  -R, --stdin-req  - Read stdin as a Nostr REQ message and extract the first filter from it.  (Default: false)
```
