//@ts-check

class ClickableMatrix {
  /** @readonly @type {string} */ divId
  /** @readonly @type {string} */ description
  /** @readonly @type {HTMLDivElement} */ div
  /** @type {(data: number[][], matrix: ClickableMatrix) => any} */ onChange
  /** @type {string[]} */ cols
  /** @type {string[]} */ rows
  /** @type {number[][]} */ data

  /**
   * @param {string} divId 
   * @param {string} description 
   * @param {string[]} cols 
   * @param {string[]} rows 
   * @param {(data: number[][], matrix: ClickableMatrix) => any} onChange 
   */
  constructor(divId, description, cols, rows, onChange = m => {}) {
    this.divId = divId
    this.description = description
    this.cols = cols
    this.rows = rows
    this.onChange = onChange
    this.div = (() => {
      const get = document.getElementById(divId)
      if (get instanceof HTMLDivElement) return get
      console.warn(`div for id ${divId} not found.`)
      const n = document.createElement('div')
      n.id = divId
      return n
    })()

    const stored = localStorage.getItem(`${this.divId}:data`)
    this.data = (() => {
      if (stored) try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.every(arr => Array.isArray(arr) && arr.every(v => typeof v === 'number'))) {
          return parsed
        }
      } catch {}
      return []
    })()

    this.write()
  }

  normalizeData() {
    this.data.length = this.rows.length
    for (let i = 0; i < this.rows.length; i++) {
      const arr = (this.data[i] ||= [])
      arr.length = this.cols.length
      for (let i = 0; i < this.cols.length; i++) {
        arr[i] ||= 0
      }
    }
  }

  write() {
    this.normalizeData()
    this.div.innerHTML = ''
    const descDiv = document.createElement('div')
    descDiv.className = 'description'
    descDiv.innerHTML = this.description
    this.div.append(descDiv)
    const table = document.createElement('table')
    this.div.append(table)
    const reset = document.createElement('button')
    reset.type = 'reset'
    reset.innerHTML = 'Reset'
    reset.onclick = e => {
      if (confirm('Are you sure you want to reset?')) {
        this.data = []
        this.write()
      }
    }
    this.div.append(reset)

    const row = document.createElement('tr')
    table.append(row)
    row.append(document.createElement('td'))
    for (const head of this.cols) {
      const th = document.createElement('th')
      th.innerHTML = head
      row.append(th)
    }

    for (const [i, head] of this.rows.entries()) {
      const row = document.createElement('tr')
      table.append(row)
      const th = document.createElement('th')
      th.innerHTML = head
      row.append(th)

      for (const j in this.cols) {
        const td = document.createElement('td')
        td.innerHTML = `${this.data[i][j]}`
        const update = () => {
          this.onChange(this.data, this)
          td.innerHTML = `${this.data[i][j]}`
          localStorage.setItem(`${this.divId}:data`, JSON.stringify(this.data))
        }
        const add = (n = 1) => this.data[i][j] += n
        const sub = (n = 1) => this.data[i][j] = Math.max(0, this.data[i][j] - n)
        td.onclick = e => {
          if (e.button === 0) {
            add(e.shiftKey ? 10 : 1)
            update()
            e.preventDefault()
          }
        }
        td.oncontextmenu = e => {
          sub(e.shiftKey ? 10 : 1)
          update()
          e.preventDefault()
        }
        td.onselectstart = e => e.preventDefault()
        row.append(td)
      }
    }
  }

}