import { Accessor, createEffect, onCleanup, onMount } from "solid-js";
import "./index.css";
import { exposeToGlobal } from "../../lib/util.ts";
import initWasm, { Universe } from "./wasm/cgol.ts";
import { Fps } from "./fps.ts";

const memory = (await initWasm()).memory;

export function Cgol(props: { width: Accessor<number>, height: Accessor<number>, pixelSize: number, showFps: boolean }) {
  const pixelSize = props.pixelSize
  let showFps = props.showFps
  const fps = new Fps()
  const univ = Universe.new(8, 8, BigInt(Math.floor(0xFFFFFFFFFFFFF * Math.random())), 0.7)
  let canvasRef: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D | null = null
  onMount(() => {
    exposeToGlobal({ univ, canvas: canvasRef! })
    ctx = canvasRef!.getContext('2d')
  })

  function resize() {
    univ.resize(props.width(), props.height())
  }

  resize()
  univ.fill_random()
  createEffect(resize)

  let pause = false
  let step = false

  function cross(x: number, y: number) {
    univ.cross(Math.floor(x / pixelSize), Math.floor(y / pixelSize))
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return
    if (e.key === 'f') {
      showFps = !showFps
    } else if (e.key === 'c' || e.key === 'Delete') {
      univ.clear()
    } else if (e.key === 'p' || e.key === ' ' || e.key === 'Pause') {
      pause = !pause
    } else if (e.key === 's') {
      step = true
    }
  }

  let raf: number | null = null
  window.addEventListener('keydown', onKeyDown)
  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown)
    if (raf !== null) {
      cancelAnimationFrame(raf)
    }
  })

  render()

  function render() {
    const fpsText = fps.render()
    if (!pause || step) {
      univ.tick()
      step = false
    }
    const cells = new Uint8ClampedArray(memory.buffer, univ.cells(), univ.size())
    if (ctx) {
      ctx.putImageData(new ImageData(cells, univ.width(), univ.height()), 0, 0)
      if (showFps) {
        ctx.textAlign = 'left'
        ctx.font = '8px kenpixel_mini_square'
        ctx.strokeStyle = '#000000'
        ctx.fillStyle = '#FFFFFF'
        ctx.strokeText(fpsText, 2, 7)
        ctx.fillText(fpsText, 2, 7)
      }
    }
    raf = requestAnimationFrame(render)
  }

  let mouseHolding = false
  return <canvas
    ref={canvasRef!}
    id="cgol-canvas"
    width={props.width()}
    height={props.height()}
    style={{ width: props.width() * pixelSize + 'px', height: props.height() * pixelSize + 'px' }}
    on:mousedown={e => {
      if (e.button === 0) { // left
        cross(e.offsetX, e.offsetY)
        mouseHolding = true
      }
    }}
    on:mousemove={e => mouseHolding && cross(e.offsetX, e.offsetY)}
    on:mouseup={e => mouseHolding = false}
    on:touchmove={e => {
      const rect = canvasRef!.getBoundingClientRect()
      const dx = -rect.x
      const dy = -rect.y
      for (const t of e.changedTouches) {
        cross(t.clientX + dx, t.clientY + dy)
      }
    }}
  ></canvas>;
}
