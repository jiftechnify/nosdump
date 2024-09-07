import {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertThrows,
} from "@std/assert";
import { parseISO } from "date-fns";

import { kindType, parseInput, tagSpecType } from "./command.ts";
import type { NosdumpCmdOptions } from "./command.ts";

const defaultCmdOpts: NosdumpCmdOptions = {
  dryRun: false,
  skipVerification: false,
  stdinReq: false,
};

const dummyRelayUrls: [string] = ["wss://example.com"];

Deno.test("parseInput", async (t) => {
  await t.step("arguments as relay URLs", () => {
    const res = parseInput(
      defaultCmdOpts,
      ["wss://foo.example.com", "wss://bar.example.com"],
      "",
      0,
    );

    assert(res.isOk);
    assertEquals(res.val.relayUrls, [
      "wss://foo.example.com",
      "wss://bar.example.com",
    ]);
  });

  await t.step("command options filters", () => {
    const res = parseInput(
      {
        ...defaultCmdOpts,
        ids: [
          "c824e1184d4f3660097d8299632ac723f5bfaea1eb569867f4924f2f0713a321",
        ],
        authors: [
          "d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
        ],
        kinds: [1],
        tag: [
          {
            name: "e",
            values: [
              "c824e1184d4f3660097d8299632ac723f5bfaea1eb569867f4924f2f0713a321",
            ],
          },
          {
            name: "p",
            values: [
              "d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
            ],
          },
          {
            name: "t",
            values: ["nostr", "zap"],
          },
          {
            name: "a",
            values: [
              "30023:d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44:somelongpost",
            ],
          },
        ],
        e: ["bc118fccbaa378c89ef59f7b4478f885d75233142f62e116ba074f6010c90171"],
        p: ["a33512ba0e57f11da0b909404e2b651f5831ad20b121dbc3a29eb66aaefe283a"],
        search: "pura vida",
        since: "100",
        until: "200",
      },
      dummyRelayUrls,
      "",
      0,
    );

    assert(res.isOk);
    assertEquals(res.val.fetchFilter, {
      ids: ["c824e1184d4f3660097d8299632ac723f5bfaea1eb569867f4924f2f0713a321"],
      authors: [
        "d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
      ],
      kinds: [1],
      search: "pura vida",
      // e-tag/p-tag filters from --tag option and -e/-p options should be merged
      "#e": [
        "c824e1184d4f3660097d8299632ac723f5bfaea1eb569867f4924f2f0713a321",
        "bc118fccbaa378c89ef59f7b4478f885d75233142f62e116ba074f6010c90171",
      ],
      "#p": [
        "d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
        "a33512ba0e57f11da0b909404e2b651f5831ad20b121dbc3a29eb66aaefe283a",
      ],
      "#t": ["nostr", "zap"],
      "#a": [
        "30023:d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44:somelongpost",
      ],
    });
    assertEquals(res.val.fetchTimeRange, {
      since: 100,
      until: 200,
    });
  });

  await t.step("parse stdin as filters", () => {
    const res = parseInput(
      defaultCmdOpts,
      dummyRelayUrls,
      JSON.stringify({
        ids: [
          "c824e1184d4f3660097d8299632ac723f5bfaea1eb569867f4924f2f0713a321",
        ],
        authors: [
          "d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
        ],
        kinds: [1],
        search: "pura vida",
        "#e": [
          "c824e1184d4f3660097d8299632ac723f5bfaea1eb569867f4924f2f0713a321",
        ],
        "#p": [
          "d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
        ],
        "#t": ["nostr", "zap"],
        "#a": [
          "30023:d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44:somelongpost",
        ],
        since: 100,
        until: 200,
      }),
      0,
    );

    assert(res.isOk);
    assertEquals(res.val.fetchFilter, {
      ids: ["c824e1184d4f3660097d8299632ac723f5bfaea1eb569867f4924f2f0713a321"],
      authors: [
        "d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
      ],
      kinds: [1],
      search: "pura vida",
      "#e": [
        "c824e1184d4f3660097d8299632ac723f5bfaea1eb569867f4924f2f0713a321",
      ],
      "#p": [
        "d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
      ],
      "#t": ["nostr", "zap"],
      "#a": [
        "30023:d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44:somelongpost",
      ],
    });
    assertEquals(res.val.fetchTimeRange, {
      since: 100,
      until: 200,
    });
  });

  await t.step("parse stdin as REQ if --stdin-req", () => {
    const res = parseInput(
      { ...defaultCmdOpts, stdinReq: true },
      dummyRelayUrls,
      JSON.stringify([
        "REQ",
        "subid",
        {
          ids: [
            "c824e1184d4f3660097d8299632ac723f5bfaea1eb569867f4924f2f0713a321",
          ],
          authors: [
            "d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
          ],
          kinds: [1],
        },
      ]),
      0,
    );

    assert(res.isOk);
    assertEquals(res.val.fetchFilter, {
      ids: ["c824e1184d4f3660097d8299632ac723f5bfaea1eb569867f4924f2f0713a321"],
      authors: [
        "d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
      ],
      kinds: [1],
    });
  });

  await t.step("command options take precedence of stdin", () => {
    const res = parseInput(
      {
        ...defaultCmdOpts,
        kinds: [1, 7],
        since: "100",
      },
      dummyRelayUrls,
      JSON.stringify({
        authors: [
          "d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
        ],
        kinds: [0, 3],
        since: 50,
        until: 200,
      }),
      0,
    );

    assert(res.isOk);
    assertEquals(res.val.fetchFilter, {
      authors: [
        "d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
      ],
      kinds: [1, 7], // conflicting prop: command option should win
    });
    assertEquals(res.val.fetchTimeRange, {
      since: 100, // conflicting prop: command option should win
      until: 200,
    });
  });

  await t.step("tag queries merging", () => {
    const res = parseInput(
      {
        ...defaultCmdOpts,
        tag: [
          { name: "t", values: ["a", "b"] },
          { name: "r", values: ["https://foo.example.com"] },
          { name: "t", values: ["c", "b"] },
          {
            name: "r",
            values: ["https://bar.example.com", "https://baz.example.com"],
          },
        ],
      },
      dummyRelayUrls,
      "",
      0,
    );

    assert(res.isOk);

    const { fetchFilter } = res.val;
    assert(fetchFilter["#t"] !== undefined);
    assertArrayIncludes(fetchFilter["#t"], ["a", "b", "c"]);

    assert(fetchFilter["#r"] !== undefined);
    assertArrayIncludes(fetchFilter["#r"], [
      "https://foo.example.com",
      "https://bar.example.com",
      "https://baz.example.com",
    ]);
  });

  /* event ID formats */
  const eventId = {
    hex: "c824e1184d4f3660097d8299632ac723f5bfaea1eb569867f4924f2f0713a321",
    note: "note1eqjwzxzdfumxqztas2vkx2k8y06mlt4padtfsel5jf8j7pcn5vsssd2g8m",
    // nevent with relay hint
    nevent:
      "nevent1qqsvsf8prpx57dnqp97c9xtr9trj8adl46s7k45cvl6fyne0quf6xggprfmhxue69uhkuun9d3shjtnr94ehgetvd3shytnwv46qhq36uw",
  };
  await t.step("NIP-19 `note` as event ID", () => {
    const res = parseInput(
      {
        ...defaultCmdOpts,
        ids: [eventId.note],
        tag: [
          {
            name: "e",
            values: [`nostr:${eventId.note}`], // nostr: URI
          },
        ],
      },
      dummyRelayUrls,
      "",
      0,
    );

    assert(res.isOk);
    assertEquals(res.val.fetchFilter, {
      ids: [eventId.hex],
      "#e": [eventId.hex],
    });
  });
  await t.step("NIP-19 `nevent` as event ID", () => {
    const res = parseInput(
      {
        ...defaultCmdOpts,
        ids: [eventId.nevent],
        tag: [
          {
            name: "e",
            values: [`nostr:${eventId.nevent}`], // nostr: URI
          },
        ],
      },
      dummyRelayUrls,
      "",
      0,
    );

    assert(res.isOk);
    assertEquals(res.val.fetchFilter, {
      ids: [eventId.hex],
      "#e": [eventId.hex],
    });
  });

  /* pubkey formats */
  const pubkey = {
    hex: "d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
    npub: "npub168ghgug469n4r2tuyw05dmqhqv5jcwm7nxytn67afmz8qkc4a4zqsu2dlc",
    // nprofile with relay hint
    nprofile:
      "nprofile1qqsdr5t5wy2aze63497z886xastsx2fv8dlfnz9ea0w5a3rstv2763qprfmhxue69uhkuun9d3shjtnr94ehgetvd3shytnwv46q3ujeza",
  };
  await t.step("NIP-19 `npub` as pubkey", () => {
    const res = parseInput(
      {
        ...defaultCmdOpts,
        authors: [pubkey.npub],
        tag: [
          {
            name: "p",
            values: [`nostr:${pubkey.npub}`], // nostr: URI
          },
        ],
      },
      dummyRelayUrls,
      "",
      0,
    );

    assert(res.isOk);
    assertEquals(res.val.fetchFilter, {
      authors: [pubkey.hex],
      "#p": [pubkey.hex],
    });
  });
  await t.step("NIP-19 `nprofile` as event ID", () => {
    const res = parseInput(
      {
        ...defaultCmdOpts,
        authors: [pubkey.nprofile],
        tag: [
          {
            name: "p",
            values: [`nostr:${pubkey.nprofile}`], // nostr: URI
          },
        ],
      },
      dummyRelayUrls,
      "",
      0,
    );

    assert(res.isOk);
    assertEquals(res.val.fetchFilter, {
      authors: [pubkey.hex],
      "#p": [pubkey.hex],
    });
  });

  /* timestamp formats */
  const utcUnixtimes = {
    newYear2022: 1640995200,
    newYear2023: 1672531200,
  };
  await t.step("date string with trailing 'Z' (UTC) as timestamp", () => {
    const res = parseInput(
      {
        ...defaultCmdOpts,
        since: "2022-01-01T00:00:00Z",
        until: "2023-01-01T00:00:00Z",
      },
      dummyRelayUrls,
      "",
      0,
    );

    assert(res.isOk);
    assertEquals(res.val.fetchTimeRange, {
      since: utcUnixtimes.newYear2022,
      until: utcUnixtimes.newYear2023,
    });
  });

  await t.step("date string with offset as timestamp", () => {
    const res = parseInput(
      {
        ...defaultCmdOpts,
        since: "2022-01-01T00:00:00+09:00",
        until: "2023-01-01T00:00:00+09:00",
      },
      dummyRelayUrls,
      "",
      0,
    );

    assert(res.isOk);
    assertEquals(res.val.fetchTimeRange, {
      since: utcUnixtimes.newYear2022 - 9 * 60 * 60,
      until: utcUnixtimes.newYear2023 - 9 * 60 * 60,
    });
  });

  await t.step(
    "date string without unixtime as timestamp in local time",
    () => {
      const res = parseInput(
        {
          ...defaultCmdOpts,
          since: "2022-01-01T00:00:00",
          until: "2023-01-01T00:00:00",
        },
        dummyRelayUrls,
        "",
        0,
      );
      const sinceOffsetSec =
        parseISO("2022-01-01T00:00:00").getTimezoneOffset() * 60;
      const untilOffsetSec =
        parseISO("2023-01-01T00:00:00").getTimezoneOffset() * 60;

      assert(res.isOk);
      assertEquals(res.val.fetchTimeRange, {
        since: utcUnixtimes.newYear2022 + sinceOffsetSec,
        until: utcUnixtimes.newYear2023 + untilOffsetSec,
      });
    },
  );

  await t.step("relative time as timestamp", () => {
    const now = 1600000000;
    const res = parseInput(
      {
        ...defaultCmdOpts,
        since: "1d",
        until: "1h30m",
      },
      dummyRelayUrls,
      "",
      now,
    );

    assert(res.isOk);
    assertEquals(res.val.fetchTimeRange, {
      since: now - 86400, // 1 day = 86400 secs
      until: now - 5400, // 1 hour 30 mins = 5400 secs
    });
  });

  await t.step("rejects malformed event ids", () => {
    const inputs = [
      "deadbeef", // too short
      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // not a hex string
      "npub168ghgug469n4r2tuyw05dmqhqv5jcwm7nxytn67afmz8qkc4a4zqsu2dlc", // npub is not for event ID
      "nprofile1qqsdr5t5wy2aze63497z886xastsx2fv8dlfnz9ea0w5a3rstv2763qprfmhxue69uhkuun9d3shjtnr94ehgetvd3shytnwv46q3ujeza", // nprofile is not for event ID
    ];
    for (const i of inputs) {
      const res = parseInput(
        { ...defaultCmdOpts, ids: [i] },
        dummyRelayUrls,
        "",
        0,
      );
      assert(!res.isOk);
    }
  });

  await t.step("rejects malformed pubkeys", () => {
    const inputs = [
      "deadbeef", // too short
      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // not a hex string
      "note1eqjwzxzdfumxqztas2vkx2k8y06mlt4padtfsel5jf8j7pcn5vsssd2g8m", // note is not for pubkey
      "nevent1qqsvsf8prpx57dnqp97c9xtr9trj8adl46s7k45cvl6fyne0quf6xggprfmhxue69uhkuun9d3shjtnr94ehgetvd3shytnwv46qhq36uw", // nevent is not for pubkey
    ];
    for (const i of inputs) {
      const res = parseInput(
        { ...defaultCmdOpts, authors: [i] },
        dummyRelayUrls,
        "",
        0,
      );
      assert(!res.isOk);
    }
  });

  await t.step("rejects malformed timestamps", () => {
    const inputs = [
      "2023/7/31 0:00:00", // // not an ISO 8601 datetime string
      "Mon, 31 Jul 2023 00:00:00 GMT", // not an ISO 8601 datetime string
      "0s", // zero duration
      "1y", // time unit not supported in duration.js
    ];
    for (const i of inputs) {
      const res = parseInput(
        { ...defaultCmdOpts, since: i },
        dummyRelayUrls,
        "",
        0,
      );
      assert(!res.isOk);
    }
  });

  await t.step("rejects stdin with malformed filter", () => {
    const inputs = [
      { unknown: "?" }, // unknown props
      { "#emoji": ["hoge"] }, // multi-letter tag query
      ["REQ", "subid", { kinds: [1] }], // REQ message
    ];
    for (const i of inputs) {
      const res = parseInput(
        { ...defaultCmdOpts },
        dummyRelayUrls,
        JSON.stringify(i),
        0,
      );
      assert(!res.isOk);
    }
  });

  await t.step(
    "rejects stdin with malformed REQ message if --stdin-req",
    () => {
      const inputs = [
        ["REQ", "subid"], // no filter
        ["REQ", "subid", ["hoge"]], // filter is not an object
        ["REQ", "subid", { unknown: "?" }], // malformed filter
      ];
      for (const i of inputs) {
        const res = parseInput(
          { ...defaultCmdOpts, stdinReq: true },
          dummyRelayUrls,
          JSON.stringify(i),
          0,
        );
        assert(!res.isOk);
      }
    },
  );
});

