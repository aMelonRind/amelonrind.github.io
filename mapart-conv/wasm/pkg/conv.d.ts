/* tslint:disable */
/* eslint-disable */
export function test(a: Uint8Array): bigint;
export function test_overhead(arr: Uint8Array): number;
export class ColorProfile {
  private constructor();
  free(): void;
  static new(rawcolors: Uint32Array): ColorProfile;
  palette(): number;
  paint(data: Uint8Array): Uint8Array;
  create_indexed_png(width: number, height: number, pixels: Uint8Array, compression_level: number): Uint8Array;
  convert_nearest(abgrarr: Int32Array): Uint8Array;
  rmean_near(r: number, g: number, b: number, a: number): number;
}
/**
 * for litematica generater
 */
export class LongArrBuilder {
  private constructor();
  free(): void;
  static new(palettelen: number, map: Uint16Array, volume: bigint): LongArrBuilder;
  push(layer: Uint16Array): void;
  finalize(): void;
  longarr(): number;
  len(): number;
  total(): number;
}
/**
 * for block type schematics
 */
export class WasmU16Counter {
  private constructor();
  free(): void;
  static new(max: number): WasmU16Counter;
  count(layer: Uint16Array): void;
  ptr(): number;
  len(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_colorprofile_free: (a: number, b: number) => void;
  readonly colorprofile_new: (a: number, b: number) => number;
  readonly colorprofile_palette: (a: number) => number;
  readonly colorprofile_paint: (a: number, b: number, c: number) => [number, number];
  readonly colorprofile_create_indexed_png: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly colorprofile_convert_nearest: (a: number, b: number, c: number) => [number, number];
  readonly colorprofile_rmean_near: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly test: (a: number, b: number) => bigint;
  readonly test_overhead: (a: number, b: number) => number;
  readonly __wbg_wasmu16counter_free: (a: number, b: number) => void;
  readonly wasmu16counter_new: (a: number) => number;
  readonly wasmu16counter_count: (a: number, b: number, c: number) => void;
  readonly wasmu16counter_ptr: (a: number) => number;
  readonly wasmu16counter_len: (a: number) => number;
  readonly __wbg_longarrbuilder_free: (a: number, b: number) => void;
  readonly longarrbuilder_new: (a: number, b: number, c: number, d: bigint) => number;
  readonly longarrbuilder_push: (a: number, b: number, c: number) => [number, number];
  readonly longarrbuilder_finalize: (a: number) => void;
  readonly longarrbuilder_longarr: (a: number) => number;
  readonly longarrbuilder_len: (a: number) => number;
  readonly longarrbuilder_total: (a: number) => number;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
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
