import { requireNonNull } from "../../../lib/util.ts";
import BaseImage from "./BaseImage.ts";

export default class RGBAImage extends BaseImage {
  readonly data: ImageData

  static from(htmlImage: HTMLImageElement, filename: string | null = null): RGBAImage {
    const canvas = new OffscreenCanvas(htmlImage.naturalWidth, htmlImage.naturalHeight)
    const ctx = requireNonNull(canvas.getContext('2d'))
    ctx.drawImage(htmlImage, 0, 0)
    const res = new RGBAImage(ctx.getImageData(0, 0, htmlImage.naturalWidth, htmlImage.naturalHeight))
    if (filename) {
      res.name = filename
      res.filename = filename
    }
    return res
  }

  constructor(data: ImageData) {
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

  isRGBA(): this is RGBAImage {
    return true
  }

}
