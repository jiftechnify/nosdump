# nosdump  

[![deno.land shield]][deno.land link]

[deno.land shield]: https://shield.deno.dev/x/nosdump
[deno.land link]: https://deno.land/x/nosdump

A command line tool which dumps events stored in Nostr relays, in [JSON-Lines](https://jsonlines.org/) format (also known as [NDJSON](http://ndjson.org/)).

## Installation
[Install Deno](https://deno.land/manual/getting_started/installation) and run:

```sh
deno install --allow-net https://deno.land/x/nosdump@0.1.0/main.ts
```

## Usage
```sh
nosudmp <relay URLs>
```

## Example

Dumping all events stored in the relay `wss://relay.damus.io` to a file:

```sh
nosdump wss://relay.damus.io > dump.jsonl
```
