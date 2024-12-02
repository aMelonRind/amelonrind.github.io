//@ts-check
/// <reference path = "../index.d.ts"/>

class RGBAImage extends BaseImage {
  /** @readonly @type {ImageData} */ data

  /**
   * @param {HTMLImageElement} htmlImage 
   * @param {string?} [filename]
   * @returns {RGBAImage}
   */
  static from(htmlImage, filename = null) {
    const canvas = new OffscreenCanvas(htmlImage.width, htmlImage.height)
    const ctx = requireNonNull(canvas.getContext('2d'))
    ctx.drawImage(htmlImage, 0, 0)
    const res = new RGBAImage(ctx.getImageData(0, 0, htmlImage.width, htmlImage.height))
    if (filename) {
      res.name = filename
      res.filename = filename
    }
    return res
  }

  /**
   * @param {ImageData} data 
   */
  constructor(data) {
    super()
    this.data = data
  }

  getImageData() {
    return this.data
  }

  getWidth() {
    return this.data.width
  }

  getHeight() {
    return this.data.height
  }

  /**
   * @returns {this is RGBAImage}
   */
  isRGBA() {
    return true
  }

}
