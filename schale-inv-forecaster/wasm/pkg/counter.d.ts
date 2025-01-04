/* tslint:disable */
/* eslint-disable */
export function set_panic_hook(): void;
export class Board {
  free(): void;
  constructor(board: bigint);
  push(w: number, h: number, count: number): void;
  count(): CountResult;
}
export class CountResult {
  private constructor();
  free(): void;
  get(index: number): BigUint64Array;
  readonly total: bigint;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_board_free: (a: number, b: number) => void;
  readonly __wbg_countresult_free: (a: number, b: number) => void;
  readonly board_new: (a: bigint) => [number, number, number];
  readonly board_push: (a: number, b: number, c: number, d: number) => [number, number];
  readonly board_count: (a: number) => [number, number, number];
  readonly countresult_total: (a: number) => bigint;
  readonly countresult_get: (a: number, b: number) => [number, number];
  readonly set_panic_hook: () => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
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
