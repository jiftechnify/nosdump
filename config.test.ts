import { assert, assertArrayIncludes, assertEquals, assertThrows } from "@std/assert";

import { NosdumpConfigRepo, NosdumpConfigSchema, RelayAliasesOps, RelaySetsOps } from "./config.ts";
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

    await t.step("normalizes raw relay URLs", () => {
      const repo = NosdumpConfigRepo.fromConfigObjectForTesting({
        relay: {},
      });
      const resolved = repo.resolveRelaySpecifiers([
        "wss://example.com",
        "wss://example.com/",
        "wss://example.com/sub",
        "wss://example.com/sub/",
      ]);
      assert(resolved.isOk);
      assertArrayIncludes(resolved.val, [
        "wss://example.com/",
        "wss://example.com/sub",
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

Deno.test("RelaySetsOps", async (t) => {
  await t.step("basic scenario", async (t) => {
    const sets = new RelaySetsOps({});

    await t.step(
      "adding a relay to a relay set that does not exist crates new one",
      () => {
        // make sure that relay set "foo" does not exist
        assert(!sets.has("foo"));

        sets.addRelayUrlsTo("foo", ["wss://foo-1.example.com/"]);

        // make sure that set "foo" now exists and contains the relay added
        assert(sets.has("foo"));
        assertEquals(sets.listRelaysOf("foo"), ["wss://foo-1.example.com/"]);
        assertEquals(sets.listAll(), { foo: ["wss://foo-1.example.com/"] });
      },
    );

    await t.step("add more relays to a set", () => {
      sets.addRelayUrlsTo("foo", [
        "wss://foo-2.example.com/",
        "wss://foo-3.example.com/",
        "wss://foo-4.example.com/",
      ]);

      assert(sets.has("foo"));
      assertEquals(sets.listRelaysOf("foo"), [
        "wss://foo-1.example.com/",
        "wss://foo-2.example.com/",
        "wss://foo-3.example.com/",
        "wss://foo-4.example.com/",
      ]);
    });

    await t.step("remove relays from a set", () => {
      const removed = sets.removeRelayUrlsFrom("foo", [
        "wss://foo-2.example.com/",
        "wss://foo-4.example.com/",
      ]);
      assert(removed);

      assert(sets.has("foo"));
      assertEquals(sets.listRelaysOf("foo"), [
        "wss://foo-1.example.com/",
        "wss://foo-3.example.com/",
      ]);
    });

    await t.step("copy a set", () => {
      sets.copy("foo", "bar");

      assert(sets.has("foo") && sets.has("bar"));
      assertEquals(sets.listRelaysOf("bar"), [
        "wss://foo-1.example.com/",
        "wss://foo-3.example.com/",
      ]);

      // adding relays to the copy should not affect the original
      sets.addRelayUrlsTo("bar", ["wss://bar.example.com/"]);
      assertEquals(sets.listRelaysOf("bar"), [
        "wss://foo-1.example.com/",
        "wss://foo-3.example.com/",
        "wss://bar.example.com/",
      ]);
      assertEquals(sets.listRelaysOf("foo"), [
        "wss://foo-1.example.com/",
        "wss://foo-3.example.com/",
      ]);
    });

    await t.step("rename a set", () => {
      sets.rename("bar", "bar2");

      assert(!sets.has("bar") && sets.has("bar2"));
      assertEquals(sets.listRelaysOf("bar2"), [
        "wss://foo-1.example.com/",
        "wss://foo-3.example.com/",
        "wss://bar.example.com/",
      ]);
    });

    await t.step("delete a set", () => {
      const deleted = sets.delete("foo");
      assert(deleted);

      // make sure that the set is deleted
      assert(!sets.has("foo"));
      assertEquals(sets.listRelaysOf("foo"), undefined);
    });
  });

  await t.step("addRelayUrlsTo()", async (t) => {
    await t.step("dedupes relay URLs", () => {
      const sets = new RelaySetsOps({
        foo: ["wss://foo-1.example.com/"],
      });
      sets.addRelayUrlsTo("foo", [
        "wss://foo-2.example.com/",
        "wss://foo-1.example.com/",
        "wss://foo-2.example.com/",
      ]);

      assertEquals(sets.listRelaysOf("foo"), [
        "wss://foo-1.example.com/",
        "wss://foo-2.example.com/",
      ]);
    });

    await t.step("normalizes relay URLs", () => {
      const sets = new RelaySetsOps({});
      sets.addRelayUrlsTo("foo", [
        "wss://example.com",
        "wss://example.com/",
        "wss://example.com/sub",
        "wss://example.com/sub/",
      ]);

      assertEquals(sets.listRelaysOf("foo"), [
        "wss://example.com/",
        "wss://example.com/sub",
      ]);
    });

    await t.step("throws if relay set name contains illegal characters", () => {
      const sets = new RelaySetsOps({});
      assertThrows(() => {
        sets.addRelayUrlsTo("a/b", ["wss://example.com"]);
      });
    });

    await t.step("throws if relay URLs are not valid URLs", () => {
      const sets = new RelaySetsOps({});
      assertThrows(() => {
        sets.addRelayUrlsTo("foo", ["not-a-url", "invalid-url"]);
      });
    });

    await t.step("throws if relay URLs are not Relay URLs", () => {
      const sets = new RelaySetsOps({});
      assertThrows(() => {
        sets.addRelayUrlsTo("foo", [
          "https://example.com",
          "http://example.com",
        ]);
      });
    });
  });

  await t.step("removeRelayUrlsFrom()", async (t) => {
    await t.step("normalizes relay URLs in arguments before matching", () => {
      const sets = new RelaySetsOps({
        foo: ["wss://foo-1.example.com/", "wss://foo-2.example.com/"],
      });
      sets.removeRelayUrlsFrom("foo", [
        "wss://foo-1.example.com", // no trailing slash
      ]);

      // URLs with no trailing slash in arguments should be normalized before matching against existing URLs,
      // so "wss://foo-1.example.com/" should be removed by the URL without trailing slash.
      assertEquals(sets.listRelaysOf("foo"), [
        "wss://foo-2.example.com/",
      ]);
    });

    await t.step("if removing relays empties a relay set, deletes it", () => {
      const sets = new RelaySetsOps({
        foo: ["wss://foo-1.example.com/", "wss://foo-2.example.com/"],
      });

      sets.removeRelayUrlsFrom("foo", ["wss://foo-1.example.com/"]);
      sets.removeRelayUrlsFrom("foo", ["wss://foo-2.example.com/"]);

      assert(!sets.has("foo"));
      assertEquals(sets.listRelaysOf("foo"), undefined);
    });
  });

  await t.step("copy()", async (t) => {
    await t.step(
      "throws if names of source and destination are the same",
      () => {
        const sets = new RelaySetsOps({
          foo: ["wss://foo.example.com/"],
        });
        assertThrows(() => {
          sets.copy("foo", "foo");
        });
      },
    );

    await t.step(
      "throws if destination set name contains illegal characters",
      () => {
        const sets = new RelaySetsOps({
          foo: ["wss://foo.example.com/"],
        });
        assertThrows(() => {
          sets.copy("foo", "a/b");
        });
      },
    );

    await t.step("throws if source set does not exist", () => {
      const sets = new RelaySetsOps({
        baz: ["wss://baz.example.com/"],
      });
      assertThrows(() => {
        sets.copy("foo", "bar");
      });
    });
  });

  await t.step("rename()", async (t) => {
    await t.step(
      "throws if names of source and destination are the same",
      () => {
        const sets = new RelaySetsOps({
          foo: ["wss://foo.example.com/"],
        });
        assertThrows(() => {
          sets.rename("foo", "foo");
        });
      },
    );

    await t.step(
      "throws if destination set name contains illegal characters",
      () => {
        const sets = new RelaySetsOps({
          foo: ["wss://foo.example.com/"],
        });
        assertThrows(() => {
          sets.rename("foo", "a/b");
        });
      },
    );

    await t.step("throws if source set does not exist", () => {
      const sets = new RelaySetsOps({
        baz: ["wss://baz.example.com/"],
      });
      assertThrows(() => {
        sets.rename("foo", "bar");
      });
    });
  });

  await t.step("deleting a non-existing set is no-op", () => {
    const sets = new RelaySetsOps({ foo: ["wss://foo.example.com/"] });

    const unset = sets.delete("bar");

    assert(!unset);

    assert(sets.has("foo"));
    assert(!sets.has("bar"));
    assertEquals(sets.listRelaysOf("bar"), undefined);
  });

  await t.step(
    "modifying result of list() does not affect the internal state",
    () => {
      const sets = new RelaySetsOps({ foo: ["wss://foo.example.com/"] });

      const l = sets.listAll();

      l.bar = ["wss://bar.example.com/"];
      assert(!sets.has("bar"));
      assertEquals(sets.listRelaysOf("bar"), undefined);

      l.foo.push("wss://unknown.example.com/");
      assertEquals(sets.listRelaysOf("foo"), ["wss://foo.example.com/"]);

      delete l.foo;
      assert(sets.has("foo"));
      assertEquals(sets.listRelaysOf("foo"), ["wss://foo.example.com/"]);
    },
  );

  await t.step(
    "modifying result of get() does not affect the internal state",
    () => {
      const sets = new RelaySetsOps({ foo: ["wss://foo.example.com/"] });

      const foo = sets.listRelaysOf("foo");

      assert(foo !== undefined);

      foo.push("wss://unknown.example.com/");
      assertEquals(sets.listRelaysOf("foo"), ["wss://foo.example.com/"]);
    },
  );
});

Deno.test("NosdumpConfigSchema", async (t) => {
  await t.step(
    "normalizes values (relay URLs) of relay.{aliases,sets} if no validation error",
    () => {
      const conf = {
        relay: {
          aliases: {
            "root1": "wss://root1.example.com",
            "root2": "wss://root2.example.com/",
            "sub1": "wss://sub1.example.com/sub",
            "sub2": "wss://sub2.example.com/sub/",
          },
          sets: {
            "root": ["wss://root1.example.com", "wss://root2.example.com/"],
            "sub": [
              "wss://sub1.example.com/sub",
              "wss://sub2.example.com/sub/",
            ],
            "dup": ["wss://example.com", "wss://example.com/"],
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
          sets: {
            "root": ["wss://root1.example.com/", "wss://root2.example.com/"],
            "sub": [
              "wss://sub1.example.com/sub",
              "wss://sub2.example.com/sub",
            ],
            "dup": ["wss://example.com/"], // should be deduped after normalization
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

  await t.step("reports keys of relay.sets have illegal letters", () => {
    const conf = {
      relay: {
        sets: {
          "a/b": ["wss://a-b.example.com"],
        },
      },
    };
    assertThrows(() => {
      NosdumpConfigSchema.parse(conf);
    }, ZodError);
  });

  await t.step("reports values of relay.sets have invalid URL", () => {
    const conf = {
      relay: {
        sets: {
          "err": ["not-a-url", "invalid-url"],
        },
      },
    };
    assertThrows(() => {
      NosdumpConfigSchema.parse(conf);
    }, ZodError);
  });

  await t.step("reports values of relay.sets have non-Relay URL", () => {
    const conf = {
      relay: {
        sets: {
          "err": ["https://example.com", "http://example.com"],
        },
      },
    };
    assertThrows(() => {
      NosdumpConfigSchema.parse(conf);
    }, ZodError);
  });
});
