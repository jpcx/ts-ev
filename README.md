[![](https://github.com/jpcx/ts-ev/blob/0.3.0/assets/logo.png)](#)

![](https://img.shields.io/github/issues/jpcx/ts-ev)
![](https://img.shields.io/github/forks/jpcx/ts-ev)
![](https://img.shields.io/github/stars/jpcx/ts-ev)
![](https://img.shields.io/npm/dm/ts-ev)  
![](https://img.shields.io/librariesio/dependents/npm/ts-ev)
![](https://img.shields.io/github/license/jpcx/ts-ev)
![](https://img.shields.io/librariesio/github/jpcx/ts-ev?label=dev-dependencies)

[![](https://nodei.co/npm/ts-ev.png?mini=true)](https://www.npmjs.com/package/ts-ev)

ts-ev is a typed event emitter that provides removal protection, filtering, and inheritance.

Unlike other typed event emitters, ts-ev includes a mechanism for arbitrarily deep extensions of its Emitter class such that each derived class has full access to its own events.

ts-ev has zero imports, so it should be usable in any environment.

**[CHANGELOG](https://github.com/jpcx/ts-ev/blob/0.3.0/CHANGELOG.md)**

## Features

Execution Order Guarantees:
- Ensures that `.emit()` operates on the currently registered listeners.
  - In other words, listener changes during the emit loop do not effect the loop.
- Listeners are executed in their order of addition.
  - Listeners may be prepended.
- Matches the behavior of EventEmitter from "events".

Protection:
  - `.off()` will not remove the listener unless it is explicitly specified.

Filtering:
  - Supply a type assertion to narrow down the type expected by a listener.
  - Listeners are not called unless their associated filter passes.
  - Filters must be type predicates and must specify both the input and output types.
    - e.g.: `(args: [number, string]): args is [1, "foo"] => args[0] === 1 && args[1] === "foo"`
  - Filtering changes the listener parameters type.

### Template Parameters

```ts
export class Emitter<
  BaseEvents    extends { [event: string]: (...args: any[]) => any },
  DerivedEvents extends { [event: string]: (...args: any[]) => any } = {},
> { ... }
```

BaseEvents:
- Maps any listeners that are used directly by the top-level emitter to an event string.

DerivedEvents:
- Maps any listeners that are not statically known by the base class to an event string.
  - These events are only available to derived classes.
- To enable event inheritance, base classes must forward a template argument that defines the derived event listeners.
  - This tparam should prohibit derivation of the base events; see the example.

```ts
public [on|prependOn|once|prependOnce]<
  Ev extends keyof BaseEvents | keyof DerivedEvents,
  Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>
> { ... }
```

Ev:
- Represents the event passed to the function.

Data:
- Represents the data received by an event listener (parameters array).
  - Set by default to the corresponding `BaseEvents` or `DerivedEvents` value.
- Modified when a filter is provided.

## Usage

```ts
import { Emitter } from "ts-ev";

class Foo<
  DerivedEvents extends Emitter.Events.Except<"baseEv1" | "baseEv2">
> extends Emitter<
  {
    baseEv1: (requires: number, these: string, args: boolean) => any;
    baseEv2: () => any;
  },
  DerivedEvents
> {
  constructor() {
    super();
    setTimeout(() => this.emit("baseEv1", 1, "foo", true), 100);
    setTimeout(() => this.emit("baseEv2"), 1000);

    // this.emit("derivedEv")    // ts error
    // this.emit("anythingElse") // ts error
  }
}

const foo = new Foo();

// standard on/once/off functionality

await foo.once("baseEv2");
const l = () => console.log("received");
foo.on("baseEv2", l);
foo.off("baseEv2", l);
// or foo.off("baseEv2");
// or foo.off();

// protection

foo.on("baseEv2", l, { protect: true });
foo.off("baseEv2"); // does not remove the above listener
foo.off(); // does not remove the above listener
foo.off("baseEv2", l); // OK

// filtering

foo.on(
  "baseEv1",
  // TS Types:
  //   (parameter) a: 1
  //   (parameter) b: "foo"
  //   (parameter) c: boolean
  (a, b, c) => console.log(a, b, c),
  {
    // note: must explicitly specify both the source and expected type
    filter: (data: [number, string, boolean]): data is [1, "foo", boolean] =>
      data[0] === 1 && data[1] === "foo",
  }
);

// TS Types:
//   const two: 2
//   const baz: "baz"
const [two, baz] = await foo.once("baseEv1", {
  filter: (data: [number, string, boolean]): data is [2, "bar", boolean] =>
    data[0] === 2 && data[1] === "baz",
});

// inheritance

// extending the Foo emitter
// note: this only works because Foo passes its DerivedEvents tparam to Emitter
class Bar extends Foo<{
  derivedEv: (add: "more", events: "to", the: "emitter") => any;
}> {
  constructor() {
    super();

    // can operate on base class events
    setTimeout(() => this.emit("baseEv1", 1, "foo", true), 100);
    // can operate on events provided to Foo via OtherEvents
    setTimeout(() => this.emit("derivedEv", "more", "to", "emitter"), 200);
  }
}

const bar = new Bar();
bar.on("baseEv2", () => console.log("receives base class events!"));
bar.on("derivedEv", () => console.log("receives derived class events!"));
```

## Testing

```
npm test
```

Uses [@jpcx/testts](https://github.com/jpcx/testts) for internal unit testing.

Additionally, this project is relied on heavily by my [node-kraken-api](https://github.com/jpcx/node-kraken-api) package, so it has received plenty of integration testing.

## Development

Contribution is welcome! Please raise an issue or make a pull request.

## Author

**Justin Collier** - [jpcx](https://github.com/jpcx)

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/jpcx/ts-ev/blob/0.3.0/LICENSE) file for details
