import { Maths } from "../../../lib/util.ts";
import { WasmWorker } from "../../../lib/wasm/tool.ts";
import { assemble } from "./assembler.ts";

// bruteForce probably needs optimization
// but it's working and runs under manageable duration, i guess it's fine.

export interface Level {
  ap: number;
  items: Uint32Array;
}

type Sweeps = Uint32Array;

interface SolvedSweeps {
  readonly ap: number;
  readonly ceilAp: number;
  readonly sweeps: Sweeps;
}

type SolveResult = { readonly sweeps: Sweeps, readonly tier: string };
type SolveReturn = { readonly normal: SolveResult, readonly perfect: SolveResult | null } | null;

const TIERS = ['INVALID', 'NORMAL', 'SEMI_PERFECT', 'PERFECT'] as const
export const CRAFT_VALUES = [1, 0.7934660541092394, 0.7254211332312402] as const

export async function solve(
  levels: readonly Level[],
  requires: Uint32Array,
  voids: Uint16Array,
  transfers: Uint8Array
): Promise<SolveReturn> {
  const len = requires.length
  if (levels.some(l => l.items.length !== len) || voids.length !== len || transfers.length !== len) {
    throw `assertion error: inconsistent lengths`
  }

  const solverStart = performance.now()
  const list: SolvedSweeps[] = []
  for (const levelSet of combineLevels(levels.length, len)) {
    const mat = levelSet.map(i => Float64Array.from(levels[i].items))
    const det = roundFloat(determinant(mat.map(v => v.slice())))
    if (det === 0) continue

    const amounts = calculateAmount(len, mat, det, requires)

    const ap = amounts.reduce((p, v, i) => p + v * levels[levelSet[i]].ap, 0)
    const ceilAp = amounts.reduce((p, v, i) => p + Math.ceil(v) * levels[levelSet[i]].ap, 0)
    const sweeps = new Uint32Array(levels.length)
    for (let i = 0; i < len; i++) {
      sweeps[levelSet[i]] = amounts[i]
    }

    list.push({ ap, ceilAp, sweeps })
  }
  console.log(`solver took ${(performance.now() - solverStart).toFixed(2)}ms`)

  if (!list.length) return null

  const ceilMin = Math.min(...list.map(v => v.ceilAp))
  const cand = chooseCandidates(list, Math.min(...list.map(v => v.ap)) + 320, 3)

  console.log(`brute forcing through ${cand.length} candidates.`)
  const identifier = compileIdentifier(voids, transfers)
  const collector = new Collector<Sweeps>(identifier, ceilMin)

  const wasm = await assemble(levels, len, voids, transfers)
  const worker = await wasm.instantiateWorker()
  const pp = isPerfectPossible(levels.map(l => l.items[0]), voids[0], requires[0])

  // const perfectPossible = isPerfectPossible(levels.map(l => l.items[0]), voids[0] || transfers[0], requires[0])
  for (const sweeps of cand) {
    await bruteForce(levels, sweeps, requires, collector, identifier, worker, pp)
  }
  console.log(`normal run finished at ${(performance.now() - solverStart).toFixed(2)}ms`)
  for (const sweeps of cand) {
    const idxs = sweeps.entries().filter(v => v[1]).map(([i]) => i).toArray()
    for (const i of idxs) {
      sweeps[i] += 2
    }
    for (const i of idxs) {
      sweeps[i] -= 4
      await bruteForce(levels, sweeps, requires, collector, identifier, worker, pp)
      sweeps[i] += 4
    }
    for (const i of idxs) {
      sweeps[i] -= 2
    }
  }
  worker.release()
  console.log(`brute force finished at ${(performance.now() - solverStart).toFixed(2)}ms`)
  const normal = collector.holder.toResult()
  return normal && { normal, perfect: collector.perfect.toResult() }
}

