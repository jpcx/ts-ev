export declare class Emitter<BaseEvents extends {
    [event: string]: (...args: any[]) => any;
}, DerivedEvents extends {
    [event: string]: (...args: any[]) => any;
} = {}> {
    private _evinfo;
    constructor();
    on<Ev extends keyof BaseEvents | keyof DerivedEvents, Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>>(ev: Ev, listener: (...args: Data) => any, options?: {
        filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
        protect?: boolean;
    }): this;
    prependOn<Ev extends keyof BaseEvents | keyof DerivedEvents, Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>>(ev: Ev, listener: (...args: Data) => any, options?: {
        filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
        protect?: boolean;
    }): this;
    once<Ev extends keyof BaseEvents | keyof DerivedEvents, Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>>(ev: Ev, listener: (...args: Data) => any, options?: {
        filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
        protect?: boolean;
    }): this;
    once<Ev extends keyof BaseEvents | keyof DerivedEvents, Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>>(ev: Ev, options?: {
        filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
    }): Promise<Data>;
    prependOnce<Ev extends keyof BaseEvents | keyof DerivedEvents, Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>>(ev: Ev, listener: (...args: Data) => any, options?: {
        filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
        protect?: boolean;
    }): this;
    prependOnce<Ev extends keyof BaseEvents | keyof DerivedEvents, Data extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>>(ev: Ev, options?: {
        filter?: DataFilter<BaseEvents, DerivedEvents, Ev, Data>;
    }): Promise<Data>;
    off<Ev extends keyof BaseEvents | keyof DerivedEvents>(ev: Ev, listener: EvListener<BaseEvents, DerivedEvents, Ev>): this;
    off<Ev extends keyof BaseEvents | keyof DerivedEvents>(ev: Ev): this;
    off(): this;
    emit<Ev extends keyof BaseEvents | keyof DerivedEvents>(ev: Ev, ...data: EvData<BaseEvents, DerivedEvents, Ev>): this;
}
export declare module Emitter {
    type Events = {
        [event: string]: (...args: any[]) => any;
    };
    module Events {
        type Except<Ev extends string> = Events & {
            [key in Ev]?: never;
        };
    }
    type DerivedEvents<Exclude extends string> = {
        [event: string]: (...args: any[]) => any;
    } & {
        [event in keyof Exclude]: never;
    };
}
export declare type EvListener<BaseEvents extends {
    [event: string]: (...args: any[]) => any;
}, DerivedEvents extends {
    [event: string]: (...args: any[]) => any;
}, Ev extends keyof BaseEvents | keyof DerivedEvents> = Ev extends keyof BaseEvents ? BaseEvents[Ev] : Ev extends keyof DerivedEvents ? DerivedEvents[Ev] : never;
export declare type EvData<BaseEvents extends {
    [event: string]: (...args: any[]) => any;
}, DerivedEvents extends {
    [event: string]: (...args: any[]) => any;
}, Ev extends keyof BaseEvents | keyof DerivedEvents> = Parameters<EvListener<BaseEvents, DerivedEvents, Ev>>;
export declare type DataFilter<BaseEvents extends {
    [event: string]: (...args: any[]) => any;
}, DerivedEvents extends {
    [event: string]: (...args: any[]) => any;
}, Ev extends keyof BaseEvents | keyof DerivedEvents, Args extends EvData<BaseEvents, DerivedEvents, Ev> = EvData<BaseEvents, DerivedEvents, Ev>> = Exact<Args, EvData<BaseEvents, DerivedEvents, Ev>> extends never ? Ev extends keyof BaseEvents ? (args: Parameters<BaseEvents[Ev]>) => args is Args : Ev extends keyof DerivedEvents ? (args: Parameters<DerivedEvents[Ev]>) => args is Args : never : never;
export declare type Exact<T, U> = (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2 ? T : never;
