/* tslint:disable */
/* eslint-disable */
export function set_panic_hook(): void;
export function calc(levels: (LevelSet)[], requires: Uint32Array, ap_ceil: number): CalcResult;
export class CalcResult {
  private constructor();
  free(): void;
  readonly count: bigint;
  readonly ap: number;
  readonly amounts: Uint32Array;
}
export class LevelSet {
  free(): void;
  constructor(amounts: Uint32Array, ap: number, items: Uint32Array, bitflag: number);
}
export class RawLevel {
  private constructor();
  free(): void;
}
export class RawLevels {
  free(): void;
  constructor(item_types: number);
  push(index: number, ap: number, items: Uint32Array): void;
  approach2(req: Uint32Array): CalcResult;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_rawlevel_free: (a: number, b: number) => void;
  readonly __wbg_rawlevels_free: (a: number, b: number) => void;
  readonly rawlevels_new: (a: number) => [number, number, number];
  readonly rawlevels_push: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly rawlevels_approach2: (a: number, b: number, c: number) => [number, number, number];
  readonly __wbg_levelset_free: (a: number, b: number) => void;
  readonly levelset_new: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly __wbg_calcresult_free: (a: number, b: number) => void;
  readonly calc: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly calcresult_count: (a: number) => bigint;
  readonly calcresult_ap: (a: number) => number;
  readonly calcresult_amounts: (a: number) => [number, number];
  readonly set_panic_hook: () => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