function* combineLevels(
  levelSize: number,
  size: number,
  from = 0,
  res = new Array<number>(size)
): Generator<readonly number[]> {
  size--
  if (!size) {
    for (let i = from; i < levelSize; i++) {
      res[0] = i
      yield res as readonly number[]
    }
  } else {
    for (let i = from; i < levelSize; i++) {
      res[size] = i
      yield* combineLevels(levelSize, size, i + 1, res)
    }
  }
}

function chooseCandidates(list: SolvedSweeps[], maxAp: number, decrement: number = 5): Uint32Array[] {
  return Object.values(Object.fromEntries(
    list
      .filter(v => v.ap < maxAp)
      .sort((a, b) => a.ap - b.ap)
      .map(({sweeps}) => {
    sweeps = sweeps.slice()
    for (let i = 0; i < sweeps.length; i++) {
      if (sweeps[i] <= decrement) {
        sweeps[i] = 0
        continue
      }
      sweeps[i] -= decrement
    }
    return [sweeps.join(','), sweeps] as [string, Uint32Array] // dedup
  })))
}

// https://en.wikipedia.org/wiki/Cramer%27s_rule#General_case
function calculateAmount(length: number, mat: Float64Array[], det: number, requires: Uint32Array): Float64Array {
  const amounts = Float64Array.from({ length }, (_, i) => {
    const m = mat.map((v, j) => i === j ? Float64Array.from(requires) : v.slice())
    return roundFloat(determinant(m) / det)
  })

  if (amounts.every(v => v >= 0)) return amounts
  // scale down positive values
  const has = new Float64Array(requires.length)
  for (let i = 0; i < amounts.length; i++) {
    const a = amounts[i]
    if (!a) continue
    if (a < 0) {
      amounts[i] = 0
      continue
    }
    const items = mat[i]
    for (let j = 0; j < has.length; j++) {
      has[j] += a * items[j]
    }
  }
  let multiplier = 0
  for (let i = 0; i < has.length; i++) {
    if (!has[i]) continue
    const m = requires[i] / has[i]
    if (m > multiplier) {
      multiplier = m
    }
  }
  for (let i = 0; i < amounts.length; i++) {
    amounts[i] *= multiplier
  }
  return amounts
}

/**
 * calculates the determinant of a variable sized matrix.  
 * all arrays must be the same length.  
 * arrays will be mutated.  
 */
// https://en.wikipedia.org/wiki/Determinant#Example
function determinant(lines: Float64Array[]) {
  let prod = 1
  for (let index = lines.length - 1; index > 0; index--) {
    let i = index
    while (i >= 0 && Math.abs(lines[i][index]) < 0.000000001) {
      i--
    }
    if (i < 0) return 0
    const mainLine = lines.splice(i, 1)[0]
    const value = mainLine[index]
    prod *= value
    if ((i ^ index) & 1) {
      prod *= -1
    }
    for (const line of lines) {
      if (Math.abs(line[index]) < 0.000000001) continue
      const mul = -line[index] / value
      for (let i = index; i >= 0; i--) {
        line[i] += mainLine[i] * mul
      }
    }
  }
  return prod * lines[0][0]
}

function roundFloat(n: number) {
  return Math.round(n * 9e9) / 9e9
}

