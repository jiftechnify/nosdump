# nosdump

[![JSR](https://jsr.io/badges/@jiftechnify/nosdump)](https://jsr.io/@jiftechnify/nosdump)
[![deno.land](https://shield.deno.dev/x/nosdump)](https://deno.land/x/nosdump)

A command line tool which dumps events stored in [Nostr](https://github.com/nostr-protocol/nostr) relays, in
[JSON-Lines](https://jsonlines.org/) format (also known as [NDJSON](http://ndjson.org/)).

## Installation

### With `deno install` (recommended)

[Install Deno](https://deno.land/manual/getting_started/installation) and run:

```sh
deno install -A "jsr:@jiftechnify/nosdump@0.5.0"
```

### With Pre-built Binaries (easy)

Download pre-built binaries from the [releases](https://github.com/jiftechnify/nosdump/releases) page.

## Basic Usage

Dump all events stored in the relay `wss://relay.damus.io`:

```sh
nosdump wss://relay.damus.io > dump.jsonl
```

Dump all text events (kind:1) and reaction events (kind:7):

```sh
nosdump -k 1,7 wss://relay.damus.io > dump.jsonl
```

Dump all your events:

```sh
nosdump -a ${YOUR_PUBKEY} wss://relay.damus.io > dump.jsonl
```

Dump all reply events to you:

```sh
nosdump -k 1 -p ${YOUR_PUBKEY} wss://relay.damus.io > dump.jsonl
```

Dump all events published in the past 24 hours:

```sh
nosdump -s 24h wss://relay.damus.io > dump.jsonl
```

## Features

### Shorthands for Relay URLs

You may feel cumbersome when specifying relays with full URLs. It's time **relay aliases** and **relay sets** come in handy!

#### Relay Aliases

You set aliases for relay URLs:

```sh
nosdump alias damus wss://relay.damus.io
nosdump alias welcome wss://welcome.nostr.wine
```

then you refer to relays with aliases:

```sh
# Dump all text events from wss://relay.damus.io & wss://welcome.nostr.wine
nosdump --kinds 1 damus welcome
```

To reveal all the subcommands for the relay aliases management, run `nosdump alias --help`.

#### Relay Sets

You group multiple relays into "relay sets":

```sh
nosdump relay-set add mega-relays wss://relay.damus.io wss://nos.lol
nosdump relay-set add mega-relays wss://relay.nostr.band
```

then, with the **`...<relay-set>`** syntax, you specify all the relays in the relay set as dump targets:

```sh
# Dump all text events posted in last 10 minutes from "mega relays"!
nosdump --kinds 1 --since 10m ...mega-relays
```

To reveal all the subcommands for the relay sets management, run `nosdump relay-set --help`.

#### Put Them Together

Of course, you can use raw relay URLs, relay aliases and relay sets together to specify relays to dump events!

```sh
nosdump --kinds 1 --since 10m wss://nrelay.c-stellar.net welcome ...mega-relays
```

> **Note**
>
> Configured relay aliases and relay sets are saved in a config file on your local file system. The location of the config file is
> `${CONFIG_DIR}/nosdump/config.yaml`, where `${CONFIG_DIR}` is
> [the standard directory for user-specific configs](https://github.com/rivy/js.xdg-portable?tab=readme-ov-file#xdgconfig-string) on the
> platform you use.

### Various Input Formats

You can use following formats to refer **events by ids**:

- Hex event ID
- NIP-19 identifier for event (`note1...` / `nevent1...`)
- `nostr:` URI for event (`nostr:note1...` / `nostr:nevent1...`)

```sh
# They are all valid!
nosdump -i c824e1184d4f3660097d8299632ac723f5bfaea1eb569867f4924f2f0713a321 wss://relay.damus.io
nosdump -i note1eqjwzxzdfumxqztas2vkx2k8y06mlt4padtfsel5jf8j7pcn5vsssd2g8m wss://relay.damus.io
nosdump -i nevent1qqsvsf8prpx57dnqp97c9xtr9trj8adl46s7k45cvl6fyne0quf6xggq2q33g wss://relay.damus.io
nosdump -i nostr:note1eqjwzxzdfumxqztas2vkx2k8y06mlt4padtfsel5jf8j7pcn5vsssd2g8m wss://relay.damus.io
nosdump -i nostr:nevent1qqsvsf8prpx57dnqp97c9xtr9trj8adl46s7k45cvl6fyne0quf6xggq2q33g wss://relay.damus.io

# Even in e-tag qeury!
nosdump -e nostr:note1eqjwzxzdfumxqztas2vkx2k8y06mlt4padtfsel5jf8j7pcn5vsssd2g8m wss://relay.damus.io
```

You can use following formats to refer **pubkeys**:

- Hex pubkey
- NIP-19 identifier for pubkey (`npub1...` / `nprofile1...`)
- `nostr:` URI for pubkey (`nostr:npub1...`/ `nostr:nprofile1...`)

```sh
# They are all valid!
nosdump -a d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44 wss://relay.damus.io
nosdump -a npub168ghgug469n4r2tuyw05dmqhqv5jcwm7nxytn67afmz8qkc4a4zqsu2dlc wss://relay.damus.io
nosdump -a nprofile1qqsdr5t5wy2aze63497z886xastsx2fv8dlfnz9ea0w5a3rstv2763qgyw5f5 wss://relay.damus.io
nosdump -a nostr:npub168ghgug469n4r2tuyw05dmqhqv5jcwm7nxytn67afmz8qkc4a4zqsu2dlc wss://relay.damus.io
nosdump -a nostr:nprofile1qqsdr5t5wy2aze63497z886xastsx2fv8dlfnz9ea0w5a3rstv2763qgyw5f5 wss://relay.damus.io

# Even in p-tag query!
nosdump -p nostr:npub168ghgug469n4r2tuyw05dmqhqv5jcwm7nxytn67afmz8qkc4a4zqsu2dlc wss://relay.damus.io
```

You can use following formats to specify **timestamps**:

- Unixtime in seconds
- ISO 8601 datetime string (e.g. `2023-07-19T23:06:16`)
  - If you don't specify a timezone explicitly, it will be interpreted as **local time**.
- Relative time represented by a duration string (e.g. `6h`, means 6 hours ago)
  - It uses [duration.js](https://jsr.io/@retraigo/duration) to parse duration strings.

```sh
# Unixtime in seconds
nosdump -s 1689768000 -u 1689778800 wss://relay.damus.io

# Datetime string (UTC)
nosdump -s 2023-07-19T12:00:00Z -u 2023-07-19T15:00:00Z wss://relay.damus.io

# Datetime string (local time)
nosdump -s 2023-07-19T12:00:00 -u 2023-07-19T15:00:00 wss://relay.damus.io

# Relative time: since an hour ago, until 30 minutes ago
nosdump -s 1h -u 30m wss://relay.damus.io
```

### Read a Filter from Stdin

nosdump parses stdin as a Nostr filter by default, so the following command works as expected:

```sh
echo '{ "kinds": [1, 7] }' | nosdump wss://relay.damus.io > dump.jsonl
```

If `-R` (`--stdin-req`) flag is specified, nosdump parses stdin as _a REQ message_ instead and extract the _first_ filter from it.

This feature makes nosdump interoperable with [nostreq](https://github.com/blakejakopovic/nostreq):

```sh
nostreq --kinds 1,7 | nosdump -R wss://relay.damus.io > dump.jsonl
```

> **Note**
>
> If a filter read from stdin and a filter specified by command line options have the same property, **the latter takes precedence of the
> former**.

## Synopsis

```
Usage:   nosdump [options...] <relays...>
Version: 0.5.0                           

Description:

  A tool to dump events stored in Nostr relays

Options:

  -h, --help     - Show this help.                                                               
  -V, --version  - Show the version number for this program.                                     
  -n, --dry-run  - Just print parsed options instead of running actual dumping.  (Default: false)

Filter options:

  -i, --ids      <ids>        - Comma separated list of target event ids.                                      
  -a, --authors  <authors>    - Comma separated list of target author's pubkeys.                               
  -k, --kinds    <kinds>      - Comma separated list of target event kinds.                                    
  -t, --tag      <tag-spec>   - Tag query specifier. Syntax: <tag name>:<comma separated tag values>. You can  
                                specify multiple --tag options.                                                
  -S, --search   <query>      - Search query. Note that if you use this filter against relays which don't      
                                support NIP-50, no event will be fetched.                                      
  -s, --since    <time-spec>  - Fetch only events newer than the timestamp if specified.                       
  -u, --until    <time-spec>  - Fetch only events older than the timestamp if specified.                       
  -e, --e        <event-ids>  - Shorthand for --tag e:<event-ids>                                              
  -p, --p        <pubkeys>    - Shorthand for --tag p:<pubkeys>                                                

Fetch options:

  --skip-verification  - Skip event signature verification.  (Default: false)

Input options:

  -R, --stdin-req  - Read stdin as a Nostr REQ message and extract the first filter from it.  (Default: false)

Commands:

  completions                              - Generate shell completions.                           
  upgrade                                  - Upgrade nosdump executable to latest or given version.
  relay-alias, alias  [alias] [relay-URL]  - Manage relay aliases.                                 
  relay-set, rset     [name] [relays...]   - Manage relay sets.
```
