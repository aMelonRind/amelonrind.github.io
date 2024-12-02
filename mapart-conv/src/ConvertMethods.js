//@ts-check
/// <reference path = "../index.d.ts"/>

/** @type {Record<string, (task?: ITask, ctx?: MainContext?) => Promise<any>>} */
const convertMethods = (() => {
  return {
    async "nearest"(task = ITask.DUMMY, ctx = MainContext.getCurrent()) {
      if (!ctx || ctx.base.isBlock()) return
      const img = ctx.getImageData()
      const cache = new LRUCache(256)
      const length = img.width * img.height
      await task.swap('Converting pixels')
      const bytes = Uint8Array.from({ length }, (_, i) => {
        const rgba = img.data.subarray(i * 4, i * 4 + 4)
        const rgb = (rgba[0] << 16) | (rgba[1] << 8) | rgba[2]
        //@ts-ignore
        return cache.get(rgb) ?? cache.set(rgb, getNearest(...rgba))
      })
      ctx.base = new BlockImage(img.width, img.height, bytes).inheritFrom(ctx.base)
    }
  }

  /**
   * @param {number} r 0..255
   * @param {number} g 0..255
   * @param {number} b 0..255
   * @param {number} a 0..255
   */
  function getNearest(r, g, b, a) {
    if (a < 128) return 0
    let nearest = 1
    let dist = Infinity
    for (let i = 4 * 3; i < 61 * 4 * 3; i += 3) {
      const rmean = (BlockImage.colors[i] + r) / 2
      const dr = BlockImage.colors[i] - r
      const dg = BlockImage.colors[i + 1] - g
      const db = BlockImage.colors[i + 2] - b
      const wr = 2 + rmean / 256
      const wb = 2 + (255 - rmean) / 256
      const d = wr * dr * dr + 4 * dg * dg + wb * db * db
      if (d < dist) {
        dist = d
        nearest = i / 3
      }
    }
    return nearest
  }
})()

class LRUCache {
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