async function bruteForce(
  levels: readonly Level[],
  sweeps: Uint32Array,
  requires: Uint32Array,
  mainCollector: Collector<Uint32Array>,
  identifier: TierIdentifier,
  worker: WasmWorker,
  pp: boolean
) {
  const len = requires.length
  const req = Int32Array.from(requires)
  let baseAp = 0
  for (let i = 0; i < sweeps.length; i++) {
    const sw = sweeps[i]
    if (!sw) continue
    const level = levels[i]
    baseAp += sw * level.ap
    const items = level.items
    for (let i = 0; i < len; i++) {
      req[i] -= items[i] * sw
    }
  }

  if (baseAp >= mainCollector.maxAp) return

  const wasmMaxAp = mainCollector.maxAp - baseAp
  const wasmPerfectAp = mainCollector.perfect.tier === Tier.PERFECT ? mainCollector.perfect.ap - baseAp : Infinity

  const collector = new Collector<Uint8Array>(identifier, mainCollector.maxAp - baseAp)
  const items = Int32Array.from(req, v => -v)
  let lastFound = 0

  const consume = (res: Int32Array | number[]) => {
    res = Int32Array.from(res)
    if (res[0] !== 2147483647) {
      collector.consume(
        res[0],
        Uint8Array.from(res.subarray(1).subarray(0, levels.length)),
        Int16Array.from(res.subarray(1 + levels.length).subarray(0, items.length))
      )
      lastFound = res[0]
      return true
    }
    return false
  }

  // find normal
  if (!consume(await worker.invoke('normal', 0, wasmMaxAp, ...items) as number[])) {
    // can't even find normal, return
    return
  }

  // find perfects
  const absMax = Math.min(wasmPerfectAp, lastFound + 100)
  if (!pp || !consume(await worker.invoke('perfect1', lastFound, absMax, ...items) as number[])) {
    if (mainCollector.perfect.tier <= Tier.SEMI_PERFECT) {
      consume(await worker.invoke('semiPerfect1', lastFound, absMax, ...items) as number[])
    }
  }

  mainCollector.merge(sweeps, baseAp, collector)
}

class Collector<T extends Uint8Array | Uint16Array | Uint32Array> {
  readonly holder = new Holder<T>()
  readonly perfect = new Holder<T>()
  maxAp = Infinity
  count = 0 // increased when new ap occurs, for lazy max update.
  readonly identifier: TierIdentifier

  constructor(identifier: TierIdentifier, initAp = Infinity) {
    this.identifier = identifier
    this.maxAp = initAp
    this.perfect.tier = Tier.SEMI_PERFECT
  }

  add(tier: Tier, ap: number, sweeps: T) {
    if (tier >= this.perfect.tier) {
      if (tier > this.perfect.tier) {
        this.perfect.ap = Infinity
      }
      this.perfect.consume(tier, ap, sweeps)
    }
    this.holder.consume(tier, ap, sweeps)
    if (this.holder.ap < this.maxAp) {
      this.count++
      this.maxAp = this.holder.ap
    }
  }

  merge(baseSweeps: T, baseAp: number, from: Collector<Uint8Array>) {
    for (const holder of [from.holder, from.perfect]) {
      if (holder.sweeps && (baseAp + holder.ap <= this.perfect.ap || holder.tier > this.perfect.tier)) {
        const sweeps = baseSweeps.slice() as T
        for (let i = 0; i < sweeps.length; i++) {
          sweeps[i] += holder.sweeps[i]
        }
        this.add(holder.tier, baseAp + holder.ap, sweeps)
      }
    }
  }

  /**
   * @returns is invalid
   */
  consume(ap: number, sweeps: T, items: Int16Array): boolean {
    const tier = this.identifier(items)
    if (tier === Tier.INVALID) return true
    if (ap <= this.maxAp || tier >= this.perfect.tier) {
      // console.log(`valid hit ${ap} ${this.perfectAp} ${sweeps.join(',')}`)
      this.add(tier, ap, sweeps)
    }
    return false
  }
}

class Holder<T extends Uint8Array | Uint16Array | Uint32Array> {
  tier: Tier = Tier.INVALID
  ap = Infinity
  sweeps: T | null = null
  private cv: number | null = null
  private mv: number | null = null

  consume(tier: Tier, ap: number, sweeps: T) {
    let cvc: number | null = null
    let mvc: number | null = null
    if (
      !this.sweeps ||
      ap < this.ap ||
      ap === this.ap && (
        tier - this.tier ||
        ((cvc ??= getCraftValue(sweeps)) - (this.cv ??= getCraftValue(this.sweeps))) ||
        ((mvc ??= getMiscValue(sweeps)) - (this.mv ??= getMiscValue(this.sweeps)))
      ) > 0
    ) {
      this.tier = tier
      this.sweeps = sweeps.slice() as T
      this.ap = ap
      this.cv = cvc
      this.mv = mvc
    }
  }

