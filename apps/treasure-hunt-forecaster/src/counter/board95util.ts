
// 4x1: 48
// 3x1: 62
// 2x1: 76

const cache = new Map<string, BigUint64Array>()

export function getPlacementCoverage(w: number, h: number, board: bigint): bigint {
  let res = 0n
  for (const placement of _getPlacements(w, h)) {
    if ((placement & board) === 0n) {
      res |= placement
    }
  }
  return res
}

export function getPlacementsFiltered(w: number, h: number, board: bigint): BigUint64Array {
  return _getPlacements(w, h).filter(p => (p & board) === 0n)
}

export function getPlacements(w: number, h: number): BigUint64Array {
  return _getPlacements(w, h).slice()
}

function _getPlacements(w: number, h: number): BigUint64Array {
  const fromCache = cache.get(`${w},${h}`)
  if (fromCache) {
    return fromCache
  }

  if (h > w) {
    [w, h] = [h, w]
  }

  const doRotate = w <= 5 && w !== h
  const count = (10 - w) * (6 - h) + (doRotate ? (10 - h) * (6 - w) : 0)
  const arr = new BigUint64Array(count)
  let index = 0

  const mask = (1n << BigInt(w)) - 1n
  let plac = 0n
  for (let i = 0; i < h; i++) {
    plac = (plac << 9n) | mask
  }
  for (let y = 0n; y <= 5 - h; y++) {
    const yof = y * 9n
    for (let x = 0n; x <= 9 - w; x++) {
      arr[index++] = plac << yof + x
    }
  }
  if (doRotate) {
    const mask = (1n << BigInt(h)) - 1n
    let plac = 0n
    for (let i = 0; i < w; i++) {
      plac = (plac << 9n) | mask
    }
    for (let y = 0n; y <= 5 - w; y++) {
      const yof = y * 9n
      for (let x = 0n; x <= 9 - h; x++) {
        arr[index++] = plac << yof + x
      }
    }
  }
  if (index !== count) {
    throw `assertion error (${index}/${count})`
  }
  cache.set(`${w},${h}`, arr)
  cache.set(`${h},${w}`, arr)
  return arr
}

export function addToCounts(counts: BigUint64Array, placement: bigint, count: bigint) {
  if (count > 0) {
    for (let i = 0; i < 45; i++) {
      if (placement & (1n << BigInt(i))) {
        counts[i] += count
      }
    }
  }
}

export function boardPopcnt(board: bigint) {
  let cnt = 0
  for (let i = 0n; i < 45; i++) {
    if (board & (1n << i)) cnt++
  }
  return cnt
}

export function boardToString(board: bigint): string {
  const raw = (board & ((1n << 45n) - 1n)).toString(2).padStart(45, '0')
  return `${raw.slice(0, 9)}_${raw.slice(9, 18)}_${raw.slice(18, 27)}_${raw.slice(27, 36)}_${raw.slice(36, 45)}`
}
