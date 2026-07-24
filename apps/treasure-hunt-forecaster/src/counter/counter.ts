import { Item } from "../../../../data/ba/inventories.ts";
import { runTasks, Semaphore, Session, Sessions } from "../../../../lib/threading.ts";
import { hasParam } from "../../../../lib/util.ts";
import { assemble, PlacementsAndAmount } from "./assembler.ts";
import { addToCounts, boardPopcnt, getPlacementsFiltered } from "./board95util.ts";
import { counter_cache as cc } from "./cache.ts";

export namespace counter {
  const sessions = new Sessions()
  let running = false
  let runningKey = ''
  let runningPromise: Promise<any> | null = null
  let runningSemaphore: Semaphore | null = null
  let startTime = 0
  let runInfinitely = false
  const terminateHandles = new Set<() => void>()
  let progress = ''
  let progressFraction = 0
  let maxParallel = Math.max(1, navigator.hardwareConcurrency - 1)

  export function isRunning(): boolean {
    return running
  }

  export function isRunningInfinitely(): boolean {
    return running && runInfinitely
  }

  export function getProgress(): string {
    return running ? progress : ''
  }

  export function getProgressFraction(): number {
    return running ? progressFraction : 0
  }

  function setProgress(text: string, fraction: number = 0) {
    progress = text
    progressFraction = fraction
  }

  export function getElapsed(): number {
    return running ? performance.now() - startTime : 0
  }

  export function canStart(board: bigint, items: Item[]): string | null {
    const key = cc.getKey(board, items)
    if (running && runningKey === key && runInfinitely) {
      return null
    }

    if (hasParam('force_start')) {
      return key
    }

    if (cc.hasKey(key)) {
      return null
    }

    return key
  }

  export function setMaxParallel(max: number) {
    maxParallel = max
    runningSemaphore?.update()
  }

  export function abort() {
    if (running === true) {
      console.log('aborting')
      running = false
      for (const handle of terminateHandles) {
        handle()
      }
      sessions.next()
      terminateHandles.clear()
    }
  }

  export async function start(items: Item[], board = 0n, timeout = 0) {
    // console.log(items.join(','), board.toString(2).padStart(45, '0'))
    if (!hasParam('force_start')) {
      const cache = cc.get(board, items)
      if (cache) {
        // console.log(`from cache: ${cache.total.toLocaleString()}`)
        return
      }
    }

    const { sorted, index } = cc.reorderItems(items)
    const key = cc.getKey(board, items)

    if (running) {
      if (runningKey === key) {
        if (timeout === 0) {
          runInfinitely = true
        }
        // wait for the current running one since inputs are the same or similar that can be transformed.
        await runningPromise
        return
      } else {
        abort()
      }
    }

    let session = sessions.next()
    try {
      // prepare placements
      const paa: PlacementsAndAmount[] = sorted.map(([w, h, amount]) => {
        const placements = getPlacementsFiltered(w, h, board)
        return { placements, amount, lengthHint: placements.length }
      })

      // if it's none..
      if (paa.length === 0) {
        return
      }

      // if is single, do it here to prevent crash in assembler
      if (paa.length === 1 && paa[0].amount === 1) {
        const start = performance.now()
        const count = new BigUint64Array(45)
        for (const placement of paa[0].placements) {
          addToCounts(count, placement, 1n)
        }
        const total = BigInt(paa[0].placements.length)
        const time = performance.now() - start
        cc.put(board, sorted, time, total, [count])
        console.log(`single layer: ${time.toFixed(1)}ms, total: ${total.toLocaleString()}`)
        return
      }

      // if it's not even possible in space
      if (boardPopcnt(cc.tightenBoard(board, items)) + items.reduce((p, [w, h, a]) => p + w * h * a, 0) > 45) {
        cc.put(board, items, 0, 0n, items.map(() => new BigUint64Array(45)))
        console.log(`impossible: no space`)
        return
      }

      // or insufficient placement
      if (paa.some(p => p.placements.length < p.amount)) {
        cc.put(board, items, 0, 0n, items.map(() => new BigUint64Array(45)))
        console.log(`impossible: insufficient placement`)
        return
      }

      // check if multithreading is available
      const canMulti = paa.length > 1
        ? paa.reduce((p, v) => p + v.amount, 0) > 4 &&
          !(sorted[0][0] === sorted[1][0] && sorted[0][1] === sorted[1][1]) // different size to prevent order change
        : paa[0].amount > 6
      const doMulti = canMulti // && !noMulti

      running = true
      runningKey = key
      startTime = performance.now()
      runInfinitely = !(timeout > 0)
      terminateHandles.clear()

      // setup timeout
      if (timeout > 0) {
        setTimeout(() => !runInfinitely && session.silentCheck() && abort(), timeout)
      }

      // construct promise
      let promise = run(paa, session, doMulti)
      if (doMulti) {
        promise = promise.catch(() => runMulti(board, sorted, paa, session = sessions.next()))
      }
      runningPromise = promise

      // run
      const { total, count: rawCount } = await promise
      const count = cc.orderArr(rawCount, index, items.length, () => new BigUint64Array(45))
      const time = performance.now() - startTime

      // put result
      cc.put(board, items, time, total, count)

      // cleanup
      if (session.silentCheck()) {
        running = false
        runningPromise = null
        if (terminateHandles.size) {
          console.warn(`${terminateHandles.size} terminate handle not deleted`)
        }
      }

      console.log(`time: ${time.toFixed(1)}ms, total: ${total.toLocaleString()}`)
    } catch (e) {
      if (!session.silentCheck()) return
      abort()
      throw e
    }
  }

