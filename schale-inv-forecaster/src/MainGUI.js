
import { Element, ParentElement } from "./gui/Element.js"
import { InventoryElement } from "./gui/InventoryElement.js"
import { ItemConfigElement } from "./gui/ItemConfigElement.js"
import { StartButtonElement } from "./gui/StartButtonElement.js"
import { i18n } from "./I18n.js"
import { drawRect, requireNonNull } from "./util.js"

/** @type {Theme} */
export let theme = {
  background: '#2a2c2f',
  generic: '#00ffff',
  gray: '#414449',
  hover: '#FFFFFF30',
  item0outline: '#dfaced',
  item0fill: '#e8cef4',
  item1outline: '#fbe45e',
  item1fill: '#fbf698',
  item2outline: '#9bb7e5',
  item2fill: '#c1d9f6',
}

class MainGUI extends ParentElement {
  /** @readonly @type {readonly [ItemConfigElement, ItemConfigElement, ItemConfigElement]} */
  itemcfg = [
    new ItemConfigElement(0, 7, 7, this),
    new ItemConfigElement(1, 7, 42, this),
    new ItemConfigElement(2, 7, 77, this)
  ]
  /** @readonly */ startButton = new StartButtonElement(7, 112, this)
  /** @readonly */ inventory = new InventoryElement(63, 3, this)
  /** @readonly */ div = document.createElement('div')
  /** @readonly */ #mainCanvas = document.createElement('canvas')
  /** @readonly */ #mainCanvasCtx = requireNonNull(this.#mainCanvas.getContext('2d'))
  /** @readonly */ #hoverTextElement = document.createElement('div')
  #scale = 1
  /** @type {PointerEvent?} */
  #hoverEvent = null
  /** @type {Element?} */
  hoverTextprovider = null

  constructor() {
    super(0, 0, 287, 131)
    this.hoverTextprovider = this
    this.hovered = true
    this.div.classList.add('mainGUI')
    this.#mainCanvas.classList.add('mainCanvas')
    this.#hoverTextElement.classList.add('hoverTextElement')
    this.#mainCanvas.width = this.width
    this.#mainCanvas.height = this.height
    this.div.append(this.#mainCanvas, this.#hoverTextElement)

    window.addEventListener('resize', () => {
      this.updateScale()
    })
    this.updateScale()
    this.#mainCanvas.addEventListener('pointerdown', e => e.preventDefault(), { passive: false })
    this.#mainCanvas.addEventListener('pointerup', e => {
      if (this.onClick(Math.floor(e.offsetX / this.#scale), Math.floor(e.offsetY / this.#scale))) {
        e.preventDefault()
      }
    })
    this.#mainCanvas.addEventListener('pointermove', e => {
      this.#hoverEvent = e
    })
    this.#mainCanvas.addEventListener('pointerleave', e => {
      this.#hoverEvent = null
      this.unhover()
    })
    this.#mainCanvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false })
    this.#mainCanvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false })

    this.loadState()
  }

  saveState() {
    const state = {
      itemSet: this.itemcfg.map(cfg => [cfg.sizeW, cfg.sizeH, cfg.count]),
      board: Array.from(this.inventory.board),
      placements: this.inventory.placements.map(p => [p.vert, p.hori])
    }
    localStorage.setItem('schale-inv-mng:mainState', JSON.stringify(state))
  }

  loadState() {
    const data = localStorage.getItem('schale-inv-mng:mainState')
    if (data) {
      try {
        const { itemSet, board, placements } = JSON.parse(data)
        for (const [i, [w, h, c]] of itemSet.entries()) {
          const cfg = this.itemcfg[i]
          const wh = cfg.sizeSelect.value
          wh.width = w
          wh.height = h
          cfg.countSelect.value = c
          this.inventory.placements[i].updateSize(w, h)
        }
        this.inventory.board.set(Uint16Array.from(board))
        this.inventory.stopPlace()
        for (const [i, [vert, hori]] of placements.entries()) {
          const plac = this.inventory.placements[i]
          plac.vert.length = 0
          plac.hori.length = 0
          plac.vert.push(...vert)
          plac.hori.push(...hori)
        }
      } catch {}
    }
    this._init(this)
    this.markAllDirty()
  }

  updateScale() {
    const c = this.#mainCanvas
    const scale = Math.max(1, Math.min(5,
      Math.floor(window.screen.width * 0.9 / c.width),
      Math.floor(window.screen.height * 0.9 / c.height)
    ))
    this.#scale = scale
    c.style.width = this.div.style.width = `${c.width * scale}px`
    c.style.height = `${c.height * scale}px`
  }

  mainRender() {
    if (this.#hoverEvent) {
      this.onHover(Math.floor(this.#hoverEvent.offsetX / this.#scale), Math.floor(this.#hoverEvent.offsetY / this.#scale))
      this.#hoverEvent = null
    }
    if (!this.hoverDirty && !this.renderDirty) return
    this.#mainCanvasCtx.fillStyle = theme.background
    this.#mainCanvasCtx.fillRect(0, 0, this.width, this.height)
    this._render(this.#mainCanvasCtx)
    this.#hoverTextElement.innerText = this.hoverTextprovider?.hoverText ?? this.hoverText
  }

  /** @type {Element['render']} */
  render(ctx) {
    ctx.fillStyle = theme.generic
    drawRect(ctx, 0, 0, this.width, this.height)
  }

  /** @type {Element['renderHover']} */
  renderHover(ctx, canvas) {
    super.renderHover(ctx, canvas)
    this.hoverText = i18n.hoverToSee
  }

  unhover() {
    super.unhover()
    this.hoverTextprovider = null
  }

  *elements() {
    yield this.itemcfg[0]
    yield this.itemcfg[1]
    yield this.itemcfg[2]
    yield this.startButton
    yield this.inventory
  }

}

export const mainGUI = new MainGUI()

let ff = false // i think we don't need 60fps on this
function mainRender() {
  if (ff = !ff) {
    mainGUI.mainRender()
  }
  requestAnimationFrame(mainRender)
}

export function forceRenderNextFrame() {
  mainGUI.markAllDirty()
  mainGUI.hoverText = i18n.hoverToSee
  ff = false
}

mainRender()
