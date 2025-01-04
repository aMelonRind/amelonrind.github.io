
import { i18n } from "../I18n.js"
import { theme } from "../MainGUI.js"
import { drawRect } from "../util.js"
import { Element, ParentElement, RenderCache } from "./Element.js"

class ElementWithItemId extends Element {
  /** @readonly */ id

  /**
   * @param {ItemId} id 
   * @param {number} x 
   * @param {number} y 
   * @param {number} width 
   * @param {number} height 
   * @param {Element} parent 
   */
  constructor(id, x, y, width, height, parent) {
    super(x, y, width, height, parent)
    this.id = id
  }

  getOutlineColor() {
    return theme[`item${this.id}outline`]
  }

  getFillColor() {
    return theme[`item${this.id}fill`]
  }
}

class SizeSelectElement extends ElementWithItemId {
  /** @readonly */
  value = {
    width: 2,
    height: 2
  }

  /**
   * @param {ItemId} id 
   * @param {number} x 
   * @param {number} y 
   * @param {Element} parent 
   */
  constructor(id, x, y, parent) {
    super(id, x, y, 29, 29, parent)
  }

  /** @type {Element['render']} */
  render(ctx) {
    const oc = this.getOutlineColor()
    ctx.fillStyle = oc
    const w = 6 * this.value.width - 1
    const h = 6 * this.value.height - 1
    drawRect(ctx, 0, 0, w, h)
    ctx.fillStyle = this.getFillColor()
    ctx.fillRect(1, 1, w - 2, h - 2)

    ctx.fillStyle = oc + '80'
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        if (x < this.value.width && y < this.value.height) continue
        drawRect(ctx, x * 6, y * 6, 5, 5)
      }
    }
  }

  /** @type {Element['renderHover']} */
  renderHover(ctx) {
    if (this.hoverX % 6 === 5 || this.hoverY % 6 === 5) {
      this.hoverText = i18n.empty
      return
    }
    const col = Math.floor(this.hoverX / 6)
    const row = Math.floor(this.hoverY / 6)
    if (col === 0 && row === 0) {
      this.hoverText = i18n.invalid1x1
      return
    }
    this.hoverText = i18n.setItemSize(this.id, col + 1, row + 1)
    const w = 6 * (col + 1) - 1
    const h = 6 * (row + 1) - 1
    ctx.fillStyle = theme.background + '80'
    ctx.fillRect(0, 0, w + 1, h + 1)
    ctx.fillStyle = this.getOutlineColor() + '80'
    drawRect(ctx, 0, 0, w, h)
    ctx.fillStyle = this.getFillColor() + '80'
    ctx.fillRect(1, 1, w - 2, h - 2)
  }

  /** @type {Element['onClick']} */
  onClick(x, y) {
    if (x % 6 === 5 || y % 6 === 5) return false
    const col = Math.floor(x / 6)
    const row = Math.floor(y / 6)
    if (col === 0 && row === 0) return false
    this.value.width = col + 1
    this.value.height = row + 1
    this.markDirty()
    this.main.inventory.placements[this.id].updateSize(this.value.width, this.value.height)
    this.main.itemcfg[this.id].markAddsDirty()
    return true
  }
}

const dice = new RenderCache(15, 9)
dice.ctx.fillStyle = '#ffffff'
dice.ctx.fillRect(1, 1, 1, 1) // 1
dice.ctx.fillRect(8, 0, 1, 1) // 2
dice.ctx.fillRect(6, 2, 1, 1)
dice.ctx.fillRect(14, 0, 1, 1) // 3
dice.ctx.fillRect(13, 1, 1, 1)
dice.ctx.fillRect(12, 2, 1, 1)
dice.ctx.fillRect(0, 6, 1, 1) // 4
dice.ctx.fillRect(2, 6, 1, 1)
dice.ctx.fillRect(0, 8, 1, 1)
dice.ctx.fillRect(2, 8, 1, 1)
dice.ctx.fillRect(6, 6, 1, 1) // 5
dice.ctx.fillRect(8, 6, 1, 1)
dice.ctx.fillRect(6, 8, 1, 1)
dice.ctx.fillRect(8, 8, 1, 1)
dice.ctx.fillRect(7, 7, 1, 1)
dice.ctx.fillRect(12, 6, 3, 1) // 6
dice.ctx.fillRect(12, 8, 3, 1)
dice.ctx.globalCompositeOperation = 'source-in'

