//@ts-check

class TaskManager {

  /** @type {MainTask?} */ static _running = null
  /** @type {HTMLElement?} */ static progressDiv = null

  /**
   * any async operation should run with this method.
   * @param {string} taskName 
   * @param {(tracker: Task) => Promise<any>} task 
   */
  static run(taskName, task) {
    if (this._running) {
      console.warn(`Already have a task running! Tried to run task: ${taskName}`)
      return
    } else {
      console.log(`Trying to run task: ${taskName}`)
    }
    const main = new MainTask(taskName)
    task(main).finally(() => {
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

/**
 * progress tracker
 */
class Task {
  _progress = 0
  _desc = ''
  _max = 0
  /** @type {Task?} */ _subtask = null
  _perc = 0

  /**
   * @param {number} max 
   */
  async setMax(max) {
    this._max = max
    await TaskManager.render(true)
  }

  /**
   * @param {number} prog 
   * @param {string} desc 
   */
  async progress(prog = this._progress + 1, desc = this._desc) {
    this._desc = desc
    this._progress = prog
    this._subtask = null
    await TaskManager.render(false)
  }

  /**
   * @param {number} prog 
   * @param {string} desc 
   */
  async subtask(prog = this._progress + 1, desc = this._desc) {
    this.progress(prog, desc)
    return this._subtask = new Task()
  }

  /**
   * @param {number} prog 
   * @param {string} desc 
   */
  async subMultiTask(prog = this._progress + 1, desc = this._desc) {
    this.progress(prog, desc)
    return this._subtask = new MultiTask()
  }

  _updatePercentage() {
    this._perc = this._progress / this._max
    if (this._subtask) {
      const sub = this._subtask._updatePercentage()
      this._perc += sub / this._max
    }
    this._normalizePercentage()
    return this._perc
  }

  _normalizePercentage() {
    if (this._perc < 0) this._perc = 0
    else if (this._perc > 1) this._perc = 1
    else this._perc ||= 0
  }

  toString() {
    let res = this._desc
    if (this._max > 0) {
      res += `\n[${'='.repeat(Math.floor(this._perc * 36)).padEnd(36, ' ')
      }|${Math.floor(this._perc * 100).toString().padStart(3, ' ')
      }%] (${this._progress}/${this._max})`
    }
    if (this._subtask) {
      res += `\n${this._subtask.toString()}`
    }
    return res
  }

}

class MainTask extends Task {
  /** @type {string} */ _name
  _lastRender = 0

  /**
   * @param {string} name 
   */
  constructor(name) {
    super()
    this._name = name
  }

  /**
   * @param {HTMLElement} element 
   * @param {boolean} force 
   */
  async render(element, force = false) {
    if (!force && Date.now() - this._lastRender < 100) return
    super._updatePercentage()
    element.innerText = this.toString()
    // await new Promise(requestAnimationFrame)
    await new Promise(res => setTimeout(res, 0))
    this._lastRender = Date.now()
  }

  toString() {
    return `Task: ${this._name}\n${super.toString()}`
  }

}

class MultiTask extends Task {
  /** @type {Task[]} */ _subtasks = []

  /**
   * @param {number} prog 
   * @param {string} desc 
   */
  async progress(prog = NaN, desc = this._desc) {
    this._desc = desc
    await TaskManager.render(false)
  }

  /**
   * @param {number} prog 
   * @param {string} desc 
   */
  async subtask(prog = NaN, desc = this._desc) {
    const task = await super.subtask(prog, desc)
    this._subtasks.push(task)
    await TaskManager.render(true)
    return task
  }

  /**
   * @param {number} prog 
   * @param {string} desc 
   */
  async subMultiTask(prog = NaN, desc = this._desc) {
    const task = await super.subMultiTask(prog, desc)
    this._subtasks.push(task)
    await TaskManager.render(true)
    return task
  }

  _updatePercentage() {
    this._max = this._subtasks.length
    this._progress = 0
    let chosen = null
    let chosenPerc = 0
    let sum = 0
    for (const task of this._subtasks) {
      const perc = task._updatePercentage()
      if (perc > chosenPerc) {
        chosen = task
        chosenPerc = perc
      }
      sum += perc
      if (perc === 1) this._progress++
    }
    this._subtask = chosen
    this._perc = sum / this._max
    this._normalizePercentage()
    return this._perc
  }

  toString() {
    return `${this._desc
    }\n[${'='.repeat(Math.floor(this._perc * 36)).padEnd(36, ' ')
    }|${Math.floor(this._perc * 100).toString().padStart(3, ' ')
    }%] (${this._progress}/${this._max})${this._subtask ? `\n${this._subtasks.indexOf(this._subtask)}. ${this._subtask.toString()}` : ''}`
  }

}
