//@ts-check
///<reference path = "../index.d.ts"/>

/**
 * @param {number} width 
 * @param {number} height 
 * @param {Uint8Array} palette 
 * @param {Uint8Array} indexedPixels 
 * @returns 
 */
function createIndexedPNG(width, height, palette, indexedPixels) {
  const textEnc = new TextEncoder()
  const signature = Uint8Array.of(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)

  const ihdrData = new DataView(new ArrayBuffer(13))
  ihdrData.setInt32(0, width)
  ihdrData.setInt32(4, height)
  ihdrData.setInt8(8, 8) // Bit depth
  ihdrData.setInt8(9, 3) // Color type (indexed)
  // [Compression method, Filter method, Interlace method] are all zeroes
  const ihdr = createChunk('IHDR', new Uint8Array(ihdrData.buffer))

  const plte = createChunk('PLTE', palette)

  const scanlines = new Uint8Array((width + 1) * height)
  for (let y = 0; y < height; y++) {
    const yw = y * width
    scanlines.set(indexedPixels.subarray(yw, yw + width), yw + y + 1)
  }
  const idat = createChunk('IDAT', pako.deflate(scanlines))

  const iend = createChunk('IEND', new Uint8Array())

  return new Blob([signature, ihdr, plte, idat, iend], { type: 'image/png' })

  /**
   * @param {string} type 
   * @param {Uint8Array} data 
   * @returns {Uint8Array}
   */
  function createChunk(type, data) {
    const chunk = new Uint8Array(data.length + 12)
    const view = new DataView(chunk.buffer)
    view.setInt32(0, data.length)
    chunk.set(textEnc.encode(type), 4)
    chunk.set(data, 8)
    view.setInt32(chunk.length - 4, CRC32.buf(chunk.subarray(4, -4)))
    return chunk
  }
}
