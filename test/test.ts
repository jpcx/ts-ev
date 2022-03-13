/**** * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 ***                       _____                                              *
 **                       __  /________  ________   __                        *
 *                        _  __/_  ___/___  _ \_ | / /                        *
 *                        / /_ _(__  )___/  __/_ |/ /                         *
 *                        \__/ /____/    \___/ \___/                          *
 *                                                                            *
 *                     @link http://github.com/jpcx/ts-ev                     *
 *                                                                            *
 * @license MIT                                                               *
 * @copyright 2021-2022 @author Justin Collier <m@jpcx.dev>                   *
 *                                                                            *
 * Permission is hereby granted, free of charge, to any person obtaining a    *
 * copy of this software and associated documentation files (the "Software"), *
 * to deal in the Software without restriction, including without limitation  *
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,   *
 * and/or sell copies of the Software, and to permit persons to whom the      *
 * Software is furnished to do so, subject to the following conditions:       *
 *                                                                            *
 * The above copyright notice and this permission notice shall be included    *
 * in all copies or substantial portions of the Software.                     *
 *                                                                            *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,   *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL    *
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING    *
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER       **
 * DEALINGS IN THE SOFTWARE.                                                ***
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * ****/

import assert from "assert";
import { test } from "@jpcx/testts";
import { Emitter } from "../";

