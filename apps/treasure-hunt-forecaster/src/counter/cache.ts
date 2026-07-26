// stores (pre)computed counter results

// an entry needs to store:
// a tight 45-bit board which is derived from available placements. as raw.
// amount of item types. as the 3 bit space the previous field left.
// the items' width, height and amount. one byte for each.
// executed time as 10*ms as leb128.u64.
// total amount as leb128.u64.
// each item type's each slot's amount as leb128.u64. uses back referencing.
//  lengths vary derived from individual valid placements.

// key should contain board and items.
// to reduce lookup time, board should be rotated/flipped and use the smallest as chosen one.
// lookup can just use the same way to get the key and then transform the entry back.

import { Item } from "../../../../data/ba/inventories.ts";
import { downloadBlob } from "../../../../lib/util.ts";
import { flatU8A } from "../../../../lib/wasm/deepu8a.ts";
import { leb128 } from "../../../../lib/wasm/leb128.ts";
import { getPlacementCoverage } from "./board95util.ts";
import { codec } from "./codec.ts";
import cacheFile from "./cache.bin?url";

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

  const entries = new Map<string, CacheEntry>()
  const db = new Promise<IDBDatabase>((res, rej) => {
    const req = indexedDB.open('th-counter-cache', 1)
    req.onsuccess = e => res(req.result)
    req.onerror = e => rej()
    req.onblocked = e => rej()
    req.onupgradeneeded = e => {
      const db = req.result
      db.onerror = e => rej()
      const os = db.createObjectStore('entries', { keyPath: 'key' })
      os.createIndex('bin', 'bin', { unique: false })
    }
  }).catch(() => null)

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
    count: readonly BigUint64Array[],
    fromPersistentStorage = false
  ) {
    board = tightenBoard(board, items)
    const { key, transform, index, itemBytes } = _getKey(board, items)
    const entry = new CacheEntry(
      transformBoard[transform](board),
      Uint8Array.from(itemBytes),
      time,
      total,
      index.map(i => transformCount[transform](count[i]))
    )
    entries.set(key, entry)

    if (!fromPersistentStorage && entry.time > 1000) {
      db.then(db => {
        if (!db) return
        const store = db.transaction('entries', 'readwrite').objectStore('entries')
        store.put({ key, bin: entry.encode() })
      })
    }
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
    setTimeout(res, 5000) // sets a timeout to not stuck the counter
    Promise.all([
      fetch(cacheFile)
        .then(res => res.bytes())
        .then(buf => {
          let cursor = 0
          let total = 0
          while (cursor < buf.length) {
            const entry = CacheEntry.decode(buf.subarray(cursor), l => cursor += l)
            put(entry.board, entry.getNormalItems(), entry.time, entry.total, entry.count, true)
            total++
          }
          console.log(`Loaded ${total} cache entries from website (${entries.size})`)
        })
        .catch(e => console.error('Cache file load failed:', e)),
      db.then(db => new Promise<void>((res, rej) => {
        if (!db) {
          console.error(`Database open failed.`)
          return
        }
        const store = db.transaction('entries', 'readonly').objectStore('entries')
        const req = store.getAll()
        req.onsuccess = e => {
          let total = 0
          for (const { bin } of req.result) {
            const entry = CacheEntry.decode(bin)
            put(entry.board, entry.getNormalItems(), entry.time, entry.total, entry.count, true)
            total++
          }
          console.log(`Loaded ${total} cache entries from IndexedDB (${entries.size})`)
          res()
        }
        req.onerror = e => rej(req.error)
      }))
      .catch(e => console.error('IndexedDB Cache load failed:', e))
    ]).then(() => res())
  })

  export async function testCodec() {
    if (!entries.size) {
      console.log('No cache available for test.')
      return
    }
    console.log(`Testing cache codec for ${entries.size} entries...`)
    let passed = 0
    const encodes: Uint8Array<ArrayBuffer>[] = []
    try {
      for (const entry of entries.values()) {
        // tried gcd, they're all 1.
        // deduping isn't that efficient.
        const data = entry.encode()
        if (entry.equals(CacheEntry.decode(data))) {
          encodes.push(data)
          passed++
        }
      }
    } catch (e) {
      console.error(e)
    }
    console.log(`Test passed: ${passed}/${entries.size}`)

    const encodeSizes = encodes.map(v => v.length)
    console.log(`Encode size min/max/avg: ${
      encodeSizes.reduce((p, v) => p < v ? p : v)}/${
      encodeSizes.reduce((p, v) => p > v ? p : v)}/${
      (encodeSizes.reduce((p, v) => p + v) / encodeSizes.length).toFixed(2)
    }`)

    // console.log('compressing')
    // const blob = new Blob(encodes)
    // const totalSize = blob.size
    // const gz = new CompressionStream('gzip')
    // const writer = gz.writable.getWriter()
    // ;(async () => {
    //   await writer.write(await blob.arrayBuffer())
    //   await writer.close()
    // })()
    // let compressedSize = 0
    // for await (const chunk of gz.readable.values()) {
    //   compressedSize += chunk.byteLength
    // }
    // console.log(`Total: ${totalSize}, Compressed: ${compressedSize}, Efficiency: ${(compressedSize / totalSize).toFixed(2)}, Avg: ${(compressedSize / encodes.length).toFixed(2)}bytes per entry`)
  }

  export function size(): number {
    return entries.size
  }

  /**
   * @returns entries left in the cache
   */
  export function drop(thresholdMs: number) {
    let total = 0
    for (const [key, entry] of entries.entries()) {
      if (entry.time < thresholdMs) {
        entries.delete(key)
      } else {
        total++
      }
    }
    return total
  }

  export function download(thresholdMs: number) {
    const data: Uint8Array<ArrayBuffer>[] = []
    let total = 0
    for (const entry of entries.values()) {
      if (entry.time < thresholdMs) continue
      data.push(entry.encode())
      total++
    }
    downloadBlob('cache.bin', new Blob(data))
    console.log(`downloading ${total} entries`)
  }
}

