
import { i18n } from "../I18n.js"
import { theme } from "../MainGUI.js"
import { requireNonNull } from "../util.js"

export class RenderCache {
  /** @readonly */ canvas
  /** @readonly */ ctx

  /**
   * @param {number} width 
   * @param {number} height 
   */
  constructor(width, height) {
    this.canvas = new OffscreenCanvas(width, height)
    this.ctx = requireNonNull(this.canvas.getContext('2d'))
    this.ctx.imageSmoothingEnabled = false
  }
}

/**
 * @template T
 * @param {KeyboardEvent} e 
 * @param {T} type 
 * @returns {T?}
 */
const noMod = (e, type) => e.ctrlKey || e.shiftKey || e.altKey ? null : type

/** @type {Record<string, (e: KeyboardEvent) => NavigateType | null>} */
const navigateTypeReader = {
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
  /** @readonly @type {MainGUI} */ main
  /** @readonly */ parent
  /** @readonly */ cache
  /** @readonly */ hoverCache
  focusable = true
  renderDirty = true
  hovered = false
  hoverDirty = false
  hoverX = 0
  hoverY = 0
  hoverText = i18n.empty

  /**
   * For parent elements to conveniently store navigate target.
   * @type {Record<Exclude<NavigateType, 'activate'>, Element?>}
   */
  navigateTargets = {
    prev: null,
    next: null,
    up: null,
    down: null,
    left: null,
    right: null,
  }

  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} width 
   * @param {number} height 
   * @param {Element?} parent 
   */
  constructor(x, y, width, height, parent = null) {
    this.x = x
    this.y = y
    this.cache = new RenderCache(width, height)
    this.hoverCache = new RenderCache(width, height)
    this.parent = parent
  }

  /**
   * @param {MainGUI} main 
   */
  _init(main) {
    //@ts-ignore
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

  /**
   * @param {CanvasDrawImage} ctx 
   */
  _render(ctx) {
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

  /**
   * @param {OffscreenCanvasRenderingContext2D} ctx 
   * @param {OffscreenCanvas} canvas 
   */
  render(ctx, canvas) {}

  /**
   * @param {OffscreenCanvasRenderingContext2D} ctx 
   * @param {OffscreenCanvas} canvas 
   */
  renderHover(ctx, canvas) {
    if (!this.hovered || this instanceof ParentElement) return
    this.drawFullHover(ctx)
  }

  /**
   * @param {OffscreenCanvasRenderingContext2D} ctx 
   */
  drawFullHover(ctx) {
    ctx.fillStyle = theme.hover
    ctx.fillRect(0, 0, this.width, this.height)
  }

  /**
   * @param {number} x 
   * @param {number} y 
   * @returns {boolean}
   */
  onClick(x, y) {
    // console.log(`Clicked at (${x}, ${y}) in ${this.constructor.name}`)
    return false
  }

  /**
   * @param {number} x 
   * @param {number} y 
   */
  onHover(x, y) {
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

  /**
   * @param {KeyboardEvent} e 
   */
  dispatchKeyEvent(e) {
    const type = navigateTypeReader[e.key]?.(e)
    if (type == null) return
    if (this.navigate(type)) {
      e.preventDefault()
    }
  }

  /**
   * @param {NavigateType} type 
   * @returns {boolean}
   */
  navigate(type) {
    return false
  }

  /**
   * @param {NavigateType} type 
   * @returns {boolean}
   */
  simpleButtonNavigate(type) {
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

  /**
   * @param {Element?} prev 
   * @param {Element?} next 
   * @param {Element?} up 
   * @param {Element?} down 
   * @param {Element?} left 
   * @param {Element?} right 
   */
  setNavigateTargets(prev, next, up, down, left, right) {
    this.navigateTargets = { prev, next, up, down, left, right }
  }
}

export class ParentElement extends Element {
  /** @type {Element?} */
  hovering = null;

  /**
   * @returns {Generator<Element>}
   */
  *elements() {}

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

  /**
   * @param {MainGUI} main 
   */
  _init(main) {
    super._init(main)

    for (const child of this.elements()) {
      child._init(main)
    }
  }

  /** @type {Element['_render']} */
  _render(ctx) {
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

  /** @type {Element['onClick']} */
  onClick(x, y) {
    for (const child of this.elements()) {
      if (inBounds(x, y, child) && child.onClick(x - child.x, y - child.y)) {
        return true
      }
    }
    return super.onClick(x, y)
  }

  /** @type {Element['onHover']} */
  onHover(x, y) {
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

  /**
   * @returns {Element?}
   */
  initialNavigateTarget() {
    for (const child of this.elements()) {
      if (child.focusable) {
        return child
      }
    }
    return null
  }

  /** @type {Element['navigate']} */
  navigate(type) {
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

/**
 * @param {number} px 
 * @param {number} py 
 * @param {Element} child 
 */
function inBounds(px, py, child) {
  return px >= child.x && py >= child.y && px < child.x + child.width && py < child.y + child.height
}
