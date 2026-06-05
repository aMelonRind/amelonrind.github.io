import { Setter } from "solid-js";
import { exposeToGlobal, sleep } from "../../../lib/util.ts";

export default class TaskManager {
  static taskStart = 0

  static _running: MainTask | null = null
  static progressListener: Setter<string> = () => {}

  /**
   * all async operation should run with this method.
   */
  static run(taskName: string, task: (tracker: ITask) => Promise<any>) {
    if (this._running) {
      console.warn(`Already have a task running! Tried to run task: ${taskName}`)
      return
    } else {
      console.log(`Trying to run task: ${taskName}`)
    }
    const main = new MainTask(taskName)
    this.taskStart = performance.now()
    task(main).then(() => {
      if (main._taskStack.length > 0) {
        console.warn(`Progress bar not empty after task! Forgot to pop somewhere?`, main, main.toString())
      }
    }).finally(() => {
      console.log(`Task finished! Took ${(performance.now() - this.taskStart).toFixed(3)}ms.`)
      this._running = null
      this.progressListener('')
    })
    this._running = main
  }

  static async render(force = false) {
    if (this.progressListener) {
      await this._running?.render(this.progressListener, force)
    }
  }

}

class Task {
  _progress = -1
  _desc = ''
  _max = 1
  _perc = 0

  setMax(max: number) {
    this._max = max
  }

  progress(prog: number = this._progress + 1, desc: string = this._desc) {
    this._desc = desc
    this._progress = prog
  }

  _updatePercentage(subPercent: number) {
    this._perc = (this._progress + subPercent) / this._max
    if (this._perc < 0) this._perc = 0
    else if (this._perc > 1) this._perc = 1
    else this._perc ||= 0
    return this._perc
  }

  toString() {
    let res = this._desc
    if (this._max > 0) {
      res += `\n[${'='.repeat(Math.floor(this._perc * 36)).padEnd(36, ' ')
      }|${Math.floor(this._perc * 100).toString().padStart(3, ' ')
      }%] (${this._progress === -1 ? '-' : this._progress}/${this._max})`
    }
    return res.trim()
  }

}

// to make intellisense suggestions cleaner
/**
 * progress tracker
 */
export class ITask {
  static readonly DUMMY = new ITask()
  main: MainTask = this as any

  setMax(max = 1) { return this }
  async push(desc = '', subMax = 1) {}
  async progress(progress = 0, desc = '') {}
  async progress256(progress: number) {}
  async swap(desc = '') {}
  pop() { return this }
  /** forces next render */
  force() { return this }
}

class MainTask extends ITask {
  _name: string
  _desc: string = ''
  _taskStack: Task[] = []
  _lastRender = 0
  _forceNextRender = false

  constructor(name: string) {
    super()
    this._name = name
  }

  setMax(max = 1) {
    const last = this._taskStack.at(-1)
    if (last) {
      last.setMax(max)
    }
    return this
  }

  async push(desc = '', subMax = 1) {
    const last = this._taskStack.at(-1)
    if (last) {
      last.progress(undefined, desc)
    } else {
      this._desc = desc
    }
    const sub = new Task()
    sub.setMax(subMax)
    this._taskStack.push(sub)
    await TaskManager.render(false)
  }

  async progress(progress: number | undefined = undefined, desc: string = '') {
    this._taskStack.at(-1)?.progress(progress, desc)
    await TaskManager.render(false)
  }

  async progress256(progress: number) {
    if ((progress & 0xFF) === 0xFF) {
      await this.progress(progress)
    }
  }

  async swap(desc = '') {
    const last = this._taskStack.at(-1)
    if (last) {
      last.progress(undefined, desc)
    } else {
      this._desc = desc
    }
    await TaskManager.render(false)
  }

  pop() {
    this._taskStack.pop()
    return this
  }

  force() {
    this._forceNextRender = true
    return this
  }

  async render(listener: Setter<string>, force: boolean = false) {
    if (Date.now() - this._lastRender < 50 && !this._forceNextRender && !force) return
    this._forceNextRender = false
    this._taskStack.reduceRight((p, t) => t._updatePercentage(p), 0)
    listener(this.toString())
    await new Promise(res => {
      requestAnimationFrame(() => setTimeout(res, 0))
      setTimeout(res, 30)
    })
    // await new Promise(res => setTimeout(res, 0))
    this._lastRender = Date.now()
  }

  toString() {
    return `Task: ${this._name}\n${this._desc}\n${this._taskStack.map(t => t.toString()).join('\n')}`
  }

}

async function progressTest(len = 3000) {
  TaskManager.run('progressTest', async task => {
    let t = Date.now() + 1
    await task.push('running 3 tasks...', 3)
    for (let i = 0; i < 3; i++) {
      await task.push(`task ${i + 1}`, len)
      for (let j = 0; j <= len; j++) {
        await task.progress(j, `reading data stage ${i}`)
        while (Date.now() < t);
        t = Date.now() + 1
      }
      task.pop()
    }
    await task.force().swap('finalizing')
    await sleep(500)
    task.force().pop()
  })
}
exposeToGlobal({ progressTest })
