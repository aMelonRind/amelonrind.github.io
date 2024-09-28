//@ts-check
/// <reference path = "../index.d.ts"/>

/**
 * one data import = one context
 */
class MainContext {
  static #initd = false

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
      if (res instanceof HTMLImageElement) {
        const canvas = new OffscreenCanvas(res.width, res.height)
        const ctx = requireNonNull(canvas.getContext('2d'))
        ctx.drawImage(res, 0, 0)
        MainContext.onNewImage(ctx.getImageData(0, 0, res.width, res.height))
      } else {
        MainContext.onNewImage(res.toImageData())
      }
    }
  }

  /**
   * @param {ImageData} image 
   */
  static onNewImage(image) {
    //
  }
}
