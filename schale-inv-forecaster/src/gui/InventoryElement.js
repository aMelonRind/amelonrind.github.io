
import { results } from "../CounterHandler.js"
import { i18n } from "../I18n.js"
import { theme } from "../MainGUI.js"
import { drawRect } from "../util.js"
import { Element } from "./Element.js"
import { drawText } from "./TextRenderer.js"

class ItemPlacements {
  /** @readonly */ parent
  /** @readonly */ id
  #width = 2
  #height = 2
  #count = 2
  /** @readonly @type {number[]} */ hori = []
  /** @readonly @type {number[]} */ vert = []

  /**
   * @param {InventoryElement} parent 
   * @param {ItemId} id 
   */
  constructor(parent, id) {
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

  /**
   * @param {number} width 
   * @param {number} height 
   */
  updateSize(width, height) {
    if (this.#width === width && this.#height === height) return
    this.clear()
    this.#width = width
    this.#height = height
    this.parent.stopPlace()
    this.parent.markDirty()
  }

  /**
   * @param {number} count 
   */
  updateCount(count) {
    if (this.#count === count) return
    if (this.hori.length + this.vert.length > count) {
      this.clear()
    }
    this.#count = count
    this.parent.stopPlace()
    this.parent.markDirty()
  }

  /**
   * @param {boolean} rotate 
   */
  getRotatedWH(rotate) {
    return rotate ? { w: this.#height, h: this.#width } : { w: this.#width, h: this.#height }
  }

  /**
   * @param {number} index 
   * @param {boolean} rotate 
   */
  getRenderingXYWH(index, rotate = this.vert.includes(index)) {
    const x = 4 + (index % 9) * 24 + 3
    const y = 4 + Math.floor(index / 9) * 24 + 3
    const { w, h } = this.getRotatedWH(rotate)
    const wpx = w * 24 - 3 - 6
    const hpx = h * 24 - 3 - 6
    return { x, y, w: wpx, h: hpx }
  }

  /**
   * @param {number} index 
   * @param {boolean} rotate 
   */
  validatePlacement(index, rotate) {
    const maxw = 9 - index % 9
    const maxh = 5 - Math.floor(index / 9)
    const { w, h } = this.getRotatedWH(rotate)
    if (w > maxw || h > maxh) {
      throw i18n.placementOOB
    }
    const board = this.parent.board
    for (const i of iterateSquareIndexes(index, w, h)) {
      if ((board[i] & 0b0111) !== 0) {
        throw i18n.placementOccupied
      }
    }
    return { w, h }
  }

  /**
   * @param {number} index 
   * @param {boolean} rotate 
   */
  place(index, rotate) {
    const { w, h } = this.validatePlacement(index, rotate)
    const board = this.parent.board
    board[index] = (board[index] & unplaceMask) | (this.id + 1)
    const data = (index << 4) | 0b0100
    for (const i of iterateSquareIndexes(index, w, h).drop(1)) {
      board[i] = (board[i] & unplaceMask) | data
    }
    ;(rotate ? this.vert : this.hori).push(index)
    this.parent.markDirty()
  }

  /**
   * @param {number} index 
   * @param {boolean} rotate 
   */
  unplace(index, rotate = this.vert.includes(index)) {
    const arr = rotate ? this.vert : this.hori
    const i = arr.indexOf(index)
    if (i === -1) return
    arr.splice(i, 1)
    const w = rotate ? this.#height : this.#width
    const h = rotate ? this.#width : this.#height
    const board = this.parent.board
    for (const i of iterateSquareIndexes(index, w, h)) {
      board[i] = board[i] & unplaceMask
    }
    this.parent.main?.itemcfg[this.id].markAddsDirty()
    this.parent.markDirty()
  }

  clear() {
    for (const index of this.hori) {
      this.unplace(index, false)
    }
    for (const index of this.vert) {
      this.unplace(index, true)
    }
  }

  getCountLeft() {
    return Math.max(0, this.count - this.hori.length - this.vert.length)
  }

  /**
   * @returns {Item}
   */
  toTuple() {
    return this.height > this.width
      ? [this.height, this.width, this.getCountLeft()]
      : [this.width, this.height, this.getCountLeft()]
  }
}

const invBits = {
  /** `0` for none, `1 | 2 | 3` for top left of placed item @readonly */ state: 0b0011,
  /** occupied space for placed item @readonly */ occupied: 0b0100,
  /** opened slot @readonly */ opened: 0b1000,
  /** index of top left of placed item when occupied @readonly */ indexRef: 0b111111_0000,
}
const unplaceMask = ~(invBits.state | invBits.occupied | invBits.indexRef)

export class InventoryElement extends Element {
  /** @readonly */ board = new Uint16Array(45)
  /** @readonly @type {readonly [ItemPlacements, ItemPlacements, ItemPlacements]} */
  placements = [
    new ItemPlacements(this, 0),
    new ItemPlacements(this, 1),
    new ItemPlacements(this, 2),
  ]
  /** @type {ItemId?} */
  placing = null
  placeRotate = false

  /**
   * @param {number} x 
   * @param {number} y 
   * @param {Element} parent 
   */
  constructor(x, y, parent) {
    super(x, y, 221, 125, parent)
  }

  /** @type {Element['render']} */
  render(ctx) {
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

    const res = results.get(this.getCountKey())

    if (res) {
      const { total: total64, count } = res
      const total = Number(total64)
      const visibility = this.main.itemcfg.map(v => v.visible ? 1 : 0)
      const sums = BigUint64Array.from({ length: 45 }, (_, i) => visibility.reduce((p, v, id) => v ? p + count[id][i] : p, 0n))
      const max = sums.reduce((p, v) => v > p ? v : p)
      const nmax = Number(max)
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
      const c = this.hasNoMorePlacement() ? '0' : '?'
      for (let row = 0; row < 5; row++) {
        const rs = row * 9
        for (let col = 0; col < 9; col++) {
          const bits = this.board[rs + col]
          if (bits === 0) {
            const x = 4 + col * 24
            const y = 4 + row * 24
            ctx.fillStyle = theme.generic
            this.#drawStickyNote(ctx, x, y)
            drawText(ctx, x + 10, y + 8, theme.generic, c, true)
          } else if (bits === invBits.opened) {
            const x = 4 + col * 24
            const y = 4 + row * 24
            ctx.fillStyle = theme.gray
            drawRect(ctx, x, y, 21, 21)
          }
        }
      }
    }
  }

  /**
   * ! changes style
   * @param {CanvasRect & CanvasFillStrokeStyles} ctx 
   * @param {*} x 
   * @param {*} y 
   */
  #drawStickyNote(ctx, x, y, resetStyle = false) {
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

  /** @type {Element['renderHover']} */
  renderHover(ctx) {
    const index = this.#getIndex(this.hoverX, this.hoverY)
    if (index == null) {
      this.hoverText = i18n.empty
      return
    }
    if (this.placing != null) {
      const plac = this.placements[this.placing]
      try {
        plac.validatePlacement(index, this.placeRotate)
        this.hoverText = i18n.clickToPlaceItem(this.placing, this.placeRotate)
        ctx.fillStyle = theme.background + '80'
      } catch (e) {
        this.hoverText = e
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
          this.hoverText = i18n.clickToRemoveItem
          const { x, y, w, h } = this.placements[(datatl & invBits.state) - 1].getRenderingXYWH(i)
          ctx.fillStyle = theme.hover
          ctx.fillRect(x - 3, y - 3, w + 6, h + 6)
        } else {
          this.hoverText = i18n.somethingWrongInInv
        }
      } else if (data & invBits.state) {
        this.hoverText = i18n.clickToRemoveItem
        const { x, y, w, h } = this.placements[(data & invBits.state) - 1].getRenderingXYWH(index)
        ctx.fillStyle = theme.hover
        ctx.fillRect(x - 3, y - 3, w + 6, h + 6)
      } else {
        const opened = data & invBits.opened
        this.hoverText = i18n.clickToMark(index, !opened)
        ctx.fillStyle = theme.hover
        ctx.fillRect(
          4 + (index % 9) * 24,
          4 + Math.floor(index / 9) * 24,
          21, 21
        )
        if (!opened) {
          const res = results.get(this.getCountKey())
          if (res) {
            const counts = res.count.map(v => v[index])
            const sum = counts.reduce((p, v) => p + v)
            const visibility = this.main.itemcfg.map(v => v.visible ? 1 : 0)
            const visible = counts.reduce((p, v, i) => visibility[i] ? p + v : p, 0n)
            const perc = Math.trunc(Number(visible) / Number(res.total) * 100000 - 50000) / 1000 + 50
            this.hoverText += i18n.slotStat(counts, sum, visibility.some(v => !v), visible, perc)
          }
        }
      }
    }
  }

  /** @type {Element['onClick']} */
  onClick(x, y) {
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
        }
      } else if (data & invBits.state) {
        this.placements[(data & invBits.state) - 1].unplace(index)
      } else {
        this.board[index] = data ^ invBits.opened
        this.markDirty()
      }
    }
    return true
  }