class CountSelectElement extends ElementWithItemId {
  value = 1

  /**
   * @param {ItemId} id 
   * @param {number} x 
   * @param {number} y 
   * @param {Element} parent 
   */
  constructor(id, x, y, parent) {
    super(id, x, y, 17, 11, parent)
  }

  /** @type {Element['render']} */
  render(ctx) {
    const v = this.value - 1
    if (v >= 0 && v < 6) {
      ctx.fillStyle = this.getOutlineColor() + '80'
      ctx.fillRect(v % 3 * 6, Math.floor(v / 3) * 6, 5, 5)
    }
    dice.ctx.fillStyle = this.getFillColor()
    dice.ctx.fillRect(0, 0, 15, 9)
    ctx.drawImage(dice.canvas, 1, 1)
  }

  /** @type {Element['renderHover']} */
  renderHover(ctx) {
    if (this.hoverX % 6 === 5 || this.hoverY % 6 === 5) {
      this.hoverText = i18n.empty
      return
    }
    const value = 1 + Math.floor(this.hoverY / 6) * 3 + Math.floor(this.hoverX / 6)
    this.hoverText = i18n.setItemCount(this.id, value)
    const v = value - 1
    if (v >= 0 && v < 6) {
      ctx.fillStyle = theme.hover
      ctx.fillRect(v % 3 * 6, Math.floor(v / 3) * 6, 5, 5)
    }
  }

  /** @type {Element['onClick']} */
  onClick(x, y) {
    if (x % 6 === 5 || y % 6 === 5) return false
    this.value = 1 + Math.floor(y / 6) * 3 + Math.floor(x / 6)
    this.markDirty()
    this.main.inventory.placements[this.id].updateCount(this.value)
    this.main.itemcfg[this.id].markAddsDirty()
    return true
  }
}

const eyeClose = new RenderCache(7, 5)
eyeClose.ctx.fillStyle = '#ffffff'
eyeClose.ctx.fillRect(0, 2, 1, 1)
eyeClose.ctx.fillRect(1, 3, 1, 1)
eyeClose.ctx.fillRect(2, 4, 3, 1)
eyeClose.ctx.fillRect(5, 3, 1, 1)
eyeClose.ctx.fillRect(6, 2, 1, 1)
eyeClose.ctx.globalCompositeOperation = 'source-in'

const eyeOpen = new RenderCache(7, 5)
eyeOpen.ctx.fillStyle = '#ffffff'
eyeOpen.ctx.drawImage(eyeClose.canvas, 0, 0)
eyeOpen.ctx.fillRect(1, 1, 1, 1)
eyeOpen.ctx.fillRect(2, 0, 3, 1)
eyeOpen.ctx.fillRect(3, 2, 1, 1)
eyeOpen.ctx.fillRect(5, 1, 1, 1)
eyeOpen.ctx.globalCompositeOperation = 'source-in'

class VisibilityElement extends ElementWithItemId {
  value = true

  /**
   * @param {ItemId} id 
   * @param {number} x 
   * @param {number} y 
   * @param {Element} parent 
   */
  constructor(id, x, y, parent) {
    super(id, x, y, 11, 11, parent)
  }

  /** @type {Element['render']} */
  render(ctx) {
    this.hoverText = i18n.setItemVisibility(this.id, !this.value)
    const icon = this.value ? eyeOpen : eyeClose
    icon.ctx.fillStyle = this.getFillColor()
    icon.ctx.fillRect(0, 0, 7, 5)
    ctx.drawImage(icon.canvas, 2, 3)
  }

  /** @type {Element['onClick']} */
  onClick() {
    this.value = !this.value
    this.markDirty()
    this.main.inventory.markDirty()
    return true
  }
}

class AddVerticalElement extends ElementWithItemId {

  /**
   * @param {ItemId} id 
   * @param {number} x 
   * @param {number} y 
   * @param {Element} parent 
   */
  constructor(id, x, y, parent) {
    super(id, x, y, 5, 11, parent)
  }