  toResult(): SolveResult | null {
    return this.sweeps && {
      sweeps: Uint32Array.from(this.sweeps),
      tier: TIERS[this.tier]
    }
  }
}

export function getCraftValue(sweeps: ArrayLike<number>) {
  if (sweeps.length !== 12) return 0 // unknown
  // 1 : 0.7934660541092394 : 0.7254211332312402
  return (
    sweeps[0] + sweeps[1] + sweeps[2] + sweeps[3] +
    (sweeps[4] + sweeps[5] + sweeps[6] + sweeps[7]) * 0.7934660541092394 +
    (sweeps[8] + sweeps[9] + sweeps[10] + sweeps[11]) * 0.7254211332312402
  )
}

function getMiscValue(sweeps: ArrayLike<number>) {
  let sum = 0
  for (let i = 0; i < sweeps.length; i++) {
    sum += sweeps[i]
  }
  return sum
}

function compileIdentifier(voids: Uint16Array, transfers: Uint8Array): TierIdentifier {
  if (transfers.length !== voids.length || !voids.length || transfers.at(-1)) {
    throw `TierIdentifier compile assertion error`
  }

  const notAffectedByTransfer = Array.from(voids, (_, i) => i).filter(i => !transfers[i - 1])
  // check if items not affected by transfer is not enough
  let code = `if (${notAffectedByTransfer.map(i => `items[${i}] < 0`).join('||')}) return ${Tier.INVALID};\n\n`

  const notRelatedByTransfer = notAffectedByTransfer.filter(i => !transfers[i])
  // check the perfectiness of values that's not related by transfer, except the first
  code += `let perfect = ${
    notRelatedByTransfer
      .filter(i => i && voids[i] !== 1)
      .map(i => voids[i] ? `!(items[${i}] % ${voids[i]})` : `!items[${i}]`)
      .join('&&') || 'true'
  };\n\n`

  if (transfers.some(v => v)) {
    // check the transferable groups
    code += 'let '
    let holding = false
    for (let i = 0; i < transfers.length; i++) {
      if (transfers[i]) {
        code += `v = ${holding ? 'v' : `items[${i}]`} / ${transfers[i]} + items[${i + 1}];\n`
        code += `if (v < 0) return ${Tier.INVALID};\n`
        holding = true
      } else if (holding) {
        holding = false
        code += 'perfect &&= Number.isInteger(v)'
        if (voids[i] !== 1) {
          code += ` && !${voids[i] ? `(v % ${voids[i]})` : 'v'}`
        }
        code += ';\n\n'
      }
    }
  }
  // at this point the input is considered valid.
  if (voids[0] === 1) {
    code += `if (perfect) return ${Tier.PERFECT};\n`
  } else {
    code += `if (perfect) return items[0] ${voids[0] ? `% ${voids[0]}` : ''} ? ${Tier.SEMI_PERFECT} : ${Tier.PERFECT};\n`
  }
  code += `return ${Tier.NORMAL};`
  return new Function('items', code) as TierIdentifier
}

function isPerfectPossible(values: Iterable<number>, step: number, target: number) {
  if (!target) return true
  let gcd = null
  const limit = step ? Infinity : target
  for (const value of values) {
    if (!value || value > limit) continue
    if (gcd == null) {
      gcd = value
    } else {
      gcd = Maths.gcd(value, gcd)
    }
  }
  if (!gcd) return false
  if (step) {
    gcd = Maths.gcd(step, gcd)
  }
  if (gcd === 1) return true
  return gcd === Maths.gcd(target, gcd)
}

type TierIdentifier = (items: Int16Array) => Tier

export const enum Tier {
  INVALID = 0, // the result simply doesn't pass
  NORMAL = 1, // the result passed normally
  SEMI_PERFECT = 2, // the items are perfectly aligned except the first one
  PERFECT = 3 // the items are perfectly aligned
}