  /** @type {Element['navigate']} */
  navigate(type) {
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

  /**
   * @param {number} x 
   * @param {number} y 
   * @returns {number?}
   */
  #getIndex(x, y) {
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

    /**
     * @param {ItemPlacements} plac 
     * @param {number} index 
     */
    function checkPlacement(plac, index) {
      const { x: rx, y: ry, w, h } = plac.getRenderingXYWH(index)
      const x2 = x - rx + 7
      const y2 = y - ry + 7
      return x2 >= 0 && y2 >= 0 && x2 < w + 6 && y2 < h + 6
    }
  }

  /**
   * @param {ItemId} id 
   * @param {boolean} rotate 
   */
  startPlace(id, rotate) {
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

  /**
   * @returns {ItemSet}
   */
  getItemSet() {
    return [
      this.placements[0].toTuple(),
      this.placements[1].toTuple(),
      this.placements[2].toTuple()
    ]
  }

  getCountKey() {
    return `${this.getBoardBits()},${this.getItemSet().map(v => v.join(',')).join(',')}`
  }

  hasNoMorePlacement() {
    return this.placements.every(p => p.getCountLeft() === 0)
  }
}

/**
 * @param {number} index 
 * @param {number} width 
 * @param {number} height 
 */
function* iterateSquareIndexes(index, width, height) {
  for (let y = 0; y < height; y++) {
    const row = index + 9 * y
    for (let x = 0; x < width; x++) {
      yield row + x
    }
  }
}
