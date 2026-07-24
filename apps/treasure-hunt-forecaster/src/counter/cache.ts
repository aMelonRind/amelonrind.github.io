// stores (pre)computed counter results

// an entry needs to store:
// content byte length, for decoders that doesn't know how to read and skip this, can be omitted if in a collection.
// their version, can be omitted if in a collection.
// a tight 45-bit board which is derived from available placements. as leb128.u64.
// amount of item types.
// the items' width, height and amount.
// executed time as 10*ms as leb128.u64.
// total amount as leb128.u64.
// each item type's each slot's amount as leb128.u64. lengths vary derived from individual valid placements.

// key should contain board and items.
// to reduce lookup time, board should be rotated/flipped and use the smallest as chosen one.
// lookup can just use the same way to get the key and then transform the entry back.

import { Item } from "../../../../data/ba/inventories";
import { getPlacementCoverage } from "./board95util";

// transforms are bi-directional
const enum Transform {
  NONE = 0,
  ROTATE = 1,
  FLIP_H = 2,
  FLIP_V = 3
}

export namespace counter_cache {

  const transformBoard: { [K in Transform]: (board: bigint) => bigint } = {
    [Transform.NONE]: board => board & ((1n << 45n) - 1n),
    [Transform.ROTATE]: board => _transformBoard(board, 45, 1n, 1n),
    [Transform.FLIP_H]: board => _transformBoard(board, 9, 1n, 0b1_000000001_000000001_000000001_000000001n),
    [Transform.FLIP_V]: board => _transformBoard(board, 5, 9n, 0b111111111n)
  }

  function _transformBoard(board: bigint, times: number, shift: bigint, mask: bigint) {
    let newBoard = 0n
    for (let i = 0n; i < times; i++) {
      newBoard = (newBoard << shift) | (board & mask)
      board >>= shift
    }
    return newBoard
  }

  const transformCount: { [K in Transform]: (board: BigUint64Array) => BigUint64Array } = {
    [Transform.NONE]: count => count.slice(),
    [Transform.ROTATE]: count => count.toReversed(),
    [Transform.FLIP_H]: count => {
      const newCount = new BigUint64Array(45)
      for (let y = 0; y < 5; y++) {
        const r = y * 9
        for (let x = 0; x < 9; x++) {
          newCount[r + 8 - x] = count[r + x]
        }
      }
      return newCount
    },
    [Transform.FLIP_V]: count => {
      const newCount = new BigUint64Array(45)
      for (let y = 0; y < 5; y++) {
        const r = y * 9
        const t = (4 - y) * 9
        for (let x = 0; x < 9; x++) {
          newCount[t + x] = count[r + x]
        }
      }
      return newCount
    }
  }

  // use IndexedDB when this grow large.
  const entries = new Map<string, EntryV1>()

  /**
   * sort as large to small, many to less.  
   * ensure width larger than height.  
   * index length may be smaller because items with 0 amount will get filtered.
   */
  export function reorderItems(items: readonly Item[]): { sorted: Item[], index: number[] } {
    const sorted: (readonly [Item, index: number])[] = items
      .map((item, i) => [item[1] > item[0] ? [item[1], item[0], item[2]] : item, i] as [Item, index: number])
      .filter(([[w, h, a]]) => w > 0 && h > 0 && a > 0)
      .toSorted(([b], [a]) =>
        a[0] * a[1] - b[0] * b[1] || // area
        a[1] - b[1] || // height
        a[2] - b[2] // amount
      )
    return {
      sorted: sorted.map(([item]) => item),
      index: sorted.map(([, i]) => i)
    }
  }

  /**
   * order array with the index got from reorderItems
   */
  export function orderArr<T>(
    arr: readonly T[],
    index: readonly number[],
    expectedLength: number,
    empty: () => T,
    transformer: (input: T) => T = v => v
  ): T[] {
    const newArr: T[] = []
    index.forEach((v, i) => newArr[v] = transformer(arr[i]))
    if (newArr.length > expectedLength) {
      throw new Error(`Array order failed`)
    }
    for (let i = 0; i < expectedLength; i++) {
      newArr[i] ??= empty()
    }
    return newArr
  }

  export function tightenBoard(board: bigint, items: readonly Item[]): bigint {
    let tight = (1n << 45n) - 1n
    for (const [w, h, c] of items) {
      if (!(c > 0)) continue
      tight &= ~getPlacementCoverage(w, h, board)
    }
    return tight
  }

  export function getKey(board: bigint, items: readonly Item[]): string {
    return _getKey(tightenBoard(board, items), items).key
  }

  function _getKey(
    board: bigint, items: readonly Item[]
  ): { key: string, transform: Transform, index: number[], itemBytes: number[] } {
    let min = board
    let transform = Transform.NONE

    // get smallest board
    for (let i = 0; i < 4; i++) {
      const newBoard = transformBoard[i as Transform](board)
      if (newBoard < min) {
        min = newBoard
        transform = i as Transform
      }
    }

    const { sorted, index } = reorderItems(items)
    const itemArr = sorted.flat()

    return {
      key: `${min.toString(36)},${itemArr.map(v => v.toString(36)).join('')}`,
      transform,
      index,
      itemBytes: itemArr
    }
  }

  export function put(
    board: bigint,
    items: readonly Item[],
    time: number,
    total: bigint,
    count: readonly BigUint64Array[]
  ) {
    board = tightenBoard(board, items)
    const { key, transform, index, itemBytes } = _getKey(board, items)
    const entry = new EntryV1(
      transformBoard[transform](board),
      Uint8Array.from(itemBytes),
      time,
      total,
      index.map(i => transformCount[transform](count[i]))
    )
    entries.set(key, entry)
  }

  export function get(
    board: bigint, items: readonly Item[]
  ): { time: number, total: bigint, count: BigUint64Array[] } | null {
    board = tightenBoard(board, items)
    const { key, transform, index } = _getKey(board, items)
    const entry = entries.get(key)
    if (!entry) return null

    const count = orderArr(
      entry.count,
      index,
      items.length,
      () => new BigUint64Array(45),
      transformCount[transform]
    )

    return { time: entry.time, total: entry.total, count }
  }

  export function hasKey(key: string) {
    return entries.has(key)
  }

  export const waitForCache = new Promise<void>(res => {
    res()
    // todo: cache file
  })
}

class Entry {
  protected bytesVersion: number = 0
  /**
   * stores the encoded bytes possibly in lower version.
   * there's no reason to re-encode it to possibly larger bytes in a higher version if info is missing.
   */
  protected bytes: Uint8Array | null = null
}

class EntryV1 extends Entry {
  readonly board: bigint
  /**
   * [width, height, amount][].flat()
   */
  readonly items: Uint8Array
  readonly time: number
  readonly total: bigint
  readonly count: readonly BigUint64Array[]

  constructor(tightBoard: bigint, items: Uint8Array, time: number, total: bigint, count: BigUint64Array[]) {
    super()
    this.board = tightBoard
    this.items = items
    this.time = time
    this.total = total
    this.count = count
  }

  encode() {}

  static decode() {}
}
