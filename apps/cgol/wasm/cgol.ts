import { hasParam } from "../../../lib/util";
import wasmUrl from "./cgol_bg.wasm?url";
import wasmBugUrl from "./cgol_bg_bug.wasm?url";

let wasm: InitOutput;
let cachedTextDecoder: Pick<TextDecoder, 'decode'> | null = null;
let cachedUint8ArrayMemory0: Uint8Array | null = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr: number, len: number) {
    if (!cachedTextDecoder) {
        const hasTD = typeof TextDecoder !== 'undefined';
        cachedTextDecoder = hasTD
            ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true })
            : { decode: () => { throw Error('TextDecoder not available') } };
        if (hasTD) {
            cachedTextDecoder.decode();
        }
    }
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const UniverseFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry<number>(ptr => wasm.__wbg_universe_free(ptr >>> 0, 1));

export class Universe {
    private __wbg_ptr!: number;
    private constructor() {}

    private static __wrap(ptr: number): Universe {
        ptr = ptr >>> 0;
        const obj = Object.create(Universe.prototype);
        obj.__wbg_ptr = ptr;
        UniverseFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    private __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        UniverseFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_universe_free(ptr, 0);
    }

    static new(width: number, height: number, seed: bigint, cursor_place_chance: number): Universe {
        const ret = wasm.universe_new(width, height, seed, cursor_place_chance);
        return Universe.__wrap(ret);
    }
    tick() {
        wasm.universe_tick(this.__wbg_ptr);
    }

    cross(x: number, y: number) {
        wasm.universe_cross(this.__wbg_ptr, x, y);
    }

    cursor_place(x: number, y: number) {
        wasm.universe_cursor_place(this.__wbg_ptr, x, y);
    }

    width() {
        return wasm.universe_width(this.__wbg_ptr) >>> 0;
    }

    height() {
        return wasm.universe_height(this.__wbg_ptr) >>> 0;
    }

    cells() {
        return wasm.universe_cells(this.__wbg_ptr) >>> 0;
    }

    size() {
        return wasm.universe_size(this.__wbg_ptr) >>> 0;
    }

    resize(width: number, height: number) {
        wasm.universe_resize(this.__wbg_ptr, width, height);
    }
    fill_random() {
        wasm.universe_fill_random(this.__wbg_ptr);
    }
    clear() {
        wasm.universe_clear(this.__wbg_ptr);
    }
}

async function __wbg_load(module: Response, imports: WebAssembly.Imports) {
    if (typeof WebAssembly.instantiateStreaming === 'function') {
        try {
            return await WebAssembly.instantiateStreaming(module, imports);
        } catch (e) {
            if (module.headers.get('Content-Type') != 'application/wasm') {
                console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
            } else {
                throw e;
            }
        }
    }

    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
}

function __wbg_get_imports() {
    const imports: WebAssembly.Imports = {};
    imports.wbg = {};
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_0;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_throw = function(arg0: number, arg1: number) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_finalize_init(instance: WebAssembly.Instance, module: WebAssembly.Module) {
    wasm = instance.exports as unknown as InitOutput;
    cachedUint8ArrayMemory0 = null;

    wasm.__wbindgen_start();
    return wasm;
}

export default async function __wbg_init(): Promise<InitOutput> {
    if (wasm !== undefined) return wasm;
    const imports = __wbg_get_imports();
    const res = fetch(new URL(hasParam('broken') ? wasmBugUrl : wasmUrl, import.meta.url));
    const { instance, module } = await __wbg_load(await res, imports);
    return __wbg_finalize_init(instance, module);
}

interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_universe_free: (a: number, b: number) => void;
  readonly universe_new: (a: number, b: number, c: bigint, d: number) => number;
  readonly universe_tick: (a: number) => void;
  readonly universe_cross: (a: number, b: number, c: number) => void;
  readonly universe_cursor_place: (a: number, b: number, c: number) => void;
  readonly universe_width: (a: number) => number;
  readonly universe_height: (a: number) => number;
  readonly universe_cells: (a: number) => number;
  readonly universe_size: (a: number) => number;
  readonly universe_resize: (a: number, b: number, c: number) => void;
  readonly universe_fill_random: (a: number) => void;
  readonly universe_clear: (a: number) => void;
  readonly test: (a: number, b: number) => bigint;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_start: () => void;
}
