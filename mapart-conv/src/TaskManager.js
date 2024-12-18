
export default class TaskManager {

  /** @type {MainTask?} */ static _running = null
  /** @type {HTMLElement?} */ static progressDiv = null

  /**
   * all async operation should run with this method.
   * @param {string} taskName 
   * @param {(tracker: ITask) => Promise<any>} task 
   */
  static run(taskName, task) {
    if (this._running) {
      console.warn(`Already have a task running! Tried to run task: ${taskName}`)
      return
    } else {
      console.log(`Trying to run task: ${taskName}`)
    }
    const main = new MainTask(taskName)
    task(main).then(() => {
      if (main._taskStack.length > 0) {
        console.warn(`Progress bar not empty after task! Forgot to pop somewhere?`, main, main.toString())
      }
    }).finally(() => {
      this._running = null
      if (this.progressDiv) {
        this.progressDiv.innerText = ''
      }
    })
    this._running = main
  }

  static async render(force = false) {
    if (this.progressDiv) {
      await this._running?.render(this.progressDiv, force)
    }
  }

}

class Task {
  _progress = -1
  _desc = ''
  _max = 1
  _perc = 0

  /**
   * @param {number} max 
   */
  setMax(max) {
    this._max = max
  }

  /**
   * @param {number} prog 
   * @param {string} desc 
   */
  progress(prog = this._progress + 1, desc = this._desc) {
    this._desc = desc
    this._progress = prog
  }

  /**
   * @param {number} subPercent 
   * @returns 
   */
  _updatePercentage(subPercent) {
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
  /** @readonly */ static DUMMY = new ITask()
  /** @type {MainTask} *///@ts-ignore
  main = this

  setMax(max = 1) { return this }
  async push(desc = '', subMax = 1) {}
  async progress(progress = 0, desc = '') {}
  /** @param {number} progress */
  async progress256(progress) {}
  async swap(desc = '') {}
  pop() { return this }
  /** forces next render */
  force() { return this }
}

class MainTask extends ITask {
  /** @type {string} */ _name
  /** @type {string} */ _desc = ''
  /** @type {Task[]} */ _taskStack = []
  _lastRender = 0
  _forceNextRender = false

  /**
   * @param {string} name 
   */
  constructor(name) {
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

  /**
   * @param {number} [progress] 
   * @param {string} [desc] 
   */
  async progress(progress = undefined, desc) {
    this._taskStack.at(-1)?.progress(progress, desc)
    await TaskManager.render(false)
  }

  /**
   * @param {number} progress 
   */
  async progress256(progress) {
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

  /**
   * @param {HTMLElement} element 
   * @param {boolean} force 
   */
  async render(element, force = false) {
    if (Date.now() - this._lastRender < 50 && !this._forceNextRender && !force) return
    this._forceNextRender = false
    this._taskStack.reduceRight((p, t) => t._updatePercentage(p), 0)
    element.innerText = this.toString()
    await new Promise(res => requestAnimationFrame(() => setTimeout(res, 0)))
    // await new Promise(res => setTimeout(res, 0))
    this._lastRender = Date.now()
  }

  toString() {
    return `Task: ${this._name}\n${this._desc}\n${this._taskStack.map(t => t.toString()).join('\n')}`
  }

}

globalThis.progressTest = async function progressTest(len = 3000) {
  TaskManager.run('progressTest', async task => {
    let t = Date.now() + 1
    await task.push('running 3 tasks...', 3)
    for (let i = 0; i < 3; i++) {
      await task.push(`task ${i + 1}`, len)
      for (let j = 0; j <= len; j++) {
        await task.progress(j, 'reading data')
        while (Date.now() < t);
        t = Date.now() + 1
      }
      task.pop()
    }
    await task.force().swap('finalizing')
    await new Promise(res => setTimeout(res, 500))
  })
}
