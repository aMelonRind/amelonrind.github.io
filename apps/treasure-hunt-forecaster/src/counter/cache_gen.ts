import { inventories, Item, ItemSet } from "../../../../data/ba/inventories.ts";
import { hasParam } from "../../../../lib/util.ts";
import { boardToString, getPlacementsFiltered } from "./board95util.ts";
import { counter_cache as cc } from "./cache.ts";
import { counter } from "./counter.ts";

// 1000 is too low, 5000 is too low, 60000 is too low...
// how about just no precompute, huh? fuck the users, do it yourself /j
const CACHE_THRESHOLD = 60000

export async function genCache() {
  if (!hasParam('no_multi_cache')) {
    console.warn('param no_multi_cache not present! aborting genCache.')
    return
  }
  if (!hasParam('noauto')) {
    console.warn('param noauto not present! aborting genCache.')
    return
  }

  await cc.waitForCache
  let total = 0
  const isFirst = !cc.size()
  console.log(`genCache starting with isFirst=${isFirst}`)
  for (const { items: itemSets } of inventories) {
    for (const items of itemSets) {
      total++
      if (isFirst || (cc.get(0n, items)?.time ?? 0) > CACHE_THRESHOLD) {
        await run(items)
      }
      //@ts-expect-error
      globalThis.cacheGenProgress = `${total}/52 (${cc.size()})`
    }
  }
  console.log(`genCache finished (${total}) (${cc.drop(CACHE_THRESHOLD)})`)
}

/**
 * @returns can break early
 */
async function run(items: readonly Item[], board: bigint = 0n): Promise<boolean> {
  const info = `${JSON.stringify(items)} ${boardToString(board)}`
  //@ts-expect-error
  globalThis.cacheGenRunning = info
  // run it
  const t = setTimeout(() => console.log(info), CACHE_THRESHOLD * 3)
  await counter.start(items, board)
  clearTimeout(t)
  //@ts-expect-error
  globalThis.cacheGenRunning = ''

  // return if fast enough
  const entry = cc.get(board, items)
  if (!entry) return true
  if (entry.time < CACHE_THRESHOLD) {
    return entry.time < CACHE_THRESHOLD * 0.75
  }

  // iterate slots
  for (const i of filterSlotCandidate(entry.count)) {
    const slot = 1n << BigInt(i)
    if (board & slot) continue
    if (await run(items, board | slot)) break
  }

  // iterate items
  for (let i = 0; i < items.length; i++) {
    const clone = items.slice()
    const [w, h, a] = clone[i]
    if (!(a > 0)) continue
    clone[i] = [w, h, a - 1]

    for (const plac of getPlacementsFiltered(w, h, board)) {
      if (await run(clone, board | plac)) break
    }
  }

  return false
}

function filterSlotCandidate(counts: BigUint64Array[]) {
  const set = new Set<number>()
  const sum = BigUint64Array.from({ length: 45 }, (_, i) => counts.reduce((p, v) => p + v[i], 0n))

  // for (const i of [0, 8, 10, 16, 22, 28, 34, 36, 44]) {
  //   if (sum[i]) {
  //     set.add(i)
  //   }
  // }

  for (const c of [...counts, sum]) {
    // i'm probably too greedy allocating this range, my laptop cannot handle this
    // const l = [...new Set(c.values())].sort((b, a) => Number(a - b))
    // const t = l[Math.min(2, l.length - 1)] || 1n

    const t = c.reduce((p, v) => p > v ? p : v) || 1n

    for (const [i, v] of c.entries()) {
      if (v >= t) {
        set.add(i)
      }
    }
  }

  return set
}

/**
 * Horrible idea
 */
function* itemSetGen(): Generator<ItemSet> {
  const sizes: [width: number, height: number][] = [
    [3, 3], [4, 2], [3, 2], [2, 2], [4, 1], [3, 1], [2, 1]
  ]
  
  for (let a = 0; a < 7; a++) {
    const [aw, ah] = sizes[a]
    for (let b = a + 1; b < 7; b++) {
      const [bw, bh] = sizes[b]
      for (let c = b + 1; c < 7; c++) {
        const [cw, ch] = sizes[c]
        
        for (let x = 1; x <= 3; x++) {
          for (let y = 1; y <= 6; y++) {
            for (let z = 1; z <= 8; z++) {
              yield [[aw, ah, x], [bw, bh, y], [cw, ch, z]]
            }
          }
        }
      }
    }
  }
}
