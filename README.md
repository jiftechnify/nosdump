# nosdump  

[![deno.land shield]][deno.land link]

[deno.land shield]: https://shield.deno.dev/x/nosdump
[deno.land link]: https://deno.land/x/nosdump

A command line tool which dumps events stored in [Nostr](https://github.com/nostr-protocol/nostr) relays, in [JSON-Lines](https://jsonlines.org/) format (also known as [NDJSON](http://ndjson.org/)).

## Installation
[Install Deno](https://deno.land/manual/getting_started/installation) and run:

```sh
deno install --allow-net https://deno.land/x/nosdump@0.2.0/main.ts
```

## Usage
```
Usage:   nosdump [options...] <relay-URLs...>
Version: 0.2.0                               

Description:

  A Tool to dump events stored in Nostr relays

Options:

  -h, --help     - Show this help.                            
  -V, --version  - Show the version number for this program.  

Filter options:

  --ids      <ids>       - Comma separated list of target event ids.                                      
  --authors  <authors>   - Comma separated list of target author's pubkeys.                               
  --kinds    <kinds>     - Comma separated list of target event kinds.                                    
  --tag      <tag-spec>  - Tag query specifier. Syntax: <tag name>:<comma separated tag values>. You can  
                           specify multiple --tag options.                                                
  --search   <query>     - Search query. Note that if you use this filter against relays which don't      
                           support NIP-50, no event will be fetched.                                      
  --since    <unixtime>  - If specified, it fetches only events newer than the timestamp.                 
  --until    <unixtime>  - If specified, it fetches only events older than the timestamp.                 

Fetch options:

  --skip-verification  - If enabled, it skips event signature verification.  
```

## Examples

To dump all events stored in the relay `wss://relay.damus.io` to a file:

```sh
nosdump wss://relay.damus.io > dump.jsonl
```

To dump all text events (kind:1) and reaction events (kind:7):

```sh
nosdump --kinds 1,7 wss://relay.damus.io > dump.jsonl
```

To dump all your events:

```sh
nosdump --authors <your pubkey (hex)> wss://relay.damus.io > dump.jsonl
```

To dump all reply events to you:

```sh
nosdump --kinds 1 --tag p:<your pubkey (hex)> wss://relay.damus.io > dump.jsonl
```
