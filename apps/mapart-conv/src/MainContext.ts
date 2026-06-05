import BaseImage from "./BaseImage.ts";
import Readers from "./Readers.ts";
import TaskManager from "./TaskManager.ts";

/**
 * one data import = one context
 */
export default class MainContext {
  private static initd = false
  private static current: MainContext | null = null
  private static listeners: Set<(ctx: MainContext) => any> = new Set()
  private baseImage: BaseImage

  static onNewImage(cb: (ctx: MainContext) => any) {
    this.listeners.add(cb)
  }

  static getCurrent() {
    return this.current
  }

  static isInitialized() {
    return this.initd
  }

  static init() {
    if (this.initd) return
    this.initd = true

    const shouldIgnore = (n: EventTarget | null) => n instanceof HTMLInputElement
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

    function handleItems(items: DataTransferItemList | null | undefined) {
      if (!items) return
      TaskManager.run('Import item', async task => {
        const res = await Readers.readItems(items, task)
        if (!res) return
        new MainContext(res).setCurrent()
      })
    }
  }

  constructor (base: BaseImage) {
    this.baseImage = base
  }

  get base() {
    return this.baseImage
  }

  set base(v) {
    this.baseImage = v
    if (MainContext.current === this) {
      for (const cb of MainContext.listeners) {
        cb(this)
      }
    }
  }

  setCurrent() {
    MainContext.current = this
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
