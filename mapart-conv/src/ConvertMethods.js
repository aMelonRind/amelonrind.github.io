//@ts-check
/// <reference path = "../index.d.ts"/>

class ConvertMethod {
  /** @readonly @type {Map<string, ConvertMethod>} */
  static methods = new Map()
  /** @readonly */ name
  /** @readonly */ canRun
  /** @readonly */ action

  static getList(ctx = MainContext.getCurrent()) {
    const res = []
    for (const m of this.methods.values()) {
      if (m.canRun(ctx)) {
        res.push(m)
      }
    }
    return res.sort()
  }

  /**
   * @param {string} name 
   */
  static has(name) {
    return this.methods.has(name)
  }

  /**
   * @param {string} name 
   * @param {ITask} [task] 
   * @param {MainContext?} [ctx] 
   */
  static async run(name, task = ITask.DUMMY, ctx = MainContext.getCurrent()) {
    const m = this.methods.get(name)
    if (!m || !m.canRun(ctx)) {
      throw new Error(`Convert method ${name} doesn't exist.`)
    }
    return await m.action(task, ctx)
  }

  /**
   * @param {{
   *  name: string;
   *  canRun?: (this: ConvertMethod, ctx: MainContext?) => any;
   *  action: (this: ConvertMethod, task: ITask, ctx: MainContext?) => Promise<any>
   * }} def 
   */
  constructor ({ name, canRun = ctx => ctx != null, action }) {
    if (ConvertMethod.methods.has(name)) {
      throw new Error(`Convert method ${JSON.stringify(name)} already exists.`)
    }
    canRun = canRun.bind(this)
    action = action.bind(this)
    this.name = name
    this.canRun = canRun
    this.action = action
    ConvertMethod.methods.set(name, this)
  }
  
  /**
   * @param {number} r 0..255
   * @param {number} g 0..255
   * @param {number} b 0..255
   * @param {number} a 0..255
   */
  getNearest(r, g, b, a) {
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

  toString() {
    return `ConvertMethod: { name: ${this.name} }`
  }

}

new ConvertMethod({
  name: 'nearest',
  canRun(ctx) {
    return ctx && !ctx.base.isBlock()
  },
  async action(task, ctx) {
    if (!ctx || ctx.base.isBlock()) return
    const img = ctx.getImageData()
    const cache = new LRUCache(256)
    const length = img.width * img.height
    await task.swap('Converting pixels')
    const bytes = Uint8Array.from({ length }, (_, i) => {
      const rgba = img.data.subarray(i * 4, i * 4 + 4)
      const rgb = (rgba[0] << 16) | (rgba[1] << 8) | rgba[2]
      //@ts-ignore
      return cache.get(rgb) ?? cache.set(rgb, this.getNearest(...rgba))
    })
    ctx.base = new BlockImage(img.width, img.height, bytes).inheritFrom(ctx.base)
  }
})

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
