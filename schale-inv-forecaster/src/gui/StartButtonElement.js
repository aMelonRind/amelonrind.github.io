
import { countStart, isAvailableStart, progress, results, startCounter, state } from "../CounterHandler.js"
import { i18n } from "../I18n.js"
import { theme } from "../MainGUI.js"
import { drawRect } from "../util.js"
import { Element } from "./Element.js"
import { drawText } from "./TextRenderer.js"

export class StartButtonElement extends Element {
  running = false
  hasResult = false
  animationTicks = 0

  /**
   * @param {number} x 
   * @param {number} y 
   * @param {Element} parent 
   */
  constructor(x, y, parent) {
    super(x, y, 49, 13, parent)
  }

  /** @type {Element['render']} */
  render(ctx) {
    ctx.fillStyle = theme.generic
    drawRect(ctx, 0, 0, 49, 13)
    if (state === 'running') {
      this.running = true
      this.markDirty()
      ctx.fillStyle = theme.background
      ctx.fillRect(15, 0, 19, 13)
      ctx.fillStyle = theme.generic
      this.animationTicks++
      if (this.animationTicks >= 36) this.animationTicks = 0
      const x = 15 + (this.animationTicks > 18 ? 36 - this.animationTicks : this.animationTicks)
      ctx.fillRect(x, 0, 1, 1)
      ctx.fillRect(x, 12, 1, 1)
      if (progress) {
        const [prog, max] = progress.split('/').map(v => parseInt(v))
        const bar = Math.floor(prog / max * 47)
        if (bar) {
          ctx.fillStyle = theme.generic + '40'
          ctx.fillRect(1, 1, bar, 11)
        }
      }
      drawText(ctx, 24, 4, theme.generic, progress ?? '?/?', true)
    } else {
      if (this.running) {
        this.main.inventory.markDirty()
        this.running = false
      }
      this.animationTicks = 0
      const res = results.get(this.main.inventory.getCountKey())
      this.hoverText = i18n.clickToStart
      this.hasResult = false
      let text = 'START'
      if (res != null) {
        const total = res.total
        this.hoverText = i18n.totalPossibilities(total, res.time)
        this.hasResult = true
        if (total <= 99999n) {
          text = `TOTAL:${total.toLocaleString()}`
        } else {
          const str = total.toString()
          const unit = Math.ceil(Math.max(0, str.length - 4) / 3)
          if (unit <= 5) {
            text = `TOTAL:${total.toLocaleString().slice(0, unit * -4)}${'KMBTQ'[unit - 1]}`
          } else {
            text = `TOTAL:${str[0]}.${str[1]}E${str.length - 1}`
          }
        }
      } else if (this.main.inventory.hasNoMorePlacement()) {
        this.hoverText = i18n.totalPossibilities1
        this.hasResult = true
        text = 'TOTAL:1'
      }
      drawText(ctx, 24, 4, theme.generic, text, true)
    }
  }

  /** @type {Element['renderHover']} */
  renderHover(ctx) {
    this.drawFullHover(ctx)
    if (this.running) {
      const inv = this.main.inventory
      const canRestart = isAvailableStart(inv.getBoardBits(), inv.getItemSet())
      this.hoverText = (canRestart ? i18n.runningCanRestart : i18n.running)
        + i18n.runningElapsed(performance.now() - countStart)
    }
  }

  /** @type {Element['onClick']} */
  onClick() {
    this.main.saveState()
    if (!this.running && this.hasResult) return false
    const inv = this.main.inventory
    startCounter(inv.getBoardBits(), inv.getItemSet())
    this.running = true
    this.markDirty()
    return true
  }

  /** @type {Element['navigate']} */
  navigate(type) {
    return this.simpleButtonNavigate(type)
  }

}
