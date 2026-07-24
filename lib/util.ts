
export function exposeToGlobal(objs: object) {
  const gb: any = globalThis

  for (const [key, value] of Object.entries(objs)) {
    gb[key] ??= value
    if (gb[key] === value) continue

    for (let i = 2; i <= 9; i++) {
      const nkey = `${key}${i}`
      gb[nkey] ??= value
      if (gb[nkey] === value) continue
    }
  }
}

const truthyStrs: Set<string | undefined> = new Set(['', 'true', 't', 'yes', 'y', 'on', '1', 'enabled', 'active'])
const paramHinted = new Set<string>()

export function isTruthy(str: string | undefined): boolean {
  return truthyStrs.has(str)
}

export function getParams() {
  return new URLSearchParams(window.location.search)
}

export function getParam(param: string) {
  if (!paramHinted.has(param)) {
    console.log(`Search param hint: ${param}`)
    paramHinted.add(param)
  }
  return getParams().get(param)
}

export function hasParam(param: string) {
  return isTruthy(getParam(param)?.toLowerCase())
}

export function isDev() {
  return hasParam('dev')
}

export function sleep(ms: number): Promise<void> {
  return new Promise(res => void setTimeout(res, ms))
}

export function requireNonNull<T>(obj: T, message: string = 'Object is null!'): NonNullable<T> {
  if (obj == null) throw message
  return obj
}

export function downloadBlob(fileName: string, data: BlobPart) {
  if (hasParam('no-dl')) return

  const blob = new Blob([data], { type: 'application/octet-stream' })

  const url = URL.createObjectURL(blob)
  downloadURL(url, fileName)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function downloadURL(dataURL: string, fileName: string) {
  if (hasParam('no-dl')) return

  const a = document.createElement('a')
  a.href = dataURL
  a.download = fileName
  a.style.display = 'none'

  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function drawRect(ctx: CanvasRect, x: number, y: number, w: number, h: number) {
  ctx.fillRect(x, y, w, 1)
  ctx.fillRect(x, y + h - 1, w, 1)
  ctx.fillRect(x, y + 1, 1, h - 2)
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2)
}

export function firstValue<T>(iterable: Iterable<T>): T {
  return iterable[Symbol.iterator]().next().value
}

export function* around(length: number, width: number, index: number) {
  if (index >= width) yield index - width
  if (index < length - width) yield index + width
  const mod = index % width
  if (mod > 0) yield index - 1
  if (mod < width - 1) yield index + 1
}

export function* around8(length: number, width: number, index: number) {
  let north = false
  let south = false
  if (index >= width) {
    yield index - width
    north = true
  }
  if (index < length - width) {
    yield index + width
    south = true
  }
  const mod = index % width
  if (mod > 0) {
    yield index - 1
    if (north) yield index - width - 1
    if (south) yield index + width - 1
  }
  if (mod < width - 1) {
    yield index + 1
    if (north) yield index - width + 1
    if (south) yield index + width + 1
  }
}

export namespace Maths {
  export function egcd(a: number, b: number): [g: number, x: number, y: number] {
    if (b === 0) return [a, 1, 0]
    const [g, x1, y1] = egcd(b, a % b)
    return [g, y1, x1 - Math.floor(a / b) * y1]
  }

  export function modInv(a: number, m: number): number | null {
    const [g, x] = egcd(a, m)
    if (g !== 1) return null
    return ((x % m) + m) % m
  }

  export function gcd(a: number, b: number): number {
    let temp: number
    while (b !== 0) {
      temp = b
      b = a % b
      a = temp
    }
    return a
  }
}


export class LRUCache<K = number, V = number> {
  cache: Map<K, V> = new Map()
  maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get(key: K): V | null {
    const value = this.cache.get(key)
    if (value === undefined) return null
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key: K, value: V) {
    if (!this.cache.delete(key) && this.cache.size >= this.maxSize) {
      this.cache.delete(this.cache.keys().next().value!)
    }
    this.cache.set(key, value)
    return value
  }
}
