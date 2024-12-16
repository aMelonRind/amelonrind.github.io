/* tslint:disable */
/* eslint-disable */
export function test(a: Uint32Array): bigint;
export class Universe {
  private constructor();
  free(): void;
  static new(width: number, height: number, seed: bigint, cursor_place_chance: number): Universe;
  tick(): void;
  cross(x: number, y: number): void;
  cursor_place(x: number, y: number): void;
  width(): number;
  height(): number;
  cells(): number;
  size(): number;
  resize(width: number, height: number): void;
  fill_random(): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly test: (a: number, b: number) => bigint;
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
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
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