class CacheEntry {
  readonly board: bigint
  /**
   * [width, height, amount][].flat()
   */
  readonly items: Uint8Array
  readonly time: number
  readonly total: bigint
  readonly count: readonly BigUint64Array[]

  constructor(tightBoard: bigint, items: Uint8Array, time: number, total: bigint, count: BigUint64Array[]) {
    this.board = tightBoard
    this.items = items
    this.time = time
    this.total = total
    this.count = count
  }

  getNormalItems(): Item[] {
    const res: Item[] = []
    for (let i = 0; i < this.items.length; i += 3) {
      res.push([this.items[i], this.items[i + 1], this.items[i + 2]])
    }
    return res
  }

  encode(): Uint8Array<ArrayBuffer> {
    const itemTypes = this.items.length / 3
    if (itemTypes > 7) {
      throw new Error(`Cache encode failed: too many items (${itemTypes})`)
    }
    const stack: bigint[] = [this.total]
    return flatU8A([
      // board and types
      Number(this.board >> 40n & 0b11111n) | (itemTypes << 5),
      Number(this.board >> 32n & 255n),
      Number(this.board >> 24n & 255n),
      Number(this.board >> 16n & 255n),
      Number(this.board >>  8n & 255n),
      Number(this.board        & 255n),
      // item settings
      Uint8Array.from({ length: itemTypes }, (_, i) => {
        const item = this.items.subarray(i * 3, i * 3 + 3)
        return codec.item.encode(item[0], item[1], item[2])
      }),
      // time
      leb128.u64(Math.round(this.time * 10)),
      // total
      leb128.u64(this.total),
      // count
      Array.from({ length: itemTypes }, (_, i) => {
        const mask = getPlacementCoverage(this.items[i * 3], this.items[i * 3 + 1], this.board)
        const arr = this.count[i]
        const res: Uint8Array[] = []

        for (let i = 0n; i < 45n; i++) {
          if ((mask & (1n << i)) === 0n) {
            if (arr[Number(i)]) {
              throw new Error(`Cache encode failed: count data loss`)
            }
            continue
          }

          let v = arr[Number(i)]
          const si = stack.indexOf(v)
          if (si >= 0 && si < 256) {
            v = BigInt(si)
          } else {
            stack.unshift(v)
            v += 256n
          }

          res.push(leb128.u64(v))
        }
        return res
      })
    ])
  }

  static decode(bytes: Uint8Array, byteLengthConsumer: (length: number) => void = () => {}) {
    const ensureLength = (len: number) => {
      if (bytes.length < len) {
        throw new Error(`Cache decode failed: insufficient length`)
      }
    }
    ensureLength(8)

    let board = 0n
    let cursor = 0
    while (cursor < 6) {
      board = (board << 8n) | BigInt(bytes[cursor++])
    }

    const itemTypes = Number(board >> 45n) & 0b111
    board &= (1n << 45n) - 1n
    ensureLength(8 + itemTypes)

    const items: Item[] = []
    for (let i = 0; i < itemTypes; i++) {
      items.push(codec.item.decode(bytes[cursor++]))
    }

    const time = Number(leb128.decodeU64(bytes.subarray(cursor), l => cursor += l)) / 10
    const total = leb128.decodeU64(bytes.subarray(cursor), l => cursor += l)
    const count: BigUint64Array[] = []

    const stack: bigint[] = [total]

    for (const [w, h] of items) {
      const mask = getPlacementCoverage(w, h, board)
      const arr = new BigUint64Array(45)

      for (let i = 0n; i < 45n; i++) {
        if ((mask & (1n << i)) === 0n) {
          continue
        }
        let v = leb128.decodeU64(bytes.subarray(cursor), l => cursor += l)
        if (v < 256) {
          v = stack[Number(v)]
        } else {
          v -= 256n
          stack.unshift(v)
        }
        arr[Number(i)] = v
      }
      count.push(arr)
    }

    byteLengthConsumer(cursor)
    return new CacheEntry(board, Uint8Array.from(items.flat()), time, total, count)
  }

  equals(other: CacheEntry): boolean {
    if (this.board !== other.board) return false
    if (this.total !== other.total) return false
    if (Math.abs(this.time - other.time) > 0.01) return false
    if (this.items.length !== other.items.length) return false
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i] !== other.items[i]) return false
    }
    for (let i = 0; i < this.count.length; i++) {
      const a = this.count[i]
      const b = other.count[i]
      if (!a) {
        console.log(this)
      }
      for (let i = 0; i < 45; i++) {
        if (a[i] !== b[i]) return false
      }
    }
    return true
  }
}
