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
 * @copyright 2021 @author Justin Collier <m@jpcx.dev>                        *
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

/**
 * A typed event emitter that provides removal protection, filtering, and inheritance.
 *
 * Execution Order Guarantees:
 *   - Ensures that `.emit()` operates on the currently registered listeners.
 *     - In other words, listener changes during the emit loop do not effect the loop.
 *   - Listeners are executed in their order of addition.
 *     - Listeners may be prepended.
 *   - Matches the behavior of EventEmitter from "events".
 *
 * Protection:
 *   - `.off()` will not remove the listener unless it is explicitly specified.
 *
 * Filtering:
 *   - Supply a type assertion to narrow down the type expected by a listener.
 *   - Listeners are not called unless their associated filter passes.
 *   - Requires the Data tparam to be manually specified.
 *     - As the Data tparam defines the listener parameters type,
 *       filtering changes the type expected by a given listener.
 *
 * @tparam BaseEvents:
 *   - Maps any listeners that are used directly by the top-level emitter to an event string.
 *
 * @tparam DerivedEvents:
 *   - Maps any listeners that are not statically known by the base class to an event string.
 *     - These events are only available to derived classes.
 *   - To enable event inheritance, base classes must forward a template argument that defines the derived event listeners.
 *     - This tparam should prohibit derivation of the base events; see the example.
 *
 * @example
 *   import { Emitter } from "ts-ev";
 *
 *   class Foo<
 *     DerivedEvents extends Emitter.Events.Except<"baseEv1" | "baseEv2">
 *   > extends Emitter<
 *     {
 *       baseEv1: (typed: number, args: string) => any;
 *       baseEv2: () => any;
 *     },
 *     DerivedEvents
 *   > {
 *     constructor() {
 *       super();
 *       setTimeout(() => this.emit("baseEv1", 1, "foo"), 100);
 *       setTimeout(() => this.emit("baseEv2"), 1000);
 *
 *       // this.emit("derivedEv")    // ts error
 *       // this.emit("anythingElse") // ts error
 *     }
 *   }
 *
 *   const foo = new Foo();
 *
 *   // standard on/once/off functionality
 *
 *   const [a, b] = await foo.once("baseEv1");
 *   const l = () => console.log("received");
 *   foo.on("baseEv2", l);
 *   foo.off("baseEv2", l);
 *   // or foo.off("baseEv2");
 *   // or foo.off();
 *
 *   // protection
 *
 *   foo.on("baseEv2", l, { protect: true });
 *   foo.off("baseEv2");    // does not remove the above listener
 *   foo.off();             // does not remove the above listener
 *   foo.off("baseEv2", l); // OK
 *
 *   // filtering
 *
 *   // must specify the expected type (extends original type)
 *   foo.on<"baseEv1", [number, "foo"]>(
 *     "baseEv1",
 *     (a, b) => console.log(a, b), // b is type "foo" (instead of type "string")
 *     {
 *       protect: true,
 *       filter: (data: [number, string, boolean]): data is [number, "foo", boolean] =>
 *         data[1] === "foo",
 *     }
 *   );
 *
 *   // inheritance
 *
 *   class Bar extends Foo<{
 *     derivedEv: (more: "events") => any;
 *   }> {
 *     constructor() {
 *       super();
 *
 *       // can operate on base class events
 *       setTimeout(() => this.emit("baseEv1", 1, "foo"), 100);
 *       // can operate on events provided to Foo via OtherEvents
 *       setTimeout(() => this.emit("derivedEv", "events"), 200);
 *     }
 *   }
 *
 *   const bar = new Bar();
 *   bar.on("baseEv2", () => console.log("receives base class events!"));
 *   bar.on("derivedEv", () => console.log("receives derived class events!"));
 */
export class Emitter<
  BaseEvents extends { [event: string]: (...args: any[]) => any },
  DerivedEvents extends { [event: string]: (...args: any[]) => any } = {}
