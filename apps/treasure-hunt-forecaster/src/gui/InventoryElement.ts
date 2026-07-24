import { theme } from "../MainGUI.ts";
import { drawRect, hasParam } from "../../../../lib/util.ts";
import { Element, NavigateType } from "./Element.ts";
import { drawText } from "./TextRenderer.ts";
import { Item, ItemId, ItemSet } from "../../../../data/ba/inventories.ts";
import { counter_cache as cc } from "../counter/cache.ts";
import { counter } from "../counter/counter.ts";
import { tw, WrappedTranslatable } from "../../i18n.ts";

interface PlacementStash {
  readonly width: number;
  readonly height: number;
  readonly count: number;
  readonly hori: number[];
  readonly vert: number[];
}

class ItemPlacements {
  readonly parent
  readonly id
  #width = 2
  #height = 2
  #count = 2
  private stashed: PlacementStash | null = null
  readonly hori: number[] = []
  readonly vert: number[] = []

  constructor(parent: InventoryElement, id: ItemId) {
    this.parent = parent
    this.id = id
  }

  get width() {
    return this.#width
  }

  get height() {
    return this.#height
  }

  get count() {
    return this.#count
  }

  updateSize(width: number, height: number) {
    if (this.#width === width && this.#height === height) return
    this.stash()
    this.#width = width
    this.#height = height
    this.tryApplyStash()
    this.parent.stopPlace()
    this.parent.markDirty()
    this.parent.scheduleInstantCounter()
  }

  updateCount(count: number) {
    if (this.#count === count) return
    this.stash()
    this.#count = count
    this.tryApplyStash()
    this.parent.stopPlace()
    this.parent.markDirty()
    this.parent.scheduleInstantCounter()
  }

  getRotatedWH(rotate: boolean) {
    return rotate ? { w: this.#height, h: this.#width } : { w: this.#width, h: this.#height }
  }

  getRenderingXYWH(index: number, rotate: boolean = this.vert.includes(index)) {
    const x = 4 + (index % 9) * 24 + 3
    const y = 4 + Math.floor(index / 9) * 24 + 3
    const { w, h } = this.getRotatedWH(rotate)
    const wpx = w * 24 - 3 - 6
    const hpx = h * 24 - 3 - 6
    return { x, y, w: wpx, h: hpx }
  }

  validatePlacement(index: number, rotate: boolean) {
    const maxw = 9 - index % 9
    const maxh = 5 - Math.floor(index / 9)
    const { w, h } = this.getRotatedWH(rotate)
    if (w > maxw || h > maxh) {
      throw tw('hover.placementOOB')
    }
    const board = this.parent.board
    for (const i of iterateSquareIndexes(index, w, h)) {
      if ((board[i] & 0b0111) !== 0) {
        throw tw('hover.placementOccupied')
      }
    }
    return { w, h }
  }

  place(index: number, rotate: boolean) {
    const { w, h } = this.validatePlacement(index, rotate)
    this.stashed = null
    const board = this.parent.board
    board[index] = (board[index] & unplaceMask) | (this.id + 1)
    const data = (index << 4) | 0b0100
    for (const i of iterateSquareIndexes(index, w, h).drop(1)) {
      board[i] = (board[i] & unplaceMask) | data
    }
    ;(rotate ? this.vert : this.hori).push(index)
    this.parent.markDirty()
    this.parent.scheduleInstantCounter()
  }

  unplace(index: number, rotate: boolean = this.vert.includes(index)) {
    const arr = rotate ? this.vert : this.hori
    const i = arr.indexOf(index)
    if (i === -1) {
      console.warn(`trying to unplace non-existent placement at ${index}`)
      return
    }
    arr.splice(i, 1)
    const w = rotate ? this.#height : this.#width
    const h = rotate ? this.#width : this.#height
    const board = this.parent.board
    for (const i of iterateSquareIndexes(index, w, h)) {
      board[i] &= unplaceMask
    }
    this.parent.main?.itemcfg[this.id].markAddsDirty()
    this.parent.markDirty()
    this.parent.scheduleInstantCounter()
  }

  stash() {
    if (!this.hori.length && !this.vert.length) return
    this.stashed = {
      width: this.#width,
      height: this.#height,
      count: this.hori.length + this.vert.length,
      hori: this.hori.slice(),
      vert: this.vert.slice()
    }
    this.clear()
  }

  tryApplyStash() {
    if (this.hori.length || this.vert.length) return
    if (!this.stashed) return
    if (this.#count < this.stashed.count) return

    const match = this.#width === this.stashed.width && this.#height === this.stashed.height
    const matchRotated = this.#width === this.stashed.height && this.#height === this.stashed.width
    if (!match && !matchRotated) return

    try {
      const { hori, vert } = this.stashed
      this.stashed = null
      for (const index of hori) {
        this.place(index, !match)
      }
      for (const index of vert) {
        this.place(index, match)
      }
    } catch (e) {
      console.warn(`tryApplyStash failed:`, e)
      this.clear()
    }
  }

  clear() {
    for (const index of this.hori.slice()) {
      this.unplace(index, false)
    }
    for (const index of this.vert.slice()) {
      this.unplace(index, true)
    }
  }

  getCountLeft() {
    return Math.max(0, this.count - this.hori.length - this.vert.length)
  }

  isSquare(): boolean {
    return this.#width === this.#height
  }

  toTuple(): Item {
    return this.height > this.width
      ? [this.height, this.width, this.getCountLeft()]
      : [this.width, this.height, this.getCountLeft()]
  }
}

const invBits = {
  /** `0` for none, `1 | 2 | 3` for top left of placed item */
  state: 0b0011,
  /** occupied space for placed item */
  occupied: 0b0100,
  /** opened slot */
  opened: 0b1000,
  /** index of top left of placed item when occupied */
  indexRef: 0b111111_0000,
} as const
const unplaceMask = ~(invBits.state | invBits.occupied | invBits.indexRef)

export class InventoryElement extends Element {
  readonly board = new Uint16Array(45)
  readonly placements: readonly [ItemPlacements, ItemPlacements, ItemPlacements] = [
    new ItemPlacements(this, 0),
    new ItemPlacements(this, 1),
    new ItemPlacements(this, 2),
  ]
  placing: ItemId | null = null
  placeRotate = false
  private doInstant = false

  constructor(x: number, y: number, parent: Element) {
    super(x, y, 221, 125, parent)
  }

  render(ctx: OffscreenCanvasRenderingContext2D) {
    ctx.fillStyle = theme.generic
    drawRect(ctx, 0, 0, 221, 125)

    for (const p of this.placements) {
      const f = theme[`item${p.id}fill`]
      const o = theme[`item${p.id}outline`]
      const w = p.width * 24 - 3 - 6
      const h = p.height * 24 - 3 - 6
      for (const index of p.hori) {
        const x = 4 + (index % 9) * 24 + 3
        const y = 4 + Math.floor(index / 9) * 24 + 3
        ctx.fillStyle = f
        ctx.fillRect(x, y, w, h)
        ctx.fillStyle = o
        drawRect(ctx, x, y, w, h)
      }
      for (const index of p.vert) {
        const x = 4 + (index % 9) * 24 + 3
        const y = 4 + Math.floor(index / 9) * 24 + 3
        ctx.fillStyle = f
        ctx.fillRect(x, y, h, w)
        ctx.fillStyle = o
        drawRect(ctx, x, y, h, w)
      }
    }

    const res = this.getResult()

    if (res) {
      const { total: total64, count } = res
      const total = Number(total64)
      const visibility = this.main.itemcfg.map(v => v.visible ? 1 : 0)
      const sums = BigUint64Array.from({ length: 45 }, (_, i) => visibility.reduce((p, v, id) => v ? p + count[id][i] : p, 0n))
      const max = sums.reduce((p, v) => v > p ? v : p)
      const nmax = Number(max) || 1
      const maxStyle = max === total64 ? theme.item0fill : theme.item1fill
      for (let row = 0; row < 5; row++) {
        const rs = row * 9
        for (let col = 0; col < 9; col++) {
          const index = rs + col
          const bits = this.board[index]
          if (bits === 0) {
            const x = 4 + col * 24
            const y = 4 + row * 24
            const sum = sums[index]
            if (sum === 0n) {
              const c = theme.generic + '20'
              ctx.fillStyle = c
              this.#drawStickyNote(ctx, x, y)
              drawText(ctx, x + 10, y + 8, c, '0', true)
              continue
            }
            const nsum = Number(sum)
            const perc = Math.trunc(nsum / total * 1000 - 500) / 10 + 50
            const alpha = Math.floor(255 * (0.2 + (nsum / nmax) * 0.8)).toString(16).slice(0, 2).padStart(2, '0')
            ctx.fillStyle = sum === max ? maxStyle : theme.generic + alpha
            this.#drawStickyNote(ctx, x, y)
            drawText(ctx, x + 2, y + 5, theme.generic + alpha,
              sum === total64 ? '100%' : `${perc.toFixed(1).slice(0, 4).padStart(4, ' ')}%`
            )

            const item0bar = visibility[0] && Math.trunc(Number(count[0][index]) / total * 17 - 8) + 8
            const item1bar = visibility[1] && Math.trunc(Number(count[1][index]) / total * 17 - 8) + 8
            const item2bar = visibility[2] && Math.trunc(Number(count[2][index]) / total * 17 - 8) + 8
            if (item0bar) {
              ctx.fillStyle = theme.item0outline + alpha
              ctx.fillRect(x + 2, y + 11, item0bar, 1)
            }
            if (item1bar) {
              ctx.fillStyle = theme.item1outline + alpha
              ctx.fillRect(x + 2, y + 13, item1bar, 1)
            }
            if (item2bar) {
              ctx.fillStyle = theme.item2outline + alpha
              ctx.fillRect(x + 2, y + 15, item2bar, 1)
            }
          } else if (bits === invBits.opened) {
            const x = 4 + col * 24
            const y = 4 + row * 24
            ctx.fillStyle = theme.gray
            drawRect(ctx, x, y, 21, 21)
          }
        }
      }
    } else {
      const nomore = this.hasNoMorePlacement()
      const c = nomore ? '0' : '?'
      const color = theme.generic + (nomore ? '33' : 'ff')
      for (let row = 0; row < 5; row++) {
        const rs = row * 9
        for (let col = 0; col < 9; col++) {
          const bits = this.board[rs + col]
          if (bits === 0) {
            const x = 4 + col * 24
            const y = 4 + row * 24
            ctx.fillStyle = color
            this.#drawStickyNote(ctx, x, y)
            drawText(ctx, x + 10, y + 8, color, c, true)
          } else if (bits === invBits.opened) {
            const x = 4 + col * 24
            const y = 4 + row * 24
            ctx.fillStyle = theme.gray
            drawRect(ctx, x, y, 21, 21)
          }
        }
      }
    }

    if (this.doInstant) {
      this.doInstant = false
      if (!hasParam('noauto') && !counter.isRunningInfinitely()) {
        counter.start(this.getItemSet(), this.getBoardBits(), 1000)
        this.markDirty()
        this.main.startButton.markDirty()
        this.main.saveState()
      }
    }
  }

  /**
   * ! changes style
   */
  #drawStickyNote(ctx: CanvasRect & CanvasFillStrokeStyles, x: number, y: number, resetStyle = false) {
    const was = ctx.fillStyle
    ctx.fillRect(x, y, 21, 1)
    ctx.fillRect(x, y + 20, 18, 1)
    ctx.fillRect(x, y + 1, 1, 19)
    ctx.fillRect(x + 20, y + 1, 1, 17)
    ctx.fillRect(x + 17, y + 17, 3, 1)
    ctx.fillRect(x + 17, y + 18, 1, 2)
    ctx.fillRect(x + 19, y + 18, 1, 1)
    ctx.fillRect(x + 18, y + 19, 1, 1)
    ctx.fillStyle = theme.background + '80'
    ctx.fillRect(x + 19, y + 18, 1, 1)
    ctx.fillRect(x + 18, y + 19, 1, 1)
    if (resetStyle) {
      ctx.fillStyle = was
    }
  }

  markDirty() {
    super.markDirty()
    this.main?.startButton.markDirty()
  }

  renderHover(ctx: OffscreenCanvasRenderingContext2D) {
    const index = this.#getIndex(this.hoverX, this.hoverY)
    if (index == null) {
      this.hoverText = tw('hover.empty')
      return
    }
    if (this.placing != null) {
      const plac = this.placements[this.placing]
      try {
        plac.validatePlacement(index, this.placeRotate)
        this.hoverText = plac.isSquare()
          ? tw('hover.clickToPlace', { item: this.placing + 1 })
          : this.placeRotate
            ? tw('hover.clickToPlaceVert', { item: this.placing + 1 })
            : tw('hover.clickToPlaceHori', { item: this.placing + 1 })
        ctx.fillStyle = theme.background + '80'
      } catch (e) {
        this.hoverText = e instanceof WrappedTranslatable ? e : tw(t => `${e}`)
        ctx.fillStyle = '#FF000080'
      }
      const { x, y, w, h } = plac.getRenderingXYWH(index, this.placeRotate)
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6)
      ctx.fillStyle = theme[`item${this.placing}fill`] + '80'
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2)
      ctx.fillStyle = theme[`item${this.placing}outline`] + '80'
      drawRect(ctx, x, y, w, h)
    } else {
      const data = this.board[index]
      if (data & invBits.occupied) {
        const i = (data & invBits.indexRef) >> 4
        const datatl = this.board[i]
        if (datatl & invBits.state) {
          this.hoverText = tw('hover.clickToRemoveItem')
          const { x, y, w, h } = this.placements[(datatl & invBits.state) - 1].getRenderingXYWH(i)
          ctx.fillStyle = theme.hover
          ctx.fillRect(x - 3, y - 3, w + 6, h + 6)
        } else {
          this.hoverText = tw('hover.somethingWrongInInv')
        }
      } else if (data & invBits.state) {
        this.hoverText = tw('hover.clickToRemoveItem')
        const { x, y, w, h } = this.placements[(data & invBits.state) - 1].getRenderingXYWH(index)
        ctx.fillStyle = theme.hover
        ctx.fillRect(x - 3, y - 3, w + 6, h + 6)
      } else {
        const opened = data & invBits.opened
        this.hoverText = opened
          ? tw('hover.clickToMarkClose', { index })
          : tw('hover.clickToMarkOpen', { index })
        ctx.fillStyle = theme.hover
        ctx.fillRect(
          4 + (index % 9) * 24,
          4 + Math.floor(index / 9) * 24,
          21, 21
        )
        if (!opened) {
          const res = this.getResult()
          if (res) {
            const counts = res.count.map(v => v[index])
            const sum = counts.reduce((p, v) => p + v)
            const visibility = this.main.itemcfg.map(v => v.visible ? 1 : 0)
            const visible = counts.reduce((p, v, i) => visibility[i] ? p + v : p, 0n)
            const perc = Math.trunc(Number(visible) / Number(res.total) * 100000 - 50000) / 1000 + 50
            this.hoverText = this.hoverText.concat(
              visibility.every(v => v)
              ? tw('hover.slotStat', {
                counts: counts.map(v => v.toLocaleString()).join(',\u00A0'),
                sum: sum.toLocaleString(),
                perc: perc.toFixed(3).replace(/00+$/, '0')
              })
              : tw('hover.slotStatPartialVisible', {
                counts: counts.map(v => v.toLocaleString()).join(',\u00A0'),
                sum: sum.toLocaleString(),
                perc: perc.toFixed(3).replace(/00+$/, '0'),
                visible: visible.toLocaleString()
              })
            )
          }
        }
      }
    }
  }

  onClick(x: number, y: number): boolean {
    const index = this.#getIndex(x, y)
    if (index == null) return false
    if (this.placing != null) {
      try {
        this.placements[this.placing].place(index, this.placeRotate)
      } catch {}
      this.stopPlace()
    } else {
      const data = this.board[index]
      if (data & invBits.occupied) {
        const i = (data & invBits.indexRef) >> 4
        const datatl = this.board[i]
        if (datatl & invBits.state) {
          this.placements[(datatl & invBits.state) - 1].unplace(i)
        } else {
          this.board[index] = data & unplaceMask
          this.markDirty()
          this.scheduleInstantCounter()
        }
      } else if (data & invBits.state) {
        this.placements[(data & invBits.state) - 1].unplace(index)
      } else {
        this.board[index] = data ^ invBits.opened
        this.markDirty()
        this.scheduleInstantCounter()
      }
    }
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
        let v = Math.floor((this.hoverY - 4) / 24) * 9 + Math.floor((this.hoverX - 4) / 24)
        switch (type) {
          case 'prev':
            v--
            break
          case 'next':
            v++
            break
          case 'up':
            v -= 9
            break
          case 'down':
            v += 9
            break
          case 'left':
            v = v % 9 === 0 ? -1 : v - 1
            break
          case 'right':
            v = v % 9 === 8 ? -1 : v + 1
            break
        }
        if (v < 0 || v >= 45) {
          this.unhover()
          return false
        }
        this.onHover(14 + (v % 9) * 24, 14 + Math.floor(v / 9) * 24)
        return true
      } else {
        this.onHover(14, 14)
        return true
      }
    }
  }

  #getIndex(x: number, y: number): number | null {
    x -= 4
    y -= 4
    if (x < 0 || y < 0 || x >= 213 || y >= 117) return null
    const index = Math.floor((y + 1.5) / 24) * 9 + Math.floor((x + 1.5) / 24)
    const data = this.board[index]
    if (data & invBits.occupied) {
      const i = (data & invBits.indexRef) >> 4
      const datatl = this.board[i]
      if (datatl & invBits.state) {
        return checkPlacement(this.placements[(datatl & invBits.state) - 1], i) ? index : null
      }
    } else if (data & invBits.state) {
      return checkPlacement(this.placements[(data & invBits.state) - 1], index) ? index : null
    }
    if (x % 24 > 20 || y % 24 > 20) return null
    return index

    function checkPlacement(plac: ItemPlacements, index: number) {
      const { x: rx, y: ry, w, h } = plac.getRenderingXYWH(index)
      const x2 = x - rx + 7
      const y2 = y - ry + 7
      return x2 >= 0 && y2 >= 0 && x2 < w + 6 && y2 < h + 6
    }
  }

  startPlace(id: ItemId, rotate: boolean) {
    const stop = this.placing === id && this.placeRotate === rotate
    this.stopPlace()
    if (stop || this.placements[id].getCountLeft() === 0) return
    this.placing = id
    this.placeRotate = rotate
    this.markDirty()
  }

  stopPlace() {
    if (this.placing != null) {
      this.main.itemcfg[this.placing].markAddsDirty()
      this.placing = null
      this.markDirty()
    }
  }

  getBoardBits() {
    let res = 0n
    for (let i = 0; i < 45; i++) {
      if (this.board[i]) {
        res |= 1n << BigInt(i)
      }
    }
    return res
  }

  getItemSet(): ItemSet {
    return [
      this.placements[0].toTuple(),
      this.placements[1].toTuple(),
      this.placements[2].toTuple()
    ]
  }

  getCountKey() {
    return cc.getKey(this.getBoardBits(), this.getItemSet())
  }

  getResult() {
    return cc.get(this.getBoardBits(), this.getItemSet())
  }

  scheduleInstantCounter() {
    this.doInstant = true
    this.markDirty()
  }

  hasNoMorePlacement() {
    return this.placements.every(p => p.getCountLeft() === 0)
  }
}

function* iterateSquareIndexes(index: number, width: number, height: number) {
  for (let y = 0; y < height; y++) {
    const row = index + 9 * y
    for (let x = 0; x < width; x++) {
      yield row + x
    }
  }
}
