
// todo: plan to port this to wasm, it's too heavy for javascript to lift

interface Level {
  ap: number;
  items: Uint32Array;
}

type Sweeps = Uint32Array;

interface SolvedSweeps {
  ap: number;
  ceilAp: number;
  sweeps: Sweeps;
}

export function solve(
  levels: Level[],
  requires: Uint32Array,
  voids: Uint16Array,
  transfers: Uint8Array
): Sweeps | null {
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
  const cand = chooseCandidates(list, Math.min(...list.map(v => v.ap)) + 320, 5)

  console.log(`brute forcing through ${cand.length} candidates.`)
  const identifier = compileIdentifier(voids, transfers)
  // maybe collector here
  const colle = new Collector<Sweeps>(identifier, ceilMin)
  for (const sweeps of cand) {
    const req = requires.slice()
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

    if (baseAp > colle.perfectAp) continue

    console.log(sweeps.join(','), req.join(','))
    const collector = new Collector<Uint8Array>(identifier, colle.perfectAp - baseAp)

    bruteForce(levels, req, collector)
    colle.merge(sweeps, baseAp, collector)

    break
  }
  console.log(`brute forcing took ${(performance.now() - solverStart).toFixed(2)}ms`)
  return colle.sweeps
  console.log(`resulting ${colle.ap}, ${colle.semiPerfectAp}, ${colle.perfectAp}`)
  console.log(colle.sweeps?.join(','))
  console.log(colle.semiPerfectSweeps?.join(','))
  console.log(colle.perfectSweeps?.join(','))
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

/**
 * @param requires don't put large numbers in here, cpu will hate it
 */
function bruteForce(levels: Level[], requires: Uint32Array, collector: Collector<Uint8Array>) {
  // console.log(`brute forcing ${requires.join(', ')}`)
  bruteForceRecursive(
    levels,
    0,
    Int16Array.from(requires, v => -v),
    new Uint8Array(levels.length),
    0,
    collector
  )
}

function bruteForceRecursive(
  levels: Level[],
  lvIndex: number,
  items: Int16Array,
  sweeps: Uint8Array,
  usedAp: number,
  collector: Collector<Uint8Array>
) {
  if (usedAp > collector.perfectAp) return
  if (collector.consume(usedAp, sweeps, items)) return

  const level = levels[lvIndex]
  if (!level) return

  const nextLvIndex = lvIndex + 1
  bruteForceRecursive(levels, nextLvIndex, items, sweeps, usedAp, collector)

  const { ap, items: lItems } = level

  let max = 0
  for (let i = 0; i < items.length; i++) {
    if (lItems[i]) {
      const n = Math.ceil(-items[i] / lItems[i])
      if (n > max) {
        max = n
      }
    }
  }
  max++ // to explore perfects
  if (max > 32) {
    max = 32
  }

  const apBefore = usedAp
  max = Math.min(max, Math.floor((collector.perfectAp - apBefore) / ap))
  let pc = collector.perfectCount

  let added = 0
  for (; added < max; added++) {
    for (let i = 0; i < items.length; i++) {
      items[i] += lItems[i]
    }
    usedAp += ap
    sweeps[lvIndex]++

    bruteForceRecursive(levels, nextLvIndex, items, sweeps, usedAp, collector)
    if (collector.perfectCount !== pc) {
      pc = collector.perfectCount
      max = Math.min(max, Math.floor((collector.perfectAp - apBefore) / ap))
    }
  }

  for (let i = 0; i < items.length; i++) {
    items[i] -= lItems[i] * added
  }
  sweeps[lvIndex] = 0
}

class Collector<T extends Uint8Array | Uint16Array | Uint32Array> {
  ap = Infinity
  sweeps: T | null = null
  semiPerfectAp = Infinity
  semiPerfectSweeps: T | null = null
  perfectAp = Infinity
  perfectSweeps: T | null = null
  perfectCount = 0 // increased when new perfect occurs, for lazy max update.
  readonly identifier: TierIdentifier

  constructor(identifier: TierIdentifier, initAp = Infinity) {
    this.identifier = identifier
    this.perfectAp = initAp
  }

  add(tier: Tier, ap: number, sweeps: T) {
    let craftValueCache: number | null = null
    let miscValueCache: number | null = null

    if (tier === Tier.PERFECT) {
      if (
        !this.perfectSweeps ||
        ap < this.perfectAp ||
        ap === this.perfectAp && (
          ((craftValueCache ??= getCraftValue(sweeps)) - getCraftValue(this.perfectSweeps)) ||
          ((miscValueCache ??= getMiscValue(sweeps)) - getMiscValue(this.perfectSweeps))
        ) > 0
      ) {
        this.sweeps = this.semiPerfectSweeps = this.perfectSweeps = sweeps.slice() as T
        if (ap !== this.perfectAp) {
          this.perfectCount++
        }
        this.ap = this.semiPerfectAp = this.perfectAp = ap
      }
    } else if (tier === Tier.SEMI_PERFECT) {
      if (
        !this.semiPerfectSweeps ||
        ap < this.semiPerfectAp ||
        ap === this.semiPerfectAp && (
          ((craftValueCache ??= getCraftValue(sweeps)) - getCraftValue(this.semiPerfectSweeps)) ||
          ((miscValueCache ??= getMiscValue(sweeps)) - getMiscValue(this.semiPerfectSweeps))
        ) > 0
      ) {
        this.sweeps = this.semiPerfectSweeps = sweeps.slice() as T
        this.ap = this.semiPerfectAp = ap
      }
    } else {
      if (
        !this.sweeps ||
        ap < this.ap ||
        ap === this.ap && (
          ((craftValueCache ??= getCraftValue(sweeps)) - getCraftValue(this.sweeps)) ||
          ((miscValueCache ??= getMiscValue(sweeps)) - getMiscValue(this.sweeps))
        ) > 0
      ) {
        this.sweeps = sweeps.slice() as T
        this.ap = ap
      }
    }
  }

  merge(baseSweeps: T, baseAp: number, from: Collector<Uint8Array>) {
    if (from.sweeps && baseAp + from.ap <= this.ap) {
      const sweeps = baseSweeps.slice() as T
      for (let i = 0; i < sweeps.length; i++) {
        sweeps[i] += from.sweeps[i]
      }
      this.add(Tier.NORMAL, baseAp + from.ap, sweeps)
    }
    if (from.semiPerfectSweeps && baseAp + from.semiPerfectAp <= this.semiPerfectAp) {
      const sweeps = baseSweeps.slice() as T
      for (let i = 0; i < sweeps.length; i++) {
        sweeps[i] += from.semiPerfectSweeps[i]
      }
      this.add(Tier.SEMI_PERFECT, baseAp + from.semiPerfectAp, sweeps)
    }
    if (from.perfectSweeps && baseAp + from.perfectAp <= this.perfectAp) {
      const sweeps = baseSweeps.slice() as T
      for (let i = 0; i < sweeps.length; i++) {
        sweeps[i] += from.perfectSweeps[i]
      }
      this.add(Tier.PERFECT, baseAp + from.perfectAp, sweeps)
    }
  }

  /**
   * @returns is perfect ap
   */
  consume(ap: number, sweeps: T, items: Int16Array): boolean {
    const tier = this.identifier(items)
    if (tier === Tier.INVALID) return false
    if (ap <= this.perfectAp) {
      // console.log(`valid hit ${ap} ${this.perfectAp} ${sweeps.join(',')}`)
      this.add(tier, ap, sweeps)
    }
    return ap >= this.perfectAp
  }
}

function getCraftValue(sweeps: ArrayLike<number>) {
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
  if (1)
    return new Function('items', `return ${Array.from(voids, (_, i) => `items[${i}] >= 0`).join('&&')} ? ${Tier.NORMAL} : ${Tier.INVALID}`) as TierIdentifier

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

// console.log(compileIdentifier(
//   Uint16Array.of(100,  0,  0, 3, 0,  0,  1, 3),
//   Uint8Array.of(   0,  5,  6, 0, 7,  8,  0, 0)
// ).toString())

// /**
//  * not a perfect mock, it assumes:
//  * transfers only transfer to the next item.
//  * the first item cannot be transferred.
//  * transferable item cannot be voided.
//  */
// function mockTierIdentifier() {
//   // assume
//   const voids     = Uint16Array.of(100,  0,  0, 3, 0,  0,  1, 3)
//   const transfers = Uint8Array.of(   0,  5,  6, 0, 7,  8,  0, 0)

//   // argument example, don't assume the value
//   const items     = Int16Array.of( 100, 10, -2, 6, 0, 10, 13, 6)

//   // mock

//   // check if items not affected by transfer is not enough
//   if (items[0] < 0 || items[1] < 0 || items[4] < 0 || items[7] < 0) {
//     return Tier.INVALID
//   }
//   // check the perfectiness of values that's not related by transfer, except the first
//   let perfect = !(items[7] % 3)
//   // check the first transferable group
//   let v = items[1] / 5 + items[2]
//   if (v < 0) return Tier.INVALID
//   v = v / 6 + items[3]
//   if (v < 0) return Tier.INVALID
//   perfect &&= Number.isInteger(v) && !(v % 3) // `&& !v` if void = 0, don't check if void = 1
//   // the second group
//   v = items[4] / 7 + items[5]
//   if (v < 0) return Tier.INVALID
//   v = v / 8 + items[6]
//   if (v < 0) return Tier.INVALID
//   perfect &&= Number.isInteger(v) // void = 1, no check
//   // at this point the input is considered valid.
//   if (perfect) {
//     return items[0] % 100 ? Tier.SEMI_PERFECT : Tier.PERFECT
//   } else {
//     return Tier.NORMAL
//   }
// }

type TierIdentifier = (items: Int16Array) => Tier

enum Tier {
  INVALID = 0, // the result simply doesn't pass
  NORMAL = 1, // the result passed normally
  SEMI_PERFECT = 2, // the items are perfectly aligned except the first one
  PERFECT = 3 // the items are perfectly aligned
}
