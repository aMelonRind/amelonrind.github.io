//@ts-check
/// <reference path = "../index.d.ts"/>

/**
 * one data import = one context
 */
class MainContext {
  static #initd = false
  /** @type {MainContext?} */
  static #current = null
  /** @type {Set<(ctx: MainContext) => any>} */
  static #listeners = new Set()

  /**
   * @param {(ctx: MainContext) => any} cb 
   */
  static onNewContext(cb) {
    this.#listeners.add(cb)
  }

  static getCurrent() {
    return this.#current
  }

  static init() {
    if (this.#initd) return
    this.#initd = true

    window.addEventListener('dragover', e => {
      if (e.target instanceof HTMLInputElement) return
      e.preventDefault()
    })
    window.addEventListener('drop', e => {
      if (e.target instanceof HTMLInputElement) return
      e.preventDefault()
      handleItems(e.dataTransfer?.items)
    })
    window.addEventListener('paste', e => {
      if (e.target instanceof HTMLInputElement) return
      handleItems(e.clipboardData?.items)
    })

    /**
     * @param {DataTransferItemList | null | undefined} items 
     */
    async function handleItems(items) {
      const res = await Readers.readItems(items)
      if (!res) return
      new MainContext(res).setCurrent()
    }
  }

  /**
   * @param {HTMLImageElement | BlockImage} base 
   */
  constructor (base) {
    this.base = base
  }

  setCurrent() {
    MainContext.#current = this
    for (const cb of MainContext.#listeners) {
      cb(this)
    }
    return this
  }

  getImageData() {
    if (this.base instanceof HTMLImageElement) {
      const canvas = new OffscreenCanvas(this.base.width, this.base.height)
      const ctx = requireNonNull(canvas.getContext('2d'))
      ctx.drawImage(this.base, 0, 0)
      return ctx.getImageData(0, 0, this.base.width, this.base.height)
    } else {
      return this.base.toImageData()
    }
  }

}
