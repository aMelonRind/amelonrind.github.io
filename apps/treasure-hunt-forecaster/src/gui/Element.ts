import { WrappedTranslatable } from "../../../../lib/i18n-base.tsx";
import { tw } from "../../i18n.ts";
import { MainGUI, theme } from "../MainGUI.ts";

export type NavigateType =
| 'prev' // shift + tab
| 'next' // tab
| 'up' // arrow up
| 'down' // arrow down
| 'left' // arrow left
| 'right' // arrow right
| 'activate' // spacebar || enter
;

export class RenderCache {
  readonly canvas: OffscreenCanvas
  readonly ctx: OffscreenCanvasRenderingContext2D

  constructor(width: number, height: number) {
    this.canvas = new OffscreenCanvas(width, height)
    this.ctx = this.canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false
  }
}

const noMod = <T>(e: KeyboardEvent, type: T): T | null => e.ctrlKey || e.shiftKey || e.altKey ? null : type

const navigateTypeReader: Record<string, (e: KeyboardEvent) => NavigateType | null> = {
  Tab: e => e.ctrlKey || e.altKey ? null : (e.shiftKey ? 'prev' : 'next'),
  ArrowUp: e => noMod(e, 'up'),
  ArrowDown: e => noMod(e, 'down'),
  ArrowLeft: e => noMod(e, 'left'),
  ArrowRight: e => noMod(e, 'right'),
  ' ': e => noMod(e, 'activate'),
  Enter: e => noMod(e, 'activate'),
  w: e => noMod(e, 'up'),
  a: e => noMod(e, 'left'),
  s: e => noMod(e, 'down'),
  d: e => noMod(e, 'right'),
  e: e => noMod(e, 'activate'),
}

export class Element {
  main!: MainGUI
  readonly parent: Element | null
  readonly cache
  readonly hoverCache
  x: number
  y: number
  focusable = true
  renderDirty = true
  hovered = false
  hoverDirty = false
  hoverX = 0
  hoverY = 0
  hoverText: WrappedTranslatable<any> = tw('hover.empty')

  /**
   * For parent elements to conveniently store navigate target.
   */
  navigateTargets: Record<Exclude<NavigateType, 'activate'>, Element | null> = {
    prev: null,
    next: null,
    up: null,
    down: null,
    left: null,
    right: null,
  }

  constructor(x: number, y: number, width: number, height: number, parent: Element | null = null) {
    this.x = x
    this.y = y
    this.cache = new RenderCache(width, height)
    this.hoverCache = new RenderCache(width, height)
    this.parent = parent
  }

  _init(main: MainGUI) {
    this.main = main
    this.init()
  }

  init() {}

  get width() {
    return this.cache.canvas.width
  }

  get height() {
    return this.cache.canvas.height
  }

  _render(ctx: CanvasDrawImage) {
    if (this.renderDirty) {
      this.renderDirty = false
      const { canvas, ctx: cctx } = this.cache
      cctx.reset()
      // cctx.fillStyle = theme.background
      // cctx.fillRect(0, 0, canvas.width, canvas.height)
      this.render(cctx, canvas)
      this.hoverDirty = true
    }
    if (this.hoverDirty) {
      this.hoverDirty = false
      const { canvas, ctx: cctx } = this.hoverCache
      cctx.reset()
      if (this.hovered) {
        this.renderHover(cctx, canvas)
      }
    }
    ctx.drawImage(this.cache.canvas, this.x, this.y)
    if (this.hovered) {
      ctx.drawImage(this.hoverCache.canvas, this.x, this.y)
    }
  }

  markDirty() {
    this.renderDirty = true
    this.parent?.markDirty()
  }

  markHoverDirty() {
    this.hoverDirty = true
    this.parent?.markHoverDirty()
  }

  render(ctx: OffscreenCanvasRenderingContext2D, canvas: OffscreenCanvas) {}

  renderHover(ctx: OffscreenCanvasRenderingContext2D, canvas: OffscreenCanvas) {
    if (!this.hovered || this instanceof ParentElement) return
    this.drawFullHover(ctx)
  }

  drawFullHover(ctx: OffscreenCanvasRenderingContext2D) {
    ctx.fillStyle = theme.hover
    ctx.fillRect(0, 0, this.width, this.height)
  }

