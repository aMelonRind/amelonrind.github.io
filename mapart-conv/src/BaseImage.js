import { downloadBlob } from "./utils.js"

/**
 * @abstract
 */
export default class BaseImage {
  /** the part of this image, should be in `${number | 'row'}_${number}` format. null if this is the whole image. @type {string?} */
  part = null
  filename = 'unnamed_mapart'
  /** @type {string?} */ name = null
  author = 'Mapart Converter'
  /** @type {string?} */ description = null
  timeCreated = BigInt(Date.now())

  /**
   * @param {BaseImage} parent 
   * @returns {this}
   */
  inheritFrom(parent) {
    this.part = parent.part
    this.name = parent.name
    this.filename = parent.filename
    this.author = parent.author
    this.description = parent.description
    this.timeCreated = parent.timeCreated
    return this
  }

  /**
   * @returns {ImageData}
   * @abstract
   */
  getImageData() {
    throw new Error('not implemented')
  }

  /**
   * @abstract
   */
  async download() {
    const image = this.getImageData()
    const canvas = new OffscreenCanvas(image.width, image.height)
    canvas.getContext('2d')?.putImageData(image, 0, 0)
    downloadBlob(`${this.filename ?? 'unnamed'}.png`, await canvas.convertToBlob())
  }

  /**
   * @returns {number}
   * @abstract
   */
  getWidth() {
    throw new Error('not implemented')
  }

  /**
   * @returns {number}
   * @abstract
   */
  getHeight() {
    throw new Error('not implemented')
  }

  /**
   * @returns {this is RGBAImage}
   */
  isRGBA() {
    return false
  }

  /**
   * @returns {this is BlockImage}
   */
  isBlock() {
    return false
  }

}
