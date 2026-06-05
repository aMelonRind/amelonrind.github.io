import { downloadBlob } from "../../../lib/util.ts";
import BlockImage from "./BlockImage.ts";
import RGBAImage from "./RGBAImage.ts";

export default abstract class BaseImage {
  /** the part of this image, should be in `${number | 'row'}_${number}` format. null if this is the whole image. */
  part: string | null = null
  filename = 'unnamed_mapart'
  name: string | null = null
  author = 'Mapart Converter'
  description: string | null = null
  timeCreated = BigInt(Date.now())

  inheritFrom(parent: BaseImage): this {
    this.part = parent.part
    this.name = parent.name
    this.filename = parent.filename
    this.author = parent.author
    this.description = parent.description
    this.timeCreated = parent.timeCreated
    return this
  }

  abstract getImageData(): ImageData;

  async download() {
    const image = this.getImageData()
    const canvas = new OffscreenCanvas(image.width, image.height)
    canvas.getContext('2d')?.putImageData(image, 0, 0)
    downloadBlob(`${this.filename ?? 'unnamed'}.png`, await canvas.convertToBlob())
  }

  abstract getWidth(): number;

  abstract getHeight(): number;

  isRGBA(): this is RGBAImage {
    return false
  }

  isBlock(): this is BlockImage {
    return false
  }

}