  onClick(x: number, y: number): boolean {
    // console.log(`Clicked at (${x}, ${y}) in ${this.constructor.name}`)
    return false
  }

  onHover(x: number, y: number) {
    this.hovered = true
    this.hoverX = x
    this.hoverY = y
    this.main.hoverTextprovider = this
    this.markHoverDirty()
  }

  unhover() {
    this.hovered = false
    this.markHoverDirty()
  }

  dispatchKeyEvent(e: KeyboardEvent) {
    const type = navigateTypeReader[e.key]?.(e)
    if (type == null) return
    if (this.navigate(type)) {
      e.preventDefault()
    }
  }

  navigate(type: NavigateType): boolean {
    return false
  }

  simpleButtonNavigate(type: NavigateType): boolean {
    if (type === 'activate') {
      if (this.hovered) {
        this.onClick(this.hoverX, this.hoverY)
      }
      return true
    } else {
      if (this.hovered) {
        this.unhover()
        return false
      } else {
        this.onHover(Math.floor(this.width / 2), Math.floor(this.height / 2))
        return true
      }
    }
  }

  setNavigateTargets(
    prev: Element | null,
    next: Element | null,
    up: Element | null,
    down: Element | null,
    left: Element | null,
    right: Element | null
  ) {
    this.navigateTargets = { prev, next, up, down, left, right }
  }
}

export class ParentElement extends Element {
  hovering: Element | null = null;

  *elements(): Generator<Element> {}

  markAllDirty() {
    this.renderDirty = true
    for (const child of this.elements()) {
      if (child instanceof ParentElement) {
        child.markAllDirty()
      } else {
        child.renderDirty = true
      }
    }
  }

  _init(main: MainGUI) {
    super._init(main)

    for (const child of this.elements()) {
      child._init(main)
    }
  }

  _render(ctx: CanvasDrawImage) {
    if (this.renderDirty) {
      this.renderDirty = false
      const { canvas, ctx: cctx } = this.cache
      cctx.fillStyle = theme.background
      cctx.fillRect(0, 0, canvas.width, canvas.height)
      this.render(cctx, canvas)
      this.hoverDirty = true
    }
    if (this.hoverDirty) {
      this.hoverDirty = false
      const { canvas, ctx: cctx } = this.hoverCache
      cctx.reset()
      if (this.hovered) {
        this.renderHover(cctx, canvas)
      }

      for (const child of this.elements()) {
        child._render(cctx)
      }
    }
    ctx.drawImage(this.cache.canvas, this.x, this.y)
    ctx.drawImage(this.hoverCache.canvas, this.x, this.y)
  }

  onClick(x: number, y: number): boolean {
    for (const child of this.elements()) {
      if (inBounds(x, y, child) && child.onClick(x - child.x, y - child.y)) {
        return true
      }
    }
    return super.onClick(x, y)
  }

  onHover(x: number, y: number) {
    super.onHover(x, y)
    let found = false
    for (const child of this.elements()) {
      if (!found && inBounds(x, y, child)) {
        child.onHover(x - child.x, y - child.y)
        this.hovering = child
        found = true
        continue
      }
      child.unhover()
    }
  }

  unhover() {
    if (this.hovered) {
      super.unhover()
      this.hovering = null
      for (const child of this.elements()) {
        child.unhover()
      }
    }
  }

  initialNavigateTarget(): Element | null {
    for (const child of this.elements()) {
      if (child.focusable) {
        return child
      }
    }
    return null
  }

  navigate(type: NavigateType): boolean {
    if (this.hovering?.navigate(type)) return true
    if (type === 'activate') return true
    const next = this.hovering ? this.hovering.navigateTargets[type] : this.initialNavigateTarget()
    this.unhover()
    if (!next) {
      return false
    }
    if (next.navigate(type)) {
      this.hovering = next
      this.hovered = true
      this.hoverX = next.x + next.hoverX
      this.hoverY = next.y + next.hoverY
      this.hoverDirty = true
      return true
    }
    return false
  }

}

function inBounds(px: number, py: number, child: Element): boolean {
  return px >= child.x && py >= child.y && px < child.x + child.width && py < child.y + child.height
}