> {
  /* private data {*/

  private _evinfo: {
    [event in keyof BaseEvents | keyof DerivedEvents]?: Array<
      [
        (...args: any[]) => any,
        {
          readonly once: boolean;
          readonly protect?: boolean;
          readonly filter?: (args: any[]) => boolean;
        }
      ]
    >;
  } = {};

  /* private data }*/

  /* default constructor {*/

  constructor() {
    for (const [prop, descr] of Object.entries(Object.getOwnPropertyDescriptors(this)))
      if (prop[0] === "_") Object.defineProperty(this, prop, { ...descr, enumerable: false });
  }

  /* default constructor }*/

  /**
   * Add a listener for a given event.
   *
   * @tparam Ev
   *   - Represents the event passed to the function
   * @tparam Data
   *   - Represents the data received by an event listener (parameters array).
   *     - Set by default to the corresponding `BaseEvents` or `DerivedEvents` value.
   *     - Note: **Must be manually specified when using filters**.
   *       - This ensures consistency between the filter type assertion and the listener parameters type.
   */
  public on<
    Ev extends keyof BaseEvents | keyof DerivedEvents,
    Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>
  >(
    ev: Ev,
    listener: (...args: Data) => any,
    options?: {
      filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
      protect?: boolean;
    }
  ): this {
    /*· {*/

    const info = this._evinfo[ev];
    const opts = { once: false, ...options } as {
      readonly once: boolean;
      readonly protect?: boolean;
      readonly filter?: (args: any[]) => boolean;
    };
    if (info) info.push([listener, opts]);
    else this._evinfo[ev] = [[listener, opts]];
    return this;

    /*· }*/
  }

  /**
   * Prepend a listener for a given event.
   *
   * @tparam Ev
   *   - Represents the event passed to the function
   * @tparam Data
   *   - Represents the data received by an event listener (parameters array).
   *     - Set by default to the corresponding `BaseEvents` or `DerivedEvents` value.
   *     - Note: **Must be manually specified when using filters**.
   *       - This ensures consistency between the filter type assertion and the listener parameters type.
   */
  public prependOn<
    Ev extends keyof BaseEvents | keyof DerivedEvents,
    Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>
  >(
    ev: Ev,
    listener: (...args: Data) => any,
    options?: {
      filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
      protect?: boolean;
    }
  ): this {
    /*· {*/

    const info = this._evinfo[ev];
    const opts = { once: false, ...options } as {
      readonly once: boolean;
      readonly protect?: boolean;
      readonly filter?: (args: any[]) => boolean;
    };
    if (info) info.unshift([listener, opts]);
    else this._evinfo[ev] = [[listener, opts]];
    return this;

    /*· }*/
  }

  /**
   * Add a once listener for a given event.
   *
   * @tparam Ev
   *   - Represents the event passed to the function
   * @tparam Data
   *   - Represents the data received by an event listener (parameters array).
   *     - Set by default to the corresponding `BaseEvents` or `DerivedEvents` value.
   *     - Note: **Must be manually specified when using filters**.
   *       - This ensures consistency between the filter type assertion and the listener parameters type.
   */
  public once<
    Ev extends keyof BaseEvents | keyof DerivedEvents,
    Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>
  >(
    ev: Ev,
    listener: (...args: Data) => any,
    options?: {
      filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
      protect?: boolean;
    }
  ): this;
  /**
   * Promise the next event update (promise listeners are protected).
   *
   * @tparam Ev
   *   - Represents the event passed to the function
   * @tparam Data
   *   - Represents the data received by an event listener (parameters array).
   *     - Set by default to the corresponding `BaseEvents` or `DerivedEvents` value.
   *     - Note: **Must be manually specified when using filters**.
   *       - This ensures consistency between the filter type assertion and the listener parameters type.
   */
  public once<
    Ev extends keyof BaseEvents | keyof DerivedEvents,
    Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>
  >(
    ev: Ev,
    options?: {
      filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
    }
  ): Promise<Data>;
  public once<
    Ev extends keyof BaseEvents | keyof DerivedEvents,
    Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>
  >(
    ev: Ev,
    listenerOrOptions?:
      | ((...args: Data) => any)
      | { filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data> },
    options?: {
      filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
      protect?: boolean;
    }
  ): this | Promise<Data> {
    /*· {*/

    if (typeof listenerOrOptions === "function") {
      const info = this._evinfo[ev];
      const opts = { once: true, ...options } as {
        readonly once: boolean;
        readonly protect?: boolean;
        readonly filter?: (args: any[]) => boolean;
      };
      if (info) info.push([listenerOrOptions, opts]);
      else this._evinfo[ev] = [[listenerOrOptions, opts]];

      return this;
    } else {
      return new Promise((resolve) => {
        const info = this._evinfo[ev];
        // force protect for promises
        const opts = { once: true, ...listenerOrOptions, protect: true } as {
          readonly once: boolean;
          readonly protect?: boolean;
          readonly filter?: (args: any[]) => boolean;
        };
        const shim = (...data: Data) => resolve(data);
        if (info) info.push([shim, opts]);
        else this._evinfo[ev] = [[shim, opts]];
      });
    }

    /*· }*/
  }

  /**
   * Prepend a once listener for a given event.
   *
   * @tparam Ev
   *   - Represents the event passed to the function
   * @tparam Data
   *   - Represents the data received by an event listener (parameters array).
   *     - Set by default to the corresponding `BaseEvents` or `DerivedEvents` value.
   *     - Note: **Must be manually specified when using filters**.
   *       - This ensures consistency between the filter type assertion and the listener parameters type.
   */
  public prependOnce<
    Ev extends keyof BaseEvents | keyof DerivedEvents,
    Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>
  >(
    ev: Ev,
    listener: (...args: Data) => any,
    options?: {
      filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
      protect?: boolean;
    }
  ): this;
  /**
   * Prepend a promise for the next event update (promise listeners are protected).
   *
   * @tparam Ev
   *   - Represents the event passed to the function
   * @tparam Data
   *   - Represents the data received by an event listener (parameters array).
   *     - Set by default to the corresponding `BaseEvents` or `DerivedEvents` value.
   *     - Note: **Must be manually specified when using filters**.
   *       - This ensures consistency between the filter type assertion and the listener parameters type.
   */
  public prependOnce<
    Ev extends keyof BaseEvents | keyof DerivedEvents,
    Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>
  >(
    ev: Ev,
    options?: {
      filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
    }
  ): Promise<Data>;
  public prependOnce<
    Ev extends keyof BaseEvents | keyof DerivedEvents,
    Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>
  >(
    ev: Ev,
    listenerOrOptions?:
      | ((...args: Data) => any)
      | { filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data> },
    options?: {
      filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
      protect?: boolean;
    }
  ): this | Promise<Data> {
    /*· {*/

    if (typeof listenerOrOptions === "function") {
      const info = this._evinfo[ev];
      const opts = { once: true, ...options } as {
        readonly once: boolean;
        readonly protect?: boolean;
        readonly filter?: (args: any[]) => boolean;
      };
      if (info) info.unshift([listenerOrOptions, opts]);
      else this._evinfo[ev] = [[listenerOrOptions, opts]];

      return this;
    } else {
      return new Promise((resolve) => {
        const info = this._evinfo[ev];
        // force protect for promises
        const opts = { once: true, ...listenerOrOptions, protect: true } as {
          readonly once: boolean;
          readonly protect?: boolean;
          readonly filter?: (args: any[]) => boolean;
        };
        const shim = (...data: Data) => resolve(data);
        if (info) info.unshift([shim, opts]);
        else this._evinfo[ev] = [[shim, opts]];
      });
    }

    /*· }*/
  }

  /** Remove a specific event listener (removes 'protected' listeners). */
  public off<Ev extends keyof BaseEvents | keyof DerivedEvents>(
    ev: Ev,
    listener: EvListener<BaseEvents, DerivedEvents, Ev>
  ): this;
  /** Remove all listeners for an event (skips 'protected' listeners). */
  public off<Ev extends keyof BaseEvents | keyof DerivedEvents>(ev: Ev): this;
  /** Remove all listeners (skips 'protected' listeners). */
  public off(): this;
  public off<Ev extends keyof BaseEvents | keyof DerivedEvents>(
    ev?: Ev,
    listener?: Ev extends keyof BaseEvents
      ? BaseEvents[Ev]
      : Ev extends keyof DerivedEvents
      ? DerivedEvents[Ev]
      : never
  ): this {
    /*· {*/

    if (ev !== undefined && listener !== undefined) {
      // delete this event callback (regardless of lock setting)
      const cbs = this._evinfo[ev];
      if (cbs) {
        cbs.splice(
          cbs.findIndex(([l]) => l === listener),
          1
        );
        if (cbs.length === 0) delete this._evinfo[ev];
      }
    } else if (ev !== undefined) {
      // delete all event callbacks that are not locked
      const cbs = this._evinfo[ev];
      if (cbs) {
        const todel: ((...args: any[]) => any)[] = [];
        for (const [cb, { protect }] of cbs!) if (!protect) todel.push(cb);
        for (const cb of todel)
          cbs.splice(
            cbs.findIndex(([l]) => l === cb),
            1
          );
        if (cbs.length === 0) delete this._evinfo[ev];
      }
    } else {
      Object.keys(this._evinfo).forEach((ev) => this.off(ev));
    }
    return this;

    /*· }*/
  }

  /** Emit data for an event. Changes to listeners during this loop are queued until the loop completes. */
  public emit<Ev extends keyof BaseEvents | keyof DerivedEvents>(
    ev: Ev,
    ...data: EvData<BaseEvents, DerivedEvents, Ev>
  ): this {
    /*· {*/

    if (this._evinfo[ev])
      for (const [cb, { once, filter }] of [...this._evinfo[ev]!])
        if (filter ? filter(data) : true) {
          cb(...data);
          if (once) this.off(ev, cb as EvListener<BaseEvents, DerivedEvents, Ev>);
        }

    return this;

    /*· }*/
  }
}
export module Emitter {
  export type Events = {
    [event: string]: (...args: any[]) => any;
  };
  export module Events {
    export type Except<Ev extends string> = Events &
      {
        [key in Ev]?: never;
      };
  }

