# nosdump

[![deno.land](https://shield.deno.dev/x/nosdump)](https://deno.land/x/nosdump)

A command line tool which dumps events stored in
[Nostr](https://github.com/nostr-protocol/nostr) relays, in
[JSON-Lines](https://jsonlines.org/) format (also known as
[NDJSON](http://ndjson.org/)).

## Installation

### With `deno install` (recommended)

[Install Deno](https://deno.land/manual/getting_started/installation) and run:

```sh
deno install --allow-net https://deno.land/x/nosdump@0.4.2/main.ts
```

### With pre-built binaries (easy)

Download pre-built binaries from the
[releases](https://github.com/jiftechnify/nosdump/releases) page.

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
nosdump --authors <your pubkey> wss://relay.damus.io > dump.jsonl
```

Dump all reply events to you:

```sh
nosdump --kinds 1 --tag p:<your pubkey> wss://relay.damus.io > dump.jsonl
```

Dump all events published in the past 24 hours:

```sh
nosdump --since 24h wss://relay.damus.io > dump.jsonl
```

### Various input formats

You can use following formats to refer **events**:

- Hex event ID
- NIP-19 identifer for event (`note1...` / `nevent1...`)
- `nostr:` URI for event (`nostr:note1...` / `nostr:nevent1...`)

```sh
# They are all valid!
nosdump --ids c824e1184d4f3660097d8299632ac723f5bfaea1eb569867f4924f2f0713a321 wss://relay.damus.io
nosdump --ids note1eqjwzxzdfumxqztas2vkx2k8y06mlt4padtfsel5jf8j7pcn5vsssd2g8m wss://relay.damus.io
nosdump --ids nevent1qqsvsf8prpx57dnqp97c9xtr9trj8adl46s7k45cvl6fyne0quf6xggq2q33g wss://relay.damus.io
nosdump --ids nostr:note1eqjwzxzdfumxqztas2vkx2k8y06mlt4padtfsel5jf8j7pcn5vsssd2g8m wss://relay.damus.io
nosdump --ids nostr:nevent1qqsvsf8prpx57dnqp97c9xtr9trj8adl46s7k45cvl6fyne0quf6xggq2q33g wss://relay.damus.io

# Even in e-tag qeury!
nosdump --tag e:nostr:note1eqjwzxzdfumxqztas2vkx2k8y06mlt4padtfsel5jf8j7pcn5vsssd2g8m wss://relay.damus.io
```

You can use following formats to refer **pubkeys**:

- Hex pubkey
- NIP-19 identifier for pubkey (`npub1...` / `nprofile1...`)
- `nostr:` URI for pubkey (`nostr:npub1...`/ `nostr:nprofile1...`)

```sh
# They are all valid!
nosdump --author d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44 wss://relay.damus.io
nosdump --author npub168ghgug469n4r2tuyw05dmqhqv5jcwm7nxytn67afmz8qkc4a4zqsu2dlc wss://relay.damus.io
nosdump --author nprofile1qqsdr5t5wy2aze63497z886xastsx2fv8dlfnz9ea0w5a3rstv2763qgyw5f5 wss://relay.damus.io
nosdump --author nostr:npub168ghgug469n4r2tuyw05dmqhqv5jcwm7nxytn67afmz8qkc4a4zqsu2dlc wss://relay.damus.io
nosdump --author nostr:nprofile1qqsdr5t5wy2aze63497z886xastsx2fv8dlfnz9ea0w5a3rstv2763qgyw5f5 wss://relay.damus.io

# Even in p-tag query!
nosdump --tag p:nostr:npub168ghgug469n4r2tuyw05dmqhqv5jcwm7nxytn67afmz8qkc4a4zqsu2dlc wss://relay.damus.io
```

You can use following formats to specify **timestamps**:

- Unixtime in seconds
- ISO 8601 datetime string (e.g. `2023-07-19T23:06:16`)
  - If you don't specify a timezone explicitly, it will be interpreted as
    **local time**.
- Relative time represented by a duration string (e.g. `6h`, means 6 hours ago)
  - It uses [duration.js](https://deno.land/x/durationjs@v4.1.0) to parse
    duration strings.

```sh
# Unixtime in seconds
nosdump --since 1689768000 --until 1689778800 wss://relay.damus.io

# Datetime string (UTC)
nosdump --since 2023-07-19T12:00:00Z --until 2023-07-19T15:00:00Z wss://relay.damus.io

# Datetime string (local time)
nosdump --since 2023-07-19T12:00:00 --until 2023-07-19T15:00:00 wss://relay.damus.io

# Relative time: since an hour ago, until 30 minutes ago
nosdump --since 1h --until 30m wss://relay.damus.io
```

### Read a filter from stdin

nosdump parses stdin as a Nostr filter by default, so the following command
works as expected:

```sh
echo '{ "kinds": [1, 7] }' | nosdump wss://relay.damus.io > dump.jsonl
```

If `-R` (`--stdin-req`) flag is specified, nosdump parses stdin as _a REQ
message_ instead and extract the _first_ filter from it.

This feature makes nosdump interoperable with
[nostreq](https://github.com/blakejakopovic/nostreq):

```sh
nostreq --kinds 1,7 | nosdump -R wss://relay.damus.io > dump.jsonl
```

> **Note**
>
> If a filter read from stdin and a filter specified by command line options
> have the same property, **the latter takes precedence of the former**.

## Usage

```
Usage:   nosdump [options...] <relay-URLs...>
Version: 0.4.2

Description:

  A tool to dump events stored in Nostr relays

Options:

  -h, --help     - Show this help.
  -V, --version  - Show the version number for this program.
  -n, --dry-run  - Just print parsed options instead of running actual dumping.  (Default: false)

Filter options:

  --ids      <ids>        - Comma separated list of target event ids.
  --authors  <authors>    - Comma separated list of target author's pubkeys.
  --kinds    <kinds>      - Comma separated list of target event kinds.
  --tag      <tag-spec>   - Tag query specifier. Syntax: <tag name>:<comma separated tag values>.
                            You can specify multiple --tag options.
  --search   <query>      - Search query. 
                            Note that if you use this filter against relays which don't support NIP-50, no event will be fetched.
  --since    <time-spec>  - Fetch only events newer than the timestamp if specified.
  --until    <time-spec>  - Fetch only events older than the timestamp if specified.

Fetch options:

  --skip-verification  - Skip event signature verification.  (Default: false)

Input options:

  -R, --stdin-req  - Read stdin as a Nostr REQ message and extract the first filter from it.  (Default: false)

Commands:

  completions  - Generate shell completions.
  upgrade      - Upgrade nosdump executable to latest or given version.
```
