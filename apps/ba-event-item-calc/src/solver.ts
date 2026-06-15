import { Maths } from "../../../lib/util.ts";

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
const CRAFT_VALUES = [1, 0.7934660541092394, 0.7254211332312402] as const

export function solve(
  levels: readonly Level[],
  requires: Uint32Array,
  voids: Uint16Array,
  transfers: Uint8Array
): SolveReturn {
  const len = requires.length
  if (levels.some(l => l.items.length !== len) || voids.length !== len || transfers.length !== len) {
    throw `assertion error: inconsistent lengths`
  }

  const special = SpecialCaseOnlyFirst.solve(levels, requires, voids, transfers)
  if (special) return special

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

  // const perfectPossible = isPerfectPossible(levels.map(l => l.items[0]), voids[0] || transfers[0], requires[0])
  for (const sweeps of cand) {
    bruteForce(levels, sweeps, requires, collector, identifier)
  }
  console.log(`normal run finished at ${(performance.now() - solverStart).toFixed(2)}ms`)
  for (const sweeps of cand) {
    const idxs = sweeps.entries().filter(v => v[1]).map(([i]) => i).toArray()
    for (const i of idxs) {
      sweeps[i] += 2
    }
    for (const i of idxs) {
      sweeps[i] -= 4
      bruteForce(levels, sweeps, requires, collector, identifier)
      sweeps[i] += 4
    }
    for (const i of idxs) {
      sweeps[i] -= 2
    }
  }
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

function bruteForce(
  levels: readonly Level[],
  sweeps: Uint32Array,
  requires: Uint32Array,
  mainCollector: Collector<Uint32Array>,
  identifier: TierIdentifier
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

  const collector = new Collector<Uint8Array>(identifier, mainCollector.maxAp - baseAp)
  const items = Int16Array.from(req, v => -v)
  const itemsL = items.length
  const sweeps_ = new Uint8Array(levels.length)
  let lvIndex = 0
  let usedAp = 0
  initFirst: {
    const { ap, items: lItems } = levels[0]

    let max = 0
    for (let i = 0; i < itemsL; i++) {
      if (lItems[i]) {
        const n = Math.ceil(-items[i] / lItems[i])
        if (n > max) {
          max = n
        }
      }
    }

    max = Math.min(max, Math.floor((collector.maxAp - usedAp) / ap)) + 1
    for (let i = 0; i < itemsL; i++) {
      items[i] += lItems[i] * max
    }
    usedAp += max * ap
    sweeps_[0] += max
  }

  const last = levels.length - 1
  const { ap: lastAp, items: lastItems } = levels[last]
  while (true) {
    // find last non-zero
    while (sweeps_[lvIndex] === 0) {
      lvIndex--
    }
    // end
    if (lvIndex < 0) break
    // decrement
    const { ap, items: lItems } = levels[lvIndex]
    for (let i = 0; i < itemsL; i++) {
      items[i] -= lItems[i]
    }
    usedAp -= ap
    sweeps_[lvIndex++]--
    // fill sweeps to last
    while (lvIndex <= last) {
      const { ap, items: lItems } = levels[lvIndex]

      let max = 0
      for (let i = 0; i < itemsL; i++) {
        if (lItems[i]) {
          const n = Math.ceil(-items[i] / lItems[i])
          if (n > max) {
            max = n
          }
        }
      }

      max = Math.min(max, Math.floor((collector.maxAp - usedAp) / ap))
      if (max > 0) {
        let skip = true
        for (let i = 0; i < itemsL; i++) {
          if ((items[i] += lItems[i] * max) < 0) {
            skip = false
          }
        }
        usedAp += max * ap
        sweeps_[lvIndex] += max
        if (skip) {
          lvIndex = last
        }
      }
      lvIndex++
    }
    lvIndex--
    // collect
    while (true) {
      if (collector.consume(usedAp, sweeps_, items)) {
        const m = sweeps_[last]
        if (m) {
          for (let i = 0; i < itemsL; i++) {
            items[i] -= m * lastItems[i]
          }
          usedAp -= m * lastAp
          sweeps_[last] = 0
        }
        break
      }
      if (!sweeps_[last]) break
      for (let i = 0; i < itemsL; i++) {
        items[i] -= lastItems[i]
      }
      usedAp -= lastAp
      sweeps_[last]--
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
  }

  add(tier: Tier, ap: number, sweeps: T) {
    if (tier === Tier.PERFECT) {
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
      if (holder.sweeps && baseAp + holder.ap <= this.perfect.ap) {
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
    if (ap <= this.maxAp || tier === Tier.PERFECT) {
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

enum Tier {
  INVALID = 0, // the result simply doesn't pass
  NORMAL = 1, // the result passed normally
  SEMI_PERFECT = 2, // the items are perfectly aligned except the first one
  PERFECT = 3 // the items are perfectly aligned
}

class SpecialCaseOnlyFirst {
  static solve(
    levels: readonly Level[],
    requires: Uint32Array,
    voids: Uint16Array,
    transfers: Uint8Array
  ): SolveReturn {
    if (!requires[0] || requires.slice(1).some(v => v)) return null
    if (voids.slice(1, -1).some(v => v) || !voids.at(-1)) return null
    if (transfers[0] || transfers.at(-1) || transfers.slice(1, -1).some(v => !v)) return null

    const solverStart = performance.now()

    // calculate multipliers and mod
    const mults = Uint32Array.from(transfers)
    const lastI = mults.length - 1
    mults[0] = 1
    mults[lastI] = voids[lastI]
    for (let i = 0; i < lastI; i++) {
      mults[i + 1] *= mults[i]
    }
    const mod = mults[lastI]
    if (!mod) {
      console.warn('?')
      return null
    }

    // convert to single resource level
    const srls: SingleResourceLevel[] = levels.map(({ ap, items }, index) => {
      const point = items[0]
      let extra = 0
      for (let i = 1; i < items.length; i++) {
        extra += mults[i - 1] * items[i]
      }
      extra %= mod
      return { index, ap, point, extra }
    })

    // remove duplicates
    srls.sort((a, b) => a.point - b.point || a.extra - b.extra || a.ap - b.ap || a.index - b.index)
    for (let i = 1; i < srls.length;) {
      const a = srls[i - 1]
      const b = srls[i]
      if (a.extra === b.extra && a.point === b.point || !b.point && !b.extra) {
        srls.splice(i, 1)
        continue
      }
      i++
    }
    if (!srls[0].point && !srls[0].extra) {
      srls.shift()
    }
    // sort them
    srls.sort((b, a) => a.point / a.ap - b.point / b.ap || a.extra - b.extra)
    const values = Float64Array.from(srls, l => CRAFT_VALUES[l.index >> 2])
    const last = srls.length - 1
    const lastPointLevel = srls.findLastIndex(l => l.point)
    function compareValue(a: ArrayLike<number>, b: ArrayLike<number>): number {
      let v = 0
      for (let i = 0; i <= last; i++) {
        v += (a[i] - b[i]) * values[i]
      }
      return v || getMiscValue(a) - getMiscValue(b)
    }
    function toNormalSweeps(sweeps: Uint32Array) {
      const res = new Uint32Array(levels.length)
      for (const [i, v] of sweeps.entries()) {
        res[srls[i].index] = v
      }
      return res
    }

    let pointsTarget = requires[0]
    const pointTargetStep = voids[0]
    console.log(`target: ${pointsTarget}, step: ${pointTargetStep}, mod: ${mod}, levels: ${srls.length}`)
    // console.log(srls.map(l => `{"ap":${l.ap},"point":${l.point},"extra":${l.extra}}`).join(',\n'))
    const table = new Int32Array(srls[last].extra).fill(-1)
    if (!srls[last].point) {
      const b = mod
      const c = srls[last].extra
      const g = Maths.gcd(b, c)
      const bb = b / g
      const cc = c / g
      const inv = Maths.modInv(bb, cc)
      if (inv !== null) {
        for (let r = 0; r < c; r++) {
          if (r % g !== 0) continue
          table[r] = (((cc - (r / g) % cc) * inv) % cc)
        }
      }
    }
    // console.log(table.join(', '))
    const perfectPossible = isPerfectPossible(srls.map(v => v.point), pointTargetStep, pointsTarget)
    let limit = Math.ceil(pointsTarget / srls[0].point) - 8

    let bestAp = Infinity
    let bestSweeps: Uint32Array | null = null
    let isPerfectAsWell = false

    let bestPerfectAp = Infinity
    let bestPerfectSweeps: Uint32Array | null = null

    // brute force normal, this will be fast
    bruteForceLoop()
    console.log(`normal run finished at ${(performance.now() - solverStart).toFixed(2)}ms`)

    // brute force perfect, this is slower..
    const timeLimit = performance.now() + 3200
    let layers = 0
    if (perfectPossible) {
      bruteForcePerfectLoop()
      if (pointTargetStep) {
        const maxLayer = 10000 / srls[0].ap * srls[0].point / pointTargetStep
        while (!bestPerfectSweeps && performance.now() < timeLimit && layers < maxLayer) {
          pointsTarget += pointTargetStep
          layers++
          limit = Math.floor(pointsTarget / srls[0].point) - 12
          bruteForcePerfectLoop()
        }
      }
    }
    console.log(`brute force finished at ${(performance.now() - solverStart).toFixed(2)}ms, layer: ${layers}`)

    // impossible, but just in case
    if (!bestSweeps) return null

    return {
      normal: {
        sweeps: toNormalSweeps(bestSweeps),
        tier: TIERS[isPerfectAsWell ? Tier.PERFECT : Tier.NORMAL]
      },
      perfect: bestPerfectSweeps && {
        sweeps: toNormalSweeps(bestPerfectSweeps),
        tier: TIERS[Tier.PERFECT]
      }
    }

    function bruteForceLoop() {
      let lvIndex = 0
      let usedAp = 0
      let points = 0
      let extras = 0
      const sweeps = new Uint32Array(srls.length)
      initFirst: {
        const { ap, point, extra } = srls[0]

        const max = Math.min(Math.ceil((pointsTarget - points) / point), Math.floor((bestAp - usedAp) / ap)) + 1
        usedAp += max * ap
        points += max * point
        extras += max * extra
        sweeps[0] += max
      }
      const { ap: lastAp, point: lastPoint, extra: lastExtra } = srls[last]
      while (true) {
        // find last non-zero
        while (sweeps[lvIndex] === 0) {
          lvIndex--
        }
        // end
        if (lvIndex < 0) break
        if (!lvIndex && sweeps[0] < limit) break
        // decrement
        const { ap, point, extra } = srls[lvIndex]
        usedAp -= ap
        points -= point
        extras -= extra
        sweeps[lvIndex++]--
        // fill sweeps to last
        while (lvIndex <= last) {
          const { ap, point, extra } = srls[lvIndex]
          const max = Math.min(Math.ceil(pointsTarget / point), Math.floor((bestAp - usedAp) / ap))

          if (max > 0) {
            usedAp += max * ap
            points += max * point
            extras += max * extra
            sweeps[lvIndex] += max
            if (points >= pointsTarget) {
              lvIndex = last
            }
          }
          lvIndex++
        }
        lvIndex--
        // collect
        while (true) {
          if (points >= pointsTarget) {
            const isPerfect = points === pointsTarget && extras % mod === 0
            if (usedAp < bestAp || usedAp === bestAp && compareValue(sweeps, bestSweeps!) > 0) {
              bestAp = usedAp
              bestSweeps = sweeps.slice()
              isPerfectAsWell = isPerfect
            }
            if (isPerfect && (
                !bestPerfectSweeps ||
                usedAp < bestPerfectAp ||
                usedAp === bestPerfectAp && compareValue(sweeps, bestPerfectSweeps) > 0
            )) {
              bestPerfectAp = usedAp
              bestPerfectSweeps = sweeps.slice()
            }
          }
          if (!sweeps[last]) break
          if (points - lastAp < pointsTarget) {
            const m = sweeps[last]
            if (m) {
              usedAp -= m * lastAp
              points -= m * lastPoint
              extras -= m * lastExtra
              sweeps[last] = 0
            }
            break
          }
          usedAp -= lastAp
          points -= lastPoint
          extras -= lastExtra
          sweeps[last]--
        }
      }
    }

    function bruteForcePerfectLoop() {
      let lvIndex = 0
      let usedAp = 0
      let points = 0
      let extras = 0
      const sweeps = new Uint32Array(srls.length)
      initFirst: {
        const { ap, point, extra } = srls[0]

        const max = Math.min(
          Math.floor(pointsTarget / point),
          Math.floor((bestPerfectAp - usedAp) / ap)
        ) + 1
        usedAp += max * ap
        points += max * point
        extras += max * extra
        sweeps[0] += max
      }
      const { ap: lastAp, point: lastPoint, extra: lastExtra } = srls[last]
      outer:
      while (true) {
        // find last non-zero
        while (sweeps[lvIndex] === 0) {
          lvIndex--
        }
        // end
        if (lvIndex < 0) break
        if (!lvIndex && sweeps[0] < limit) break
        if (lvIndex < 8 && performance.now() > timeLimit) break
        // decrement
        const { ap, point, extra } = srls[lvIndex]
        if (lvIndex === lastPointLevel) {
          const m = sweeps[lastPointLevel]
          usedAp -= m * ap
          points -= m * point
          extras -= m * extra
          sweeps[lvIndex] = 0
          continue
        } else {
          usedAp -= ap
          points -= point
          extras -= extra
          sweeps[lvIndex++]--
        }
        // fill sweeps to last
        while (lvIndex <= last) {
          const { ap, point, extra } = srls[lvIndex]
          if (point) {
            const max = Math.min(
              Math.floor((pointsTarget - points) / point),
              Math.floor((bestPerfectAp - usedAp) / ap)
            )

            if (lvIndex === lastPointLevel && points + max * point !== pointsTarget) {
              continue outer
            }

            if (max > 0) {
              usedAp += max * ap
              points += max * point
              extras += max * extra
              sweeps[lvIndex] += max
              if (points >= pointsTarget) {
                lvIndex = lastPointLevel
              }
            }
          } else if (lvIndex < last) {
            // extra filler level
            const max = Math.min(
              extras % mod ? 8 : 0,
              Math.floor((bestPerfectAp - usedAp) / ap)
            )

            if (max > 0) {
              usedAp += max * ap
              extras += max * extra
              sweeps[lvIndex] += max
            }
          } else {
            const es = extras % mod
            if (es) {
              // last extra filler level
              // ((layer - extras) + n * layer) % extra
              const need = mod - es
              const cache = table[need % extra]
              if (cache === -1) continue outer

              const max = (need + cache * mod) / extra
              if (usedAp + max * ap > bestPerfectAp) {
                continue outer
              }

              if (max > 0) {
                usedAp += max * ap
                extras += max * extra
                sweeps[lvIndex] += max
              }
            }
          }
          lvIndex++
        }
        lvIndex--
        // collect
        if (points === pointsTarget && extras % mod === 0) {
          if (
            !bestPerfectSweeps ||
            usedAp < bestPerfectAp ||
            usedAp === bestPerfectAp && compareValue(sweeps, bestPerfectSweeps) > 0
          ) {
            bestPerfectAp = usedAp
            bestPerfectSweeps = sweeps.slice()
          }
        }
        const m = sweeps[last]
        // if it contains points, then decrementing one would make it invalid
        // if it doesn't, it's already handled up there to the best case, no need to decrement one by one.
        if (m) {
          usedAp -= m * lastAp
          points -= m * lastPoint
          extras -= m * lastExtra
          sweeps[last] = 0
        }
      }
    }
  }
}

interface SingleResourceLevel {
  index: number;
  ap: number;
  point: number;
  extra: number;
}
