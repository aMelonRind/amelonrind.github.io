import { theme } from "../MainGUI.ts";
import { drawRect, hasParam } from "../../../../lib/util.ts";
import { Element, NavigateType } from "./Element.ts";
import { drawText } from "./TextRenderer.ts";
import { counter } from "../counter/counter.ts";
import { tw } from "../../i18n.ts";

export class StartButtonElement extends Element {
  running = false
  hasResult = false
  animationTicks = 0

  constructor(x: number, y: number, parent: Element) {
    super(x, y, 49, 13, parent)
  }

  render(ctx: OffscreenCanvasRenderingContext2D) {
    ctx.fillStyle = theme.generic
    drawRect(ctx, 0, 0, 49, 13)
    if (counter.isRunning()) {
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

      const bar = Math.floor(counter.getProgressFraction() * 47)
      if (bar) {
        ctx.fillStyle = theme.generic + '40'
        ctx.fillRect(1, 1, bar, 11)
      }

      drawText(ctx, 24, 4, theme.generic, counter.getProgress() || '?/?', true)
    } else {
      if (this.running) {
        this.main.inventory.markDirty()
        setTimeout(() => this.main.inventory.markDirty(), 500)
        this.running = false
      }
      this.animationTicks = 0
      const res = this.main.inventory.getResult()
      this.hoverText = tw('hover.clickToStart')
      this.hasResult = false
      let text = 'START'
      if (res != null) {
        const total = res.total
        this.hoverText = tw('hover.totalPossibilities', { total: total.toLocaleString(), time: res.time.toFixed(1) })
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
        this.hoverText = tw('hover.totalPossibilities1')
        this.hasResult = true
        text = 'TOTAL:1'
      }
      drawText(ctx, 24, 4, theme.generic, text, true)
    }
  }

  renderHover(ctx: OffscreenCanvasRenderingContext2D) {
    this.drawFullHover(ctx)
    if (this.running) {
      const inv = this.main.inventory
      const canRestart = counter.canStart(inv.getBoardBits(), inv.getItemSet())
      const runningText = canRestart
        ? tw('hover.runningCanRestart')
        : tw('hover.running')
      this.hoverText = runningText.concat(tw('hover.runningElapsed', {
        elapsedSec: (counter.getElapsed() / 1000).toFixed(1)
      }))
    }
  }

  onClick(): boolean {
    this.main.saveState()
    if (!this.running && this.hasResult && !hasParam('force_start')) return false
    const inv = this.main.inventory
    counter.start(inv.getItemSet(), inv.getBoardBits())
    this.running = true
    this.markDirty()
    return true
  }

  navigate(type: NavigateType): boolean {
    return this.simpleButtonNavigate(type)
  }

}
