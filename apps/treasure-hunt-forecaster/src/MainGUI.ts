import { Element, NavigateType, ParentElement } from "./gui/Element.ts";
import { InventoryElement } from "./gui/InventoryElement.ts";
import { ItemConfigElement } from "./gui/ItemConfigElement.ts";
import { StartButtonElement } from "./gui/StartButtonElement.ts";
import { drawRect, requireNonNull } from "../../../lib/util.ts";
import { WrappedTranslatable } from "../../../lib/i18n-base.tsx";
import { createSignal } from "solid-js";
import { tw } from "../i18n.ts";

const mainStateKey = 'treasure-hunt-forecaster:mainState'

export interface Theme {
  readonly background: string;
  readonly generic: string;
  readonly gray: string;
  readonly hover: string;
  readonly item0outline: string;
  readonly item0fill: string;
  readonly item1outline: string;
  readonly item1fill: string;
  readonly item2outline: string;
  readonly item2fill: string;
}

export let theme: Theme = {
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
  readonly itemcfg: readonly [ItemConfigElement, ItemConfigElement, ItemConfigElement] = [
    new ItemConfigElement(0, 7, 7, this),
    new ItemConfigElement(1, 7, 42, this),
    new ItemConfigElement(2, 7, 77, this)
  ]
  readonly startButton = new StartButtonElement(7, 112, this)
  readonly inventory = new InventoryElement(63, 3, this)
  readonly canvas = document.createElement('canvas')
  private readonly canvasCtx = requireNonNull(this.canvas.getContext('2d'))
  readonly currentHoverText = createSignal<WrappedTranslatable<any>>(tw('hover.empty'))
  #scale = 1
  #hoverEvent: PointerEvent | null = null
  hoverTextprovider: Element | null = null

  constructor() {
    super(0, 0, 287, 131)
    this.hoverTextprovider = this
    this.hovered = true
    this.canvas.classList.add('mainCanvas')
    this.canvas.tabIndex = 0
    this.canvas.ariaLabel = 'Main Forecaster GUI'
    this.canvas.width = this.width
    this.canvas.height = this.height

    this.itemcfg[0].setNavigateTargets(
      null,
      this.itemcfg[1],
      this.startButton,
      this.itemcfg[1],
      null,
      this.inventory
    )
    this.itemcfg[1].setNavigateTargets(
      this.itemcfg[0],
      this.itemcfg[2],
      this.itemcfg[0],
      this.itemcfg[2],
      null,
      this.inventory
    )
    this.itemcfg[2].setNavigateTargets(
      this.itemcfg[1],
      this.startButton,
      this.itemcfg[1],
      this.startButton,
      null,
      this.inventory
    )
    this.startButton.setNavigateTargets(
      this.itemcfg[2],
      this.inventory,
      this.itemcfg[2],
      this.itemcfg[0],
      null,
      this.inventory
    )
    this.inventory.navigateTargets.prev = this.startButton
    this.inventory.navigateTargets.left = this.itemcfg[0]

    window.addEventListener('resize', () => {
      this.updateScale()
    })
    this.updateScale()
    this.canvas.addEventListener('pointerdown', e => e.preventDefault(), { passive: false })
    this.canvas.addEventListener('pointerup', e => {
      if (this.onClick(Math.floor(e.offsetX / this.#scale), Math.floor(e.offsetY / this.#scale))) {
        e.preventDefault()
      }
    })
    this.canvas.addEventListener('pointermove', e => {
      this.#hoverEvent = e
      this.scheduleRender()
    })
    this.canvas.addEventListener('pointerleave', e => {
      this.#hoverEvent = null
      this.unhover()
      this.scheduleRender()
    })
    this.canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false })
    this.canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false })
    this.canvas.addEventListener('keydown', e => this.dispatchKeyEvent(e))

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        mainGUI.markAllDirty()
      }
    })

    this.loadState()
  }

  saveState() {
    const state = {
      itemSet: this.itemcfg.map(cfg => [cfg.sizeW, cfg.sizeH, cfg.count]),
      board: Array.from(this.inventory.board),
      placements: this.inventory.placements.map(p => [p.vert, p.hori])
    }
    localStorage.setItem(mainStateKey, JSON.stringify(state))
  }

  loadState() {
    const data = localStorage.getItem(mainStateKey)
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
    this.inventory.scheduleInstantCounter()
  }

  updateScale() {
    const c = this.canvas
    const scale = Math.max(1, Math.min(5,
      Math.floor(window.innerWidth * 0.95 / c.width),
      Math.floor(window.innerHeight * 0.95 / c.height)
    ))
    this.#scale = scale
    c.style.width = `${c.width * scale}px`
    c.style.height = `${c.height * scale}px`
  }

  mainRender() {
    this.scheduledRender = false
    if (this.#hoverEvent) {
      this.onHover(Math.floor(this.#hoverEvent.offsetX / this.#scale), Math.floor(this.#hoverEvent.offsetY / this.#scale))
      this.#hoverEvent = null
    }
    if (!this.hoverDirty && !this.renderDirty) return
    this.canvasCtx.fillStyle = theme.background
    this.canvasCtx.fillRect(0, 0, this.width, this.height)
    this._render(this.canvasCtx)
    this.currentHoverText[1](this.hoverTextprovider?.hoverText ?? this.hoverText)
  }

  markDirty() {
    super.markDirty()
    this.scheduleRender()
  }

  markHoverDirty() {
    super.markHoverDirty()
    this.scheduleRender()
  }

  markAllDirty() {
    super.markAllDirty()
    this.hoverText = tw('hover.hoverToSee')
    this.scheduleRender()
  }

  scheduledRender = false
  scheduleRender() {
    if (this.scheduledRender) return
    this.scheduledRender = true
    requestAnimationFrame(() => requestAnimationFrame(() => this.mainRender()))
  }

  render(ctx: OffscreenCanvasRenderingContext2D) {
    ctx.fillStyle = theme.generic
    drawRect(ctx, 0, 0, this.width, this.height)
  }

  renderHover(ctx: OffscreenCanvasRenderingContext2D, canvas: OffscreenCanvas) {
    super.renderHover(ctx, canvas)
    this.hoverText = tw('hover.hoverToSee')
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

  navigate(type: NavigateType): boolean {
    if (super.navigate(type)) return true
    return type !== 'prev' && type !== 'next' // prevent scrolling the page
  }

}

export type { MainGUI }
export const mainGUI = new MainGUI()