  interface RunResult {
    total: bigint;
    count: BigUint64Array[];
  }

  async function run(
    paa: readonly PlacementsAndAmount[],
    session: Session,
    test: boolean = false
  ): Promise<RunResult> {
    setProgress('init')

    let fraction = 0
    const { run, terminate } = await assemble(paa, (p, m) => {
      fraction = p / m
      if (session.silentCheck()) {
        setProgress(`${p}/${m}`, p / m)
      }
    })
    session.check()

    setProgress('dry')
    terminateHandles.add(terminate)
    try {
      if (test) {
        setTimeout(() => {
          if (fraction < 0.1) {
            terminate()
          }
        }, 100)
      }
      const res = await run()
      return res
    } finally {
      terminateHandles.delete(terminate)
    }
  }

  async function runMulti(
    board: bigint,
    sorted: readonly Item[],
    paa: readonly PlacementsAndAmount[],
    session: Session
  ): Promise<RunResult> {
    setProgress('init')
    const depth = Math.min(2, paa[0].amount)
    // const depth = 1
    const canCache = paa[0].amount === depth
    const doCache = canCache && !hasParam('force_start')

    // prepare variables
    const paas = paa.slice(+canCache)
    const items = canCache ? sorted.slice(1) : sorted
    if (!canCache) {
      paas[0] = { placements: paas[0].placements, amount: paas[0].amount - depth, lengthHint: paas[0].lengthHint }
    }

    // result variables
    let totals = 0n
    const counts = Array.from({ length: paa.length }, () => new BigUint64Array(45))
    const p0count = canCache ? counts.shift()! : counts[0]

    // tasks collection
    const runners = new Map<string, () => Promise<void>>()
    const keyless: (() => Promise<void>)[] = []

    // iterate over first layer of placements to generate task
    const { placements } = paa[0]
    for (let i = 0; i < placements.length; i++) {
      const p0 = placements[i]
      const board1 = board | p0
      if (depth === 1) {
        check(board1, canCache ? 0 : i + 1, t => addToCounts(p0count, p0, t))
      } else {
        for (let j = i + 1; j < placements.length; j++) {
          const p1 = placements[j]
          if (board1 & p1) continue
          check(board1 | p1, canCache ? 0 : j + 1, t => {
            addToCounts(p0count, p0, t)
            addToCounts(p0count, p1, t)
          })
        }
      }
    }
    function check(board: bigint, p0slice: number, totalConsumer: (total: bigint) => void) {
      const paa: PlacementsAndAmount[] = paas.map(({ placements, amount, lengthHint }, pi) => ({
        placements: placements.filter((p, i) => (pi > 0 || i >= p0slice) && (board & p) === 0n),
        amount,
        lengthHint
      }))
      if (paa.some(({ placements, amount }) => placements.length < amount)) return

      // consumes result into the result variables
      const consumeResult = (total: bigint, count: BigUint64Array[]) => {
        totals += total
        totalConsumer(total)
        combineCounts(counts, count)
        session.check()
      }
      // run assembler
      const runAssemble = async () => {
        const { run, terminate } = await assemble(paa)
        session.check()
        terminateHandles.add(terminate)
        try {
          const res = await run()
          return res
        } finally {
          terminateHandles.delete(terminate)
        }
      }

      if (canCache) {
        const key = cc.getKey(board, items)
        const readFromCache = () => {
          const { total, count } = cc.get(board, items)!
          consumeResult(total, count)
        }
        if (doCache && cc.hasKey(key)) { // exists in cache
          readFromCache()
        } else if (runners.has(key)) { // already has runner
          const parent = runners.get(key)!
          runners.set(key, () => parent().then(readFromCache))
        } else { // create new runner
          runners.set(key, async () => {
            const start = performance.now()
            const { total, count } = await runAssemble()
            cc.put(board, items, performance.now() - start, total, count)
            consumeResult(total, count)
          })
        }
      } else {
        // can't cache, no overlap available, just create all of them as task.
        keyless.push(async () => {
          const { total, count } = await runAssemble()
          consumeResult(total, count)
        })
      }
    }

    // join tasks
    const tasks = [...runners.values(), ...keyless]
    //   .map((t, i) => async () => {
    //     console.log(`task ${i} start`)
    //     try {
    //       await t()
    //     } catch (e) {
    //       console.warn(`task ${i} failed`, e)
    //     }
    //     console.log(`task ${i} done`)
    //   })
    // console.log(`tasks generated`)
    const length = tasks.length

    // create semaphore
    const semaphore = new Semaphore(() => maxParallel)
    runningSemaphore = semaphore

    // run tasks
    await runTasks(tasks, semaphore, session, p => {
      if (session.silentCheck()) {
        setProgress(`${p}/${length}`, p / length)
      }
    })

    // unshift p0 into result
    if (canCache) {
      counts.unshift(p0count)
    }

    // cleanup
    if (runningSemaphore === semaphore) {
      runningSemaphore = null
    }

    return {
      total: totals,
      count: counts
    }
  }
}