  /** Helper type for declaring a DerivedEvents template parameter. */
  export type DerivedEvents<Exclude extends string> = {
    [event: string]: (...args: any[]) => any;
  } & { [event in keyof Exclude]: never };
}

/*                                                                    Detail {*/

/** Determines the Emitter listener type given an event and listener dict pair. */
export type EvListener<
  BaseEvents extends { [event: string]: (...args: any[]) => any },
  DerivedEvents extends { [event: string]: (...args: any[]) => any },
  Ev extends keyof BaseEvents | keyof DerivedEvents
> = Ev extends keyof BaseEvents
  ? BaseEvents[Ev]
  : Ev extends keyof DerivedEvents
  ? DerivedEvents[Ev]
  : never;

/** Determines the Emitter listener parameters type given an event and listener dict pair. */
export type EvData<
  BaseEvents extends { [event: string]: (...args: any[]) => any },
  DerivedEvents extends { [event: string]: (...args: any[]) => any },
  Ev extends keyof BaseEvents | keyof DerivedEvents
> = Parameters<EvListener<BaseEvents, DerivedEvents, Ev>>;

/**
 * Determines the Emitter filter type given an event, listener dict pair, and target args type.
 * Disables the filter if Args is not provided.
 */
export type DataFilter<
  BaseEvents extends { [event: string]: (...args: any[]) => any },
  DerivedEvents extends { [event: string]: (...args: any[]) => any },
  Ev extends keyof BaseEvents | keyof DerivedEvents,
  Args extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>
> = Exact<Args, EvData<BaseEvents, DerivedEvents, Ev>> extends never
  ? Ev extends keyof BaseEvents
    ? (args: Parameters<BaseEvents[Ev]>) => args is Args
    : Ev extends keyof DerivedEvents
    ? (args: Parameters<DerivedEvents[Ev]>) => args is Args
    : never
  : never;

/** T if two types are exactly the same, never if not. (thanks to https://stackoverflow.com/a/53808212) */
export type Exact<T, U> = (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2
  ? T
  : never;

// vim: fdm=marker:fmr=\ {*/,\ }*/

/*                                                                    Detail }*/