Deno.test("kindType validator", async (t) => {
  await t.step("accepts non-negative integers", () => {
    const inputs = ["0", "1", "10000", "30023"];
    for (const i of inputs) {
      assertEquals(
        kindType({ value: i, label: "", name: "", type: "" }),
        Number(i),
      );
    }
  });

  await t.step("rejects malformed kinds", () => {
    const inputs = ["11a", "-1", "1.5"];
    for (const i of inputs) {
      assertThrows(() => kindType({ value: i, label: "", name: "", type: "" }));
    }
  });
});

Deno.test("tagSpecType validator", async (t) => {
  await t.step("accepts valid tag spec", () => {
    const inputs = [
      "t:nostr,zap",
      "a:30023:d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44:somelongpost",
      "p:d1d1747115d16751a97c239f46ec1703292c3b7e9988b9ebdd4ec4705b15ed44",
      "p:npub168ghgug469n4r2tuyw05dmqhqv5jcwm7nxytn67afmz8qkc4a4zqsu2dlc",
      "p:nostr:npub168ghgug469n4r2tuyw05dmqhqv5jcwm7nxytn67afmz8qkc4a4zqsu2dlc",
    ];
    for (const i of inputs) {
      // assertions are not needed since it fails automatically if `tagSpecType` throws error (unexpectedly).
      tagSpecType({ value: i, label: "", name: "", type: "" });
    }
  });

  await t.step("rejects malformed tag spec", () => {
    const inputs = ["t", "t:", "multiLetterTag:hoge"];
    for (const i of inputs) {
      assertThrows(() =>
        tagSpecType({ value: i, label: "", name: "", type: "" })
      );
    }
  });
});