// basically target += source
function combineCounts(target: BigUint64Array[], source: BigUint64Array[]) {
  for (let a = 0; a < target.length; a++) {
    const t = target[a]
    const s = source[a]
    for (let i = 0; i < 45; i++) {
      t[i] += s[i]
    }
  }
}

async function test() {
  // for (let i = 0; i < 3; i++) {
  //   console.log(`run #${i + 1}`)
  //   await counter.start([[4, 1, 2], [1, 3, 3], [2, 1, 1]], 0n, 600000)
  // }

  // await counter.start([[3, 1, 1]], 0n, 600000)
  // await counter.start([[3, 1, 2]], 0n, 600000)
  // await counter.start([[3, 1, 3]], 0n, 600000)
  // await counter.start([[3, 1, 4]], 0n, 600000)
  // await counter.start([[3, 1, 5]], 0n, 600000)
  // await counter.start([[3, 1, 6]], 0n, 600000)
  // await counter.start([[3, 1, 7]], 0n, 600000)
  // await counter.start([[3, 1, 8]], 0n, 600000)
  // await counter.start([[3, 1, 9]], 0n, 600000)
  // await counter.start([[3, 1, 10]], 0n, 600000)
  // await counter.start([[3, 1, 11]], 0n, 600000)
  // await counter.start([[3, 1, 12]], 0n, 600000)
  // await counter.start([[3, 1, 13]], 0n, 600000)
  // await counter.start([[3, 1, 14]], 0n, 600000)
  // await counter.start([[3, 1, 15]], 0n, 600000)
  // await counter.start([[3, 1, 16]], 0n, 600000)

  // await counter.start([[2, 1, 12]], 0b110000000_110000000_110000000_100000000_000000000n, 30000)
  // await counter.start([[2, 1, 12]], 0b110000000_110000000_110000000_100000000_000000000n, 30000)
  // await counter.start([[1, 3, 2], [2, 1, 7]], 0b110000000_110000000_110000000_100000000_111100000n, 60000)
  // await counter.start([[2, 1, 12]], 0b110000000_110000000_110000000_100000000_000000000n, 30000)
  // await counter.start([[2, 1, 12]], 0b110000000_110000000_110000000_100000000_000000000n, 30000)
  // await counter.start([[2, 1, 12]], 0b000000000_000000001_000000011_000000011_000000011n, 30000)
  // await counter.start([[2, 1, 12]], 0b000000000_100000000_110000000_110000000_110000000n, 30000)
  // await counter.start([[2, 1, 12]], 0b000000011_000000011_000000011_000000001_000000000n, 30000)
  // console.log(`Past test wasm time: 10829.9ms, total: 1,538,722,246`)

  // await counter.start([[4, 1, 2], [1, 3, 3], [2, 1, 6]], 0n, 600000)
  // wasm time: 267417.1ms, total: 1,147,909,546,422
  // that's a crazy amount
  // [[4, 1, 2], [3, 1, 4], [2, 1, 6]]
  // time: 470321.2ms, total: 1,361,335,421,122
  // even crazier
}

test()
