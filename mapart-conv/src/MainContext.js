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
  /** @type {BaseImage} */ #base

  /**
   * @param {(ctx: MainContext) => any} cb 
   */
  static onNewImage(cb) {
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
    function handleItems(items) {
      if (!items) return
      TaskManager.run('Import item', async task => {
        const res = await Readers.readItems(items, task)
        if (!res) return
        new MainContext(res).setCurrent()
      })
    }
  }

  /**
   * @param {BaseImage} base 
   */
  constructor (base) {
    this.base = base
  }

  get base() {
    return this.#base
  }

  set base(v) {
    this.#base = v
    for (const cb of MainContext.#listeners) {
      cb(this)
    }
  }

  setCurrent() {
    return MainContext.#current = this
  }

  isTrueColor() {
    return this.base.isRGBA()
  }

  getImageData() {
    return this.base.getImageData()
  }

}
