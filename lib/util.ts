
export function exposeToGlobal(objs: object) {
  const gb: any = globalThis

  for (const [key, value] of Object.entries(objs)) {
    gb[key] ??= value
    if (gb[key] === value) return

    for (let i = 2; i <= 9; i++) {
      const nkey = `${key}${i}`
      gb[nkey] ??= value
      if (gb[nkey] === value) return
    }
  }
}

const truthyStrs: Set<string | undefined> = new Set(['', 'true', 't', 'yes', 'y', 'on', '1', 'enabled', 'active'])

export function getParams() {
  return new URLSearchParams(window.location.search)
}

export function getParam(param: string) {
  return getParams().get(param)
}

export function hasParam(param: string) {
  return truthyStrs.has(getParam(param)?.toLowerCase())
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
  a.click()
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

export class LRUCache {
  cache: Map<number, number> = new Map()
  maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get(key: number): number | null {
    const value = this.cache.get(key)
    if (value === undefined) return null
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key: number, value: number) {
    if (!this.cache.delete(key) && this.cache.size >= this.maxSize) {
      this.cache.delete(this.cache.keys().next().value!)
    }
    this.cache.set(key, value)
    return value
  }
}
