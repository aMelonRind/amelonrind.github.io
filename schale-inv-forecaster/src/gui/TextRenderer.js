
import { requireNonNull } from "../util.js"

/** @type {Map<string, ImageBitmap>} */
const glyphs = new Map()
globalThis.glyphs = glyphs

const canvas = new OffscreenCanvas(3, 5)
const ctx = requireNonNull(canvas.getContext('2d'))
ctx.fillStyle = 'white'
ctx.imageSmoothingEnabled = false

/**
 * @param {string} char 
 * @param {string} bits 
 */
function defineGlyph(char, bits) {
  ctx.putImageData(new ImageData(new Uint8ClampedArray(
    Uint32Array.from(bits, b => b !== '0' ? 0xFFFFFFFF : 0).buffer
  ), canvas.width, 5), 0, 0)
  const bitmap = canvas.transferToImageBitmap()
  glyphs.set(char, bitmap)
  return bitmap
}

const QUESTION_MARK = defineGlyph('?', '111001010000010')
defineGlyph(' ', '000000000000000')
defineGlyph('0', '111101101101111')
defineGlyph('1', '001001001001001')
defineGlyph('2', '111001111100111')
defineGlyph('3', '111001111001111')
defineGlyph('4', '101101111001001')
defineGlyph('5', '111100111001111')
defineGlyph('6', '111100111101111')
defineGlyph('7', '111101001001001')
defineGlyph('8', '111101111101111')
defineGlyph('9', '111101111001111')
defineGlyph('A', '010101111101101')
defineGlyph('B', '110101110101110')
defineGlyph('C', '011100100100011')
defineGlyph('D', '110101101101110')
defineGlyph('E', '111100110100111')
defineGlyph('F', '111100110100100')
defineGlyph('G', '111100101101111')
defineGlyph('H', '101101111101101')
defineGlyph('I', '111010010010111')
defineGlyph('J', '111010010010110')
defineGlyph('K', '101101110101101')
defineGlyph('L', '100100100100111')
defineGlyph('M', '101111111101101')
defineGlyph('N', '110101101101101')
defineGlyph('O', '010101101101010')
defineGlyph('P', '110101110100100')
defineGlyph('Q', '010101101101011')
defineGlyph('R', '110101110101101')
defineGlyph('S', '011100111001110')
defineGlyph('T', '111010010010010')
defineGlyph('U', '101101101101111')
defineGlyph('V', '101101101101010')
defineGlyph('W', '101101111111101')
defineGlyph('X', '101101010101101')
defineGlyph('Y', '101101010010010')
defineGlyph('Z', '111001010100111')
defineGlyph('%', '101001010100101')
defineGlyph('/', '001001010100100')
canvas.width = 1
defineGlyph('.', '00001')
defineGlyph(',', '00011')
defineGlyph(':', '01010')
defineGlyph("'", '11000')

for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  glyphs.set(c.toLowerCase(), requireNonNull(glyphs.get(c)))
}

const _canvas = canvas
const _ctx = ctx

/**
 * @param {CanvasDrawImage} ctx expects opaque
 * @param {number} x 
 * @param {number} y 
 * @param {string | CanvasGradient | CanvasPattern} color 
 * @param {string} text 
 * @returns {number} text width
 */
export function drawText(ctx, x, y, color, text, center = false) {
  if (!text) return 0
  _ctx.reset()
  _canvas.width = text.length * 4
  let width = 0
  for (const c of text) {
    const glyph = glyphs.get(c) ?? QUESTION_MARK
    _ctx.drawImage(glyph, width, 0)
    width += glyph.width + 1
  }
  width--
  _ctx.globalCompositeOperation = 'source-in'
  if (_ctx.fillStyle !== color) {
    _ctx.fillStyle = color
  }
  _ctx.fillRect(0, 0, width, 5)
  // console.log(new Uint32Array(_ctx.getImageData(0, 0, width, 5).data.buffer).map(v => (v & 0xFF000000) ? 1 : 0).join(''))
  if (center) x -= Math.floor(width / 2)
  ctx.drawImage(_canvas, 0, 0, width, 5, x, y, width, 5)
  return width
}