  /** @type {Element['render']} */
  render(ctx) {
    const inv = this.main.inventory
    if (inv.placing === this.id && inv.placeRotate) {
      ctx.fillStyle = this.getOutlineColor() + '80'
      ctx.fillRect(0, 0, 5, 11)
    }
    const left = inv.placements[this.id].getCountLeft()
    ctx.fillStyle = left > 0 ? this.getFillColor() : this.getFillColor() + '80'
    ctx.fillRect(1, 5, 3, 1)
    ctx.fillRect(2, 4, 1, 1)
    ctx.fillRect(2, 6, 1, 1)
  }

  /** @type {Element['renderHover']} */
  renderHover(ctx) {
    this.drawFullHover(ctx)
    const left = this.main.inventory.placements[this.id].getCountLeft()
    if (left > 0) {
      this.hoverText = i18n.addItemPlacement(this.id, true)
    } else {
      this.hoverText = i18n.itemPlacementFull(this.id, this.main.itemcfg[this.id].count)
    }
  }

  /** @type {Element['onClick']} */
  onClick() {
    this.main.inventory.startPlace(this.id, true)
    this.markDirty()
    return true
  }
}

class AddHorizontalElement extends ElementWithItemId {

  /**
   * @param {ItemId} id 
   * @param {number} x 
   * @param {number} y 
   * @param {Element} parent 
   */
  constructor(id, x, y, parent) {
    super(id, x, y, 11, 5, parent)
  }

  /** @type {Element['render']} */
  render(ctx) {
    const inv = this.main.inventory
    if (inv.placing === this.id && !inv.placeRotate) {
      ctx.fillStyle = this.getOutlineColor() + '80'
      ctx.fillRect(0, 0, 11, 5)
    }
    const left = inv.placements[this.id].getCountLeft()
    ctx.fillStyle = left > 0 ? this.getFillColor() : this.getFillColor() + '80'
    ctx.fillRect(4, 2, 3, 1)
    ctx.fillRect(5, 1, 1, 1)
    ctx.fillRect(5, 3, 1, 1)
  }

  /** @type {Element['renderHover']} */
  renderHover(ctx) {
    this.drawFullHover(ctx)
    const left = this.main.inventory.placements[this.id].getCountLeft()
    if (left > 0) {
      this.hoverText = i18n.addItemPlacement(this.id, false)
    } else {
      this.hoverText = i18n.itemPlacementFull(this.id, this.main.itemcfg[this.id].count)
    }
  }

  /** @type {Element['onClick']} */
  onClick() {
    this.main.inventory.startPlace(this.id, false)
    this.markDirty()
    return true
  }
}

export class ItemConfigElement extends ParentElement {
  /** @readonly */ id
  /** @readonly */ sizeSelect
  /** @readonly */ countSelect
  /** @readonly */ visibilityToggle
  /** @readonly */ addVertical
  /** @readonly */ addHorizontal

  /**
   * @param {ItemId} id 
   * @param {number} x 
   * @param {number} y 
   * @param {Element} parent 
   */
  constructor(id, x, y, parent) {
    super(x, y, 48, 29, parent)
    this.id = id
    this.sizeSelect = new SizeSelectElement(id, 0, 0, this)
    this.countSelect = new CountSelectElement(id, 31, 0, this)
    this.visibilityToggle = new VisibilityElement(id, 31, 12, this)
    this.addVertical = new AddVerticalElement(id, 43, 12, this)
    this.addHorizontal = new AddHorizontalElement(id, 31, 24, this)
  }

  get sizeW() {
    return this.sizeSelect.value.width
  }

  get sizeH() {
    return this.sizeSelect.value.height
  }

  get count() {
    return this.countSelect.value
  }

  get visible() {
    return this.visibilityToggle.value
  }

  init() {
    const target = this.main.inventory.placements[this.id]
    target.updateSize(this.sizeW, this.sizeH)
    target.updateCount(this.count)
  }

  *elements() {
    yield this.sizeSelect
    yield this.countSelect
    yield this.visibilityToggle
    yield this.addVertical
    yield this.addHorizontal
  }

  markAddsDirty() {
    this.addHorizontal.markDirty()
    this.addVertical.markDirty()
  }

}
