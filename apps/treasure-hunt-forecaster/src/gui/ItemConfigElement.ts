import { theme } from "../MainGUI.ts";
import { drawRect, isDev } from "../../../../lib/util.ts";
import { Element, NavigateType, ParentElement, RenderCache } from "./Element.ts";
import { ItemId } from "../../../../data/ba/inventories.ts";
import { drawText } from "./TextRenderer.ts";
import { tw } from "../../i18n.ts";

class ElementWithItemId extends Element {
  readonly id: ItemId

  constructor(id: ItemId, x: number, y: number, width: number, height: number, parent: Element) {
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
  readonly value = {
    width: 2,
    height: 2
  }

  constructor(id: ItemId, x: number, y: number, parent: Element) {
    super(id, x, y, 29, 29, parent)
  }

  render(ctx: OffscreenCanvasRenderingContext2D) {
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

  renderHover(ctx: OffscreenCanvasRenderingContext2D) {
    if (this.hoverX % 6 === 5 || this.hoverY % 6 === 5) {
      this.hoverText = tw('hover.empty')
      return
    }
    const col = Math.floor(this.hoverX / 6)
    const row = Math.floor(this.hoverY / 6)
    if (col === 0 && row === 0) {
      this.hoverText = tw('hover.invalid1x1')
      return
    }
    this.hoverText = tw('hover.setItemSize', { item: this.id + 1, width: col + 1, height: row + 1 })
    const w = 6 * (col + 1) - 1
    const h = 6 * (row + 1) - 1
    ctx.fillStyle = theme.background + '80'
    ctx.fillRect(0, 0, w + 1, h + 1)
    ctx.fillStyle = this.getOutlineColor() + '80'
    drawRect(ctx, 0, 0, w, h)
    ctx.fillStyle = this.getFillColor() + '80'
    ctx.fillRect(1, 1, w - 2, h - 2)
  }

  onClick(x: number, y: number): boolean {
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

  navigate(type: NavigateType): boolean {
    if (type === 'activate') {
      if (this.hovered) {
        this.onClick(this.hoverX, this.hoverY)
      }
      return true
    } else {
      if (this.hovered) {
        let v = Math.floor(this.hoverY / 6) * 5 + Math.floor(this.hoverX / 6)
        switch (type) {
          case 'prev':
            v--
            break
          case 'next':
            v++
            break
          case 'up':
            v -= 5
            break
          case 'down':
            v += 5
            break
          case 'left':
            v = v % 5 === 0 ? -1 : v - 1
            break
          case 'right':
            v = v % 5 === 4 ? -1 : v + 1
            break
        }
        if (v <= 0 || v >= 25) {
          this.unhover()
          return false
        }
        this.onHover(2 + (v % 5) * 6, 2 + Math.floor(v / 5) * 6)
        return true
      } else {
        this.onHover(8, 2)
        return true
      }
    }
  }
}

const enum AmountHover {
  NONE,
  NUM,
  ADD,
  SUB
}

class AmountSelectElement extends ElementWithItemId {
  value = 1
  private countWidth = 0

  constructor(id: ItemId, x: number, y: number, parent: Element) {
    super(id, x, y, 17, 11, parent)
  }

  render(ctx: OffscreenCanvasRenderingContext2D) {
    this.countWidth = drawText(ctx, 5, 3, this.getFillColor(), this.value.toString(), true, true)

    let addColor = this.getFillColor()
    let subColor = this.getFillColor()
    const [min, max] = this.getLimits()
    if (this.value + 1 > max) {
      addColor += '80'
    }
    if (this.value - 1 < min) {
      subColor += '80'
    }

    ctx.fillStyle = addColor
    ctx.fillRect(13, 2, 3, 1) // +
    ctx.fillRect(14, 1, 1, 1)
    ctx.fillRect(14, 3, 1, 1)
    if (addColor !== subColor) {
      ctx.fillStyle = subColor
    }
    ctx.fillRect(13, 8, 3, 1) // -
  }

  renderHover(ctx: OffscreenCanvasRenderingContext2D) {
    const hover = this.getHovered(this.hoverX, this.hoverY)
    this.hoverText = tw('hover.empty')
    if (hover === AmountHover.NONE) {
      return
    }

    const item = this.id + 1
    if (hover === AmountHover.NUM) {
      if (this.value !== 2) {
        this.hoverText = tw('hover.setItemCount', { item, count: 2 })
      }
      ctx.fillStyle = theme.hover
      ctx.fillRect(4 - (this.countWidth >>> 1), 2, this.countWidth + 2, 7)
    } else if (hover === AmountHover.ADD) {
      if (this.validate(this.value + 1)) {
        this.hoverText = tw('hover.setItemCount', { item, count: this.value + 1 })
      }
      ctx.fillStyle = theme.hover
      ctx.fillRect(12, 0, 5, 5)
    } else if (hover === AmountHover.SUB) {
      if (this.validate(this.value - 1)) {
        this.hoverText = tw('hover.setItemCount', { item, count: this.value - 1 })
      }
      ctx.fillStyle = theme.hover
      ctx.fillRect(12, 6, 5, 5)
    }
  }

  onClick(x: number, y: number): boolean {
    const hover = this.getHovered(x, y)
    if (hover === AmountHover.NONE) {
      return false
    }

    if (hover === AmountHover.NUM) {
      this.value = 2
    } else if (hover === AmountHover.ADD) {
      this.value++
    } else if (hover === AmountHover.SUB) {
      this.value--
    }
    this.value = this.clamp(this.value)
    this.markDirty()
    this.main.inventory.placements[this.id].updateCount(this.value)
    this.main.itemcfg[this.id].markAddsDirty()
    return true
  }

  navigate(type: NavigateType): boolean {
    if (type === 'activate') {
      if (this.hovered) {
        this.onClick(this.hoverX, this.hoverY)
      }
      return true
    } else {
      const hover = this.hovered ? this.getHovered(this.hoverX, this.hoverY) : AmountHover.NONE
      if (hover === AmountHover.NONE) {
        this.onHover(5, 5)
        return true
      } else {
        let target = AmountHover.NONE
        if (hover === AmountHover.NUM) {
          switch (type) {
            case 'next':
            case 'right':
              target = AmountHover.ADD
              break
          }
        } else if (hover === AmountHover.ADD) {
          switch (type) {
            case 'prev':
            case 'left':
              target = AmountHover.NUM
              break
            case 'next':
            case 'down':
              target = AmountHover.SUB
              break
          }
        } else if (hover === AmountHover.SUB) {
          switch (type) {
            case 'prev':
            case 'up':
              target = AmountHover.ADD
              break
            case 'left':
              target = AmountHover.NUM
              break
          }
        }
        if (target === AmountHover.NONE) {
          this.unhover()
          return false
        }
        switch (target) {
          case AmountHover.NUM:
            this.onHover(5, 5)
            break
          case AmountHover.ADD:
            this.onHover(14, 2)
            break
          case AmountHover.SUB:
            this.onHover(14, 8)
            break
        }
        return true
      }
    }
  }

  private getHovered(x: number, y: number): AmountHover {
    if (x > 11) {
      if (y < 5) {
        return AmountHover.ADD
      } else if (y > 5) {
        return AmountHover.SUB
      } else {
        return AmountHover.NONE
      }
    } else {
      if (y >= 2 && y < 9) {
        const xStart = 4 - (this.countWidth >>> 1)
        if (x >= xStart && x < xStart + this.countWidth + 2) {
          return AmountHover.NUM
        }
      }
    }
    return AmountHover.NONE
  }

  private getLimits(): [min: number, max: number] {
    return isDev() ? [0, 20] : [1, 9]
  }

  private clamp(value: number): number {
    const [min, max] = this.getLimits()
    if (value < min) return min
    if (value > max) return max
    if (isNaN(value)) return min
    return value
  }

  private validate(value: number): boolean {
    const [min, max] = this.getLimits()
    if (value < min || value > max || isNaN(value)) {
      return false
    }
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
  value: boolean = true

  constructor(id: ItemId, x: number, y: number, parent: Element) {
    super(id, x, y, 11, 11, parent)
  }

  render(ctx: OffscreenCanvasRenderingContext2D) {
    this.hoverText = this.value
      ? tw('hover.enableItemVisibility', { item: this.id + 1 })
      : tw('hover.disableItemVisibility', { item: this.id + 1 })
    const icon = this.value ? eyeOpen : eyeClose
    icon.ctx.fillStyle = this.getFillColor()
    icon.ctx.fillRect(0, 0, 7, 5)
    ctx.drawImage(icon.canvas, 2, 3)
  }

  onClick() {
    this.value = !this.value
    this.markDirty()
    this.main.inventory.markDirty()
    return true
  }

  navigate(type: NavigateType) {
    return this.simpleButtonNavigate(type)
  }
}

class AddVerticalElement extends ElementWithItemId {

  constructor(id: ItemId, x: number, y: number, parent: Element) {
    super(id, x, y, 5, 11, parent)
  }

  render(ctx: OffscreenCanvasRenderingContext2D) {
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

  renderHover(ctx: OffscreenCanvasRenderingContext2D) {
    this.drawFullHover(ctx)
    const plac = this.main.inventory.placements[this.id]
    const item = this.id + 1
    if (plac.getCountLeft() > 0) {
      this.hoverText = plac.isSquare()
        ? tw('hover.addItemPlacement', { item })
        : tw('hover.addItemPlacementVert', { item })
    } else {
      this.hoverText = tw('hover.itemPlacementFull', { item, count: this.main.itemcfg[this.id].count })
    }
  }

  onClick() {
    this.main.inventory.startPlace(this.id, true)
    this.markDirty()
    return true
  }

  navigate(type: NavigateType) {
    return this.simpleButtonNavigate(type)
  }
}

class AddHorizontalElement extends ElementWithItemId {

  constructor(id: ItemId, x: number, y: number, parent: Element) {
    super(id, x, y, 11, 5, parent)
  }

  render(ctx: OffscreenCanvasRenderingContext2D) {
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

  renderHover(ctx: OffscreenCanvasRenderingContext2D) {
    this.drawFullHover(ctx)
    const plac = this.main.inventory.placements[this.id]
    const item = this.id + 1
    if (plac.getCountLeft() > 0) {
      this.hoverText = plac.isSquare()
        ? tw('hover.addItemPlacement', { item })
        : tw('hover.addItemPlacementHori', { item })
    } else {
      this.hoverText = tw('hover.itemPlacementFull', { item, count: this.main.itemcfg[this.id].count })
    }
  }

  onClick() {
    this.main.inventory.startPlace(this.id, false)
    this.markDirty()
    return true
  }

  navigate(type: NavigateType) {
    return this.simpleButtonNavigate(type)
  }
}

export class ItemConfigElement extends ParentElement {
  readonly id: ItemId
  readonly sizeSelect: SizeSelectElement
  readonly countSelect: AmountSelectElement
  readonly visibilityToggle: VisibilityElement
  readonly addVertical: AddVerticalElement
  readonly addHorizontal: AddHorizontalElement

  constructor(id: ItemId, x: number, y: number, parent: Element) {
    super(x, y, 48, 29, parent)
    this.id = id
    this.sizeSelect = new SizeSelectElement(id, 0, 0, this)
    this.countSelect = new AmountSelectElement(id, 31, 0, this)
    this.visibilityToggle = new VisibilityElement(id, 31, 12, this)
    this.addVertical = new AddVerticalElement(id, 43, 12, this)
    this.addHorizontal = new AddHorizontalElement(id, 31, 24, this)

    this.sizeSelect.navigateTargets.next = this.countSelect
    this.sizeSelect.navigateTargets.right = this.countSelect
    this.countSelect.setNavigateTargets(
      this.sizeSelect,
      this.visibilityToggle,
      null,
      this.visibilityToggle,
      this.sizeSelect,
      null
    )
    this.visibilityToggle.setNavigateTargets(
      this.countSelect,
      this.addVertical,
      this.countSelect,
      this.addHorizontal,
      this.sizeSelect,
      this.addVertical
    )
    this.addVertical.setNavigateTargets(
      this.visibilityToggle,
      this.addHorizontal,
      this.countSelect,
      this.addHorizontal,
      this.visibilityToggle,
      null
    )
    this.addHorizontal.setNavigateTargets(
      this.addVertical,
      null,
      this.visibilityToggle,
      null,
      this.sizeSelect,
      this.addVertical
    )
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