test("Emitter", async (test) => {
  await test("standard functionality", async (test) => {
    const e = new Emitter();

    let received: string = "";
    const l = (recv: string) => {
      received = recv;
    };

    test("on", () => {
      e.on("foo", l);
      assert(received === "");
    });

    test("emit", () => {
      // test on/emit
      e.emit("foo", "bar");
      assert((received as string) === "bar");
    });

    test("persistence", () => {
      // on remains
      e.emit("foo", "baz");
      assert((received as string) === "baz");
    });

    test("all off", () => {
      // test all off
      e.off();
      e.emit("foo", "beh");
      assert((received as string) === "baz");
    });

    // reset
    e.on("foo", l);
    e.emit("foo", "bar");
    assert((received as string) === "bar");

    test("event off", () => {
      // test all event off
      e.off("foo");
      e.emit("foo", "beh");
      assert((received as string) === "bar");
    });

    // reset
    e.on("foo", l);
    e.emit("foo", "bar");
    assert((received as string) === "bar");

    test("listener off", () => {
      // test listener off
      e.off("foo", l);
      e.emit("foo", "beh");
      assert((received as string) === "bar");
    });

    test("once (cb)", () => {
      // test once (cb)
      e.once("foo", l);
      e.emit("foo", "baar");
      assert((received as string) === "baar");
      e.emit("foo", "baaz");
      assert((received as string) === "baar");
    });

    await test("once (promise)", async () => {
      // test once (promise)
      setTimeout(() => e.emit("foo", "fooo"), 0);
      assert((await e.once("foo"))[0] === "fooo");
    });
  });

  test("ordering", (test) => {
    const e = new Emitter();

    let recvd: any[] = [];

    test("listeners added via on/once are ordered", () => {
      e.on("foo", () => recvd.push(1));
      e.on("foo", () => recvd.push(2));
      e.once("foo", () => recvd.push(3));
      e.once("foo", () => recvd.push(4));

      e.emit("foo");
      assert(recvd.length === 4);
      assert(recvd[0] === 1);
      assert(recvd[1] === 2);
      assert(recvd[2] === 3);
      assert(recvd[3] === 4);
    });

    // reset
    e.off();
    recvd = [];

    test("prepended on/once listeners are ordered", () => {
      e.on("foo", () => recvd.push(5));
      e.on("foo", () => recvd.push(6));
      e.once("foo", () => recvd.push(7));
      e.once("foo", () => recvd.push(8));

      e.prependOn("foo", () => recvd.push(4));
      e.prependOn("foo", () => recvd.push(3));
      e.prependOnce("foo", () => recvd.push(2));
      e.prependOnce("foo", () => recvd.push(1));

      e.emit("foo");
      assert(recvd.length === 8);
      assert(recvd[0] === 1);
      assert(recvd[1] === 2);
      assert(recvd[2] === 3);
      assert(recvd[3] === 4);
      assert(recvd[4] === 5);
      assert(recvd[5] === 6);
      assert(recvd[6] === 7);
      assert(recvd[7] === 8);
    });

    // reset
    e.off();
    recvd = [];

    test("listeners added by listeners", () => {
      e.on("foo", () => e.on("foo", () => recvd.push(1)));

      e.emit("foo");

      assert(recvd.length === 0);

      e.emit("foo");

      assert(<any>recvd.length === 1);
    });

    // reset
    e.off();
    recvd = [];

    test("listeners removed by listeners", () => {
      e.on("foo", () => recvd.push(1));

      let nPrependCalls = 0;

      e.prependOn("foo", () => {
        ++nPrependCalls;
        e.off();
      });

      e.emit("foo");

      assert(nPrependCalls === 1);
      assert(recvd.length === 1);
      assert(recvd[0] === 1);

      e.emit("foo");

      assert(nPrependCalls === 1);
      assert(recvd.length === 1);
      assert(recvd[0] === 1);
    });
  });

  test("multiple events", (test) => {
    const e = new Emitter();

    let foo1data: any;
    let foo2data: any;
    let bar1data: any;
    let bar2data: any;

    const onfoo1 = (data: any) => {
      foo1data = data;
    };
    const onfoo2 = (data: any) => {
      foo2data = data;
    };
    const onbar1 = (data: any) => {
      bar1data = data;
    };
    const onbar2 = (data: any) => {
      bar2data = data;
    };

    e.on("foo", onfoo1);
    e.on("foo", onfoo2);
    e.on("bar", onbar1);
    e.on("bar", onbar2);

    test("notifies multiple listeners", () => {
      e.emit("foo", "qux");
      e.emit("bar", "quz");

      assert(foo1data === "qux");
      assert(foo2data === "qux");
      assert(bar1data === "quz");
      assert(bar2data === "quz");
    });

    test("listener removal", () => {
      e.off("foo", onfoo1);

      e.emit("foo", "quxa");
      e.emit("bar", "quza");

      assert(foo1data === "qux");
      assert(foo2data === "quxa");
      assert(bar1data === "quza");
      assert(bar2data === "quza");

      e.off("bar", onbar1);

      e.emit("foo", "quxb");
      e.emit("bar", "quzb");

      assert(foo1data === "qux");
      assert(foo2data === "quxb");
      assert(bar1data === "quza");
      assert(bar2data === "quzb");
    });

    // reset
    e.on("foo", onfoo1);
    e.on("bar", onbar1);
    e.emit("foo", "qux");
    e.emit("bar", "quz");
    assert(foo1data === "qux");
    assert(foo2data === "qux");
    assert(bar1data === "quz");
    assert(bar2data === "quz");

    test("event removal", () => {
      e.off("foo");

      e.emit("foo", "quxa");
      e.emit("bar", "quza");

      assert(foo1data === "qux");
      assert(foo2data === "qux");
      assert(bar1data === "quza");
      assert(bar2data === "quza");

      e.off("bar");

      e.emit("foo", "quxb");
      e.emit("bar", "quzb");

      assert(foo1data === "qux");
      assert(foo2data === "qux");
      assert(bar1data === "quza");
      assert(bar2data === "quza");
    });

    // reset
    e.on("foo", onfoo1);
    e.on("foo", onfoo2);
    e.on("bar", onbar1);
    e.on("bar", onbar2);
    e.emit("foo", "qux");
    e.emit("bar", "quz");
    assert(foo1data === "qux");
    assert(foo2data === "qux");
    assert(bar1data === "quz");
    assert(bar2data === "quz");

    test("all removal", () => {
      e.off();

      e.emit("foo", "quxa");
      e.emit("bar", "quza");

      assert(foo1data === "qux");
      assert(foo2data === "qux");
      assert(bar1data === "quz");
      assert(bar2data === "quz");
    });
  });

  await test("protection", async () => {
    const e = new Emitter();

    let recv: any;

    const l = (data: any) => {
      recv = data;
    };

    e.on("foo", l, { protect: true });

    e.emit("foo", "bar");

    assert(recv === "bar");

    e.off("foo");
    e.off();

    e.emit("foo", "baz");
    assert(recv === "baz");

    e.off("foo", l);

    e.emit("foo", "beh");
    assert(recv === "baz");
  });

  await test("filtering", async () => {
    const e = new Emitter<{
      foo: (data: object) => any;
    }>();

    let correctdata: { foo: "bar" } | null = null;

    e.on(
      "foo",
      (data) => {
        correctdata = data;
      },
      {
        filter: (args: [object]): args is [{ foo: "bar" }] =>
          args[0] instanceof Object && (<any>args)[0].foo === "bar",
      }
    );

    e.emit("foo", {});
    assert(correctdata === null);

    e.emit("foo", { foo: "baz" });
    assert(correctdata === null);

    e.emit("foo", { foo: "bar" });
    assert(<any>correctdata instanceof Object && (<any>correctdata).foo === "bar");
  });
});
