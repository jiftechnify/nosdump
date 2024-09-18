import {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertThrows,
} from "@std/assert";

import {
  NosdumpConfigRepo,
  NosdumpConfigSchema,
  RelayAliasesOps,
} from "./config.ts";
import { ZodError } from "zod";

Deno.test("NosdumpConfigRepo", async (t) => {
  await t.step("resolveRelaySpecifiers()", async (t) => {
    await t.step("basic scenario", () => {
      const repo = NosdumpConfigRepo.fromConfigObjectForTesting({
        relay: {
          aliases: {
            "foo": "wss://foo.example.com/",
            "bar": "wss://bar.example.com/",
          },
        },
      });
      const resolved = repo.resolveRelaySpecifiers([
        "foo",
        "wss://hoge.example.com/",
        "bar",
      ]);
      assert(resolved.isOk);
      assertArrayIncludes(resolved.val, [
        "wss://foo.example.com/",
        "wss://hoge.example.com/",
        "wss://bar.example.com/",
      ]);
    });

    await t.step("returns error if an alias is not found", () => {
      const repo = NosdumpConfigRepo.fromConfigObjectForTesting({
        relay: {
          aliases: {
            "foo": "wss://foo.example.com/",
          },
        },
      });

      const resolved = repo.resolveRelaySpecifiers([
        "foo",
        "wss://hoge.example.com/",
        "bar",
      ]);
      assert(!resolved.isOk);
      assert(resolved.err.length === 1);
      assert(resolved.err.some((msg) => msg.includes("bar")));
    });
  });
});

Deno.test("RelayAliasesOps", async (t) => {
  await t.step("basic scenario", async (t) => {
    const aliases = new RelayAliasesOps({});

    await t.step("list the empty aliases", () => {
      const l = aliases.list();
      assertEquals(l, {});
    });

    await t.step("set an alias", () => {
      // make sure that alias "foo" does not exist
      assert(!aliases.has("foo"));

      aliases.set("foo", "wss://foo.example.com/");

      // make sure that alias "foo" exists and refers to the intended URL
      assert(aliases.has("foo"));
      assertEquals(aliases.get("foo"), "wss://foo.example.com/");
      assertEquals(aliases.list(), { foo: "wss://foo.example.com/" });
    });

    await t.step("unset an alias", () => {
      const unset = aliases.unset("foo");

      assert(unset);

      // make sure that alias "foo" is correctly unset
      assert(!aliases.has("foo"));
      assertEquals(aliases.get("foo"), undefined);
      assertEquals(aliases.list(), {});
    });
  });

  await t.step("set()", async (t) => {
    await t.step("normalizes relay URL", () => {
      const aliases = new RelayAliasesOps({});
      aliases.set("root-no-trailing-slash", "wss://example.com");
      aliases.set("sub-trailing-slash", "wss://example.com/sub/");

      assertEquals(aliases.list(), {
        "root-no-trailing-slash": "wss://example.com/",
        "sub-trailing-slash": "wss://example.com/sub",
      });
    });

    await t.step("throws if alias contains illegal characters", () => {
      const aliases = new RelayAliasesOps({});
      assertThrows(() => {
        aliases.set("a/b", "wss://example.com");
      });
    });

    await t.step("throws if relay URL is not a valid URL", () => {
      const aliases = new RelayAliasesOps({});
      assertThrows(() => {
        aliases.set("foo", "not-a-url");
      });
    });

    await t.step("throws if relay URL is not a Relay URL", () => {
      const aliases = new RelayAliasesOps({});
      assertThrows(() => {
        aliases.set("foo", "https://example.com");
      });
    });
  });

  await t.step("setting duplicated alias overwrites existing one", () => {
    const aliases = new RelayAliasesOps({ foo: "wss://foo.example.com/" });
    assertEquals(aliases.get("foo"), "wss://foo.example.com/");

    aliases.set("foo", "wss://new.foo.example.com/");

    assertEquals(aliases.get("foo"), "wss://new.foo.example.com/");
  });

  await t.step("unsetting non-existing alias is no-op", () => {
    const aliases = new RelayAliasesOps({ foo: "wss://foo.example.com/" });

    const unset = aliases.unset("bar");

    assert(!unset);

    assert(aliases.has("foo"));
    assert(!aliases.has("bar"));
    assertEquals(aliases.get("bar"), undefined);
  });

  await t.step(
    "modifying result of list() does not affect the internal state",
    () => {
      const aliases = new RelayAliasesOps({});

      const l = aliases.list();
      l.foo = "wss://foo.example.com/";

      assert(!aliases.has("foo"));
      assertEquals(aliases.get("foo"), undefined);
      assertEquals(aliases.list(), {});
    },
  );
});

Deno.test("NosdumpConfigSchema", async (t) => {
  await t.step(
    "normalizes values (relay URLs) of relay.aliases if no validation error",
    () => {
      const conf = {
        relay: {
          aliases: {
            "root1": "wss://root1.example.com",
            "root2": "wss://root2.example.com/",
            "sub1": "wss://sub1.example.com/sub",
            "sub2": "wss://sub2.example.com/sub/",
          },
        },
      };
      const parsed = NosdumpConfigSchema.parse(conf);
      assertEquals(parsed, {
        relay: {
          aliases: {
            "root1": "wss://root1.example.com/",
            "root2": "wss://root2.example.com/",
            "sub1": "wss://sub1.example.com/sub",
            "sub2": "wss://sub2.example.com/sub",
          },
        },
      });
    },
  );

  await t.step("reports keys of relay.aliases have illegal letters", () => {
    const conf = {
      relay: {
        aliases: {
          "a/b": "wss://a-b.example.com",
        },
      },
    };
    assertThrows(() => {
      NosdumpConfigSchema.parse(conf);
    }, ZodError);
  });

  await t.step("reports values of relay.aliases have invalid URL", () => {
    const conf = {
      relay: {
        aliases: {
          "err": "not-a-url",
        },
      },
    };
    assertThrows(() => {
      NosdumpConfigSchema.parse(conf);
    }, ZodError);
  });

  await t.step("reports values of relay.aliases have non-Relay URL", () => {
    const conf = {
      relay: {
        aliases: {
          "err": "https://example.com",
        },
      },
    };
    assertThrows(() => {
      NosdumpConfigSchema.parse(conf);
    }, ZodError);
  });
});
