import * as pako from "https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.esm.mjs"

/**
 * @template T
 * @param {T} obj 
 * @param {string} [message] 
 * @returns {NonNullable<T>}
 */
export function requireNonNull(obj, message = 'Object is null!') {
  if (obj == null) throw message
  return obj
}

/**
 * @param {string} fileName 
 * @param {BlobPart} data 
 */
export function downloadBlob(fileName, data) {
  const blob = new Blob([data], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  downloadURL(url, fileName)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * @param {string} dataURL 
 * @param {string} fileName 
 */
export function downloadURL(dataURL, fileName) {
  const a = document.createElement('a')
  a.href = dataURL
  a.download = fileName
  a.click()
}

/**
 * @template T
 * @param {Iterable<T>} iterable 
 * @returns {T}
 */
export function firstValue(iterable) {
  return iterable[Symbol.iterator]().next().value
}

/**
 * @param {number} length 
 * @param {number} width 
 * @param {number} index 
 */
export function* around(length, width, index) {
  if (index >= width) yield index - width
  if (index < length - width) yield index + width
  const mod = index % width
  if (mod > 0) yield index - 1
  if (mod < width - 1) yield index + 1
}

/**
 * @param {number} length 
 * @param {number} width 
 * @param {number} index 
 */
export function* around8(length, width, index) {
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
  /**
   * @param {number} maxSize 
   */
  constructor(maxSize) {
    /** @type {Map<number, number>} */
    this.cache = new Map()
    this.maxSize = maxSize
  }

  /**
   * @param {number} key 
   * @returns {number?}
   */
  get(key) {
    const value = this.cache.get(key)
    if (value === undefined) return null
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  /**
   * @param {number} key 
   * @param {number} value 
   */
  set(key, value) {
    if (!this.cache.delete(key) && this.cache.size >= this.maxSize) {
      this.cache.delete(this.cache.keys().next().value)
    }
    this.cache.set(key, value)
    return value
  }
}

/**
 * @param {number} width 
 * @param {number} height 
 * @param {Uint8Array} palette 
 * @param {Uint8Array} indexedPixels 
 * @returns 
 */
export function createIndexedPNG(width, height, palette, indexedPixels) {
  const textEnc = new TextEncoder()
  const signature = Uint8Array.of(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)

  const ihdrData = new DataView(new ArrayBuffer(13))
  ihdrData.setInt32(0, width)
  ihdrData.setInt32(4, height)
  ihdrData.setInt8(8, 8) // Bit depth
  ihdrData.setInt8(9, 3) // Color type (indexed)
  // [Compression method, Filter method, Interlace method] are all zeroes
  const ihdr = createChunk('IHDR', new Uint8Array(ihdrData.buffer))

  const plte = createChunk('PLTE', palette)

  const scanlines = new Uint8Array((width + 1) * height)
  for (let y = 0; y < height; y++) {
    const yw = y * width
    scanlines.set(indexedPixels.subarray(yw, yw + width), yw + y + 1)
  }
  const idat = createChunk('IDAT', pako.deflate(scanlines))

  const iend = createChunk('IEND', new Uint8Array())

  return new Blob([signature, ihdr, plte, idat, iend], { type: 'image/png' })

  /**
   * @param {string} type 
   * @param {Uint8Array} data 
   * @returns {Uint8Array}
   */
  function createChunk(type, data) {
    const chunk = new Uint8Array(data.length + 12)
    const view = new DataView(chunk.buffer)
    view.setInt32(0, data.length)
    chunk.set(textEnc.encode(type), 4)
    chunk.set(data, 8)
    view.setInt32(chunk.length - 4, CRC32.buf(chunk.subarray(4, -4)))
    return chunk
  }
}
