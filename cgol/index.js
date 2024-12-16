//@ts-check
import { memory, Universe } from "./wasm_loader.js"
import { Fps } from "./fps.js"

const PIXEL_SIZE = 3
let showFps = false

// set_panic_hook()
const fps = new Fps()
const univ = Universe.new(8, 8, BigInt(Math.floor(0xFFFFFFFFFFFFF * Math.random())), 0.2)
const canvas = document.createElement('canvas')
canvas.id = 'cgol-canvas'
const ctx = canvas.getContext('2d') ?? new CanvasRenderingContext2D()
resize()
univ.fill_random()

window.addEventListener('resize', resize)
let mouseHolding = false
canvas.addEventListener('mousedown', e => {
  cross(e.offsetX, e.offsetY)
  mouseHolding = true
})
canvas.addEventListener('mousemove', e => {
  if (mouseHolding) {
    cross(e.offsetX, e.offsetY)
  }
})
canvas.addEventListener('mouseup', e => mouseHolding = false)

render()
document.getElementById('cgol-container')?.append(canvas)

/**
 * @param {number} x 
 * @param {number} y 
 */
function cross(x, y) {
  univ.cross(Math.floor(x / PIXEL_SIZE), Math.floor(y / PIXEL_SIZE))
}

function render() {
  const fpsText = fps.render()
  univ.tick()
  const cells = new Uint8ClampedArray(memory.buffer, univ.cells(), univ.size())
  ctx.putImageData(new ImageData(cells, univ.width(), univ.height()), 0, 0)
  if (showFps) {
    ctx.textAlign = 'left'
    ctx.font = '8px kenpixel_mini_square'
    ctx.strokeStyle = '#000000'
    ctx.fillStyle = '#FFFFFF'
    ctx.strokeText(fpsText, 2, 7)
    ctx.fillText(fpsText, 2, 7)
  }
  requestAnimationFrame(render)
}

function resize() {
  const w = Math.min(240 * 2, Math.floor(window.innerWidth / 3))
  const h = Math.min(160 * 2, Math.floor(window.innerHeight / 3))
  canvas.width = w
  canvas.height = h
  canvas.style.width = `${w * PIXEL_SIZE}px`
  canvas.style.height = `${h * PIXEL_SIZE}px`
  univ.resize(w, h)
}
