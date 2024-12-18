import BaseImage from "./BaseImage.js"
import { formLayer } from "./Form.js"
import Readers from "./Readers.js"
import TaskManager from "./TaskManager.js"

/**
 * one data import = one context
 */
export default class MainContext {
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

    const shouldIgnore = n => n instanceof HTMLInputElement || formLayer.contains(n)
    window.addEventListener('dragover', e => {
      if (shouldIgnore(e.target)) return
      e.preventDefault()
    })
    window.addEventListener('drop', e => {
      if (shouldIgnore(e.target)) return
      e.preventDefault()
      handleItems(e.dataTransfer?.items)
    })
    window.addEventListener('paste', e => {
      if (shouldIgnore(e.target)) return
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
    if (MainContext.#current === this) {
      for (const cb of MainContext.#listeners) {
        cb(this)
      }
    }
  }

  setCurrent() {
    MainContext.#current = this
    this.base = this.base
    return this
  }

  isTrueColor() {
    return this.base.isRGBA()
  }

  getImageData() {
    return this.base.getImageData()
  }

}
