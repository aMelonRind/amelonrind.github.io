//@ts-check

class Matrix {
  /** @readonly @type {string} */ divId
  /** @readonly @type {HTMLDivElement} */ div
  /** @readonly @type {boolean} */ hideZero
  /** @type {(data: number[][], matrix: Matrix) => any} */ onChange
  /** @type {(data: number[][], matrix: Matrix) => any} */ validator
  /** @readonly @type {HTMLTextAreaElement} */ padder
  /** @readonly @type {HTMLTextAreaElement} */ collabel
  /** @readonly @type {HTMLTextAreaElement} */ rowlabel
  /** @readonly @type {HTMLTextAreaElement} */ mainArea
  /** @readonly @type {HTMLDivElement} */ message
  /** @type {number} */ colWidth
  /** @type {string[]} */ cols
  /** @type {string[]} */ rows
  /** @type {number[][]} */ data

  /**
   * @param {string} divId 
   * @param {string} description 
   * @param {boolean} readonly 
   * @param {boolean} hideZero 
   * @param {string[]} cols 
   * @param {string[]} rows 
   * @param {(data: number[][], matrix: Matrix) => any} onChange 
   * @param {(data: number[][], matrix: Matrix) => any} validator 
   * @param {number[][]} defaultData 
   */
  constructor(divId, description, readonly, hideZero, cols, rows, onChange = m => {}, validator = m => {}, defaultData = []) {
    this.divId = divId
    this.cols = cols
    this.rows = rows
    this.hideZero = hideZero
    this.onChange = onChange
    this.validator = validator
    this.div = (() => {
      const get = document.getElementById(divId)
      if (get instanceof HTMLDivElement) return get
      console.warn(`div for id ${divId} not found.`)
      const n = document.createElement('div')
      n.id = divId
      return n
    })()
    this.div.innerHTML = ''
    const descDiv = document.createElement('div')
    descDiv.className = 'description'
    descDiv.innerHTML = description
    this.div.append(descDiv)
    this.div.append(this.padder = newTextArea('padder', true))
    this.div.append(this.collabel = newTextArea('matrixlabel collabel', true))
    this.div.append(document.createElement('br'))
    this.div.append(this.rowlabel = newTextArea('matrixlabel rowlabel', true))
    this.div.append(this.mainArea = newTextArea('data', readonly))
    this.div.append(this.message = document.createElement('div'))
    this.message.className = 'matrixMessage'
    this.hideMessage()

    /**
     * @param {string} className 
     * @param {boolean} readonly 
     * @param {string} content 
     * @returns 
     */
    function newTextArea(className, readonly = true, content = '') {
      const e = document.createElement('textarea')
      e.className = className
      e.spellcheck = false
      if (readonly) {
        e.disabled = true
        e.readOnly = true
      }
      e.rows = e.cols = 1
      e.value = content
      return e
    }

    const stored = localStorage.getItem(`${this.divId}:data`)
    this.data = (() => {
      if (stored) try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.every(arr => Array.isArray(arr) && arr.every(v => typeof v === 'number')) && (!hideZero || parsed.some(arr => arr.some(v => v)))) {
          return parsed
        }
      } catch {}
      return defaultData
    })()
    this.write()

    if (!readonly) {
      this.validator(this.data, this)
      this.onChange(this.data, this)
      this.mainArea.onbeforeinput = e => {
        if (!e.data || e.inputType.startsWith('delete')) return
        if (e.data.length === 1) {
          if ('+='.includes(e.data) && this.colWidth < 6) {
            try {
              this.read()
              const value = this.mainArea.value
              const sel = this.mainArea.selectionDirection === 'backward' ? this.mainArea.selectionStart : this.mainArea.selectionEnd
              const row = occurances(value.slice(0, sel), '\n')
              const lineStart = sel === 0 ? 0 : value.lastIndexOf('\n', sel - 1) + 1
              const col = sel - lineStart
              this.colWidth++
              this.write(false)
              const newLineStart = nthOccurance(this.mainArea.value, '\n', row) + 1
              let limit = this.mainArea.value.indexOf('\n', newLineStart)
              if (limit === -1) limit = this.mainArea.value.length
              this.mainArea.selectionStart = this.mainArea.selectionEnd =
                Math.min(limit, newLineStart + col + Math.ceil((col + 1) / (this.colWidth + 1)) + 1)
            } catch (e) {
              this.colWidth++
              const colStr = this.cols.map(v => v.padStart(this.colWidth, ' ')).join(' ')
              this.collabel.cols = this.mainArea.cols = colStr.length + 2
              this.collabel.value = colStr
            }
          }
          if (!'1234567890 '.includes(e.data)) {
            e.preventDefault()
            return
          }

          // // shitty editor code
          // const sel = this.mainArea.selectionDirection === 'backward' ? this.mainArea.selectionStart : this.mainArea.selectionEnd
          // const lines = this.mainArea.value.split('\n')
          // const lineStarts = lines.map(v => v.length)
          // lineStarts.unshift(0)
          // lineStarts.pop()
          // lineStarts.forEach((v, i, a) => a[i] = v + (a[i - 1] ?? -1) + 1)
          // const lineStart = sel === 0 ? 0 : this.mainArea.value.lastIndexOf('\n', sel - 1) + 1
          // const row = lineStarts.indexOf(lineStart)
          // const charCol = sel - lineStart
          // const itemCol = Math.floor(charCol / (this.colWidth + 1))
          // if (e.data === ' ') {
          //   if (row === -1) {
          //     console.warn(`${lineStart} not in [${lineStarts.join(', ')}]`)
          //     return
          //   }
          //   // do space jump
          //   if (itemCol + 1 < this.cols.length) {
          //     // same line
          //     const target = (itemCol + 1) * (this.colWidth + 1)
          //     if (lines[row].length < target) {
          //       lines[row] = lines[row].padEnd(target, ' ')
          //       this.mainArea.value = lines.join('\n')
          //     }
          //     this.mainArea.selectionDirection = 'forward'
          //     this.mainArea.selectionStart = lineStart + target
          //     this.mainArea.selectionEnd = lineStart + Math.min(target + this.colWidth, lines[row].length)
          //     e.preventDefault()
          //     return
          //   } else {
          //     // next line
          //     if (row + 1 >= lineStarts.length) return
          //     this.mainArea.selectionDirection = 'forward'
          //     const start = lineStarts[row + 1]
          //     this.mainArea.selectionStart = start
          //     this.mainArea.selectionEnd = start + Math.min(this.colWidth, lines[row + 1].length)
          //     e.preventDefault()
          //     return
          //   }
          // } else if (this.mainArea.selectionStart === this.mainArea.selectionEnd) {
          //   // colWidth detection
          //   const startCol = itemCol * (this.colWidth + 1)
          //   let cursorOnItem = charCol - startCol
          //   const item = lines[row].slice(startCol, startCol + this.colWidth)
          //   console.log(`${lineStart} ${row} ${charCol} ${itemCol} ${cursorOnItem} "${item}"`)
          //   const isEmpty = !item.trim()
          //   if (isEmpty) {
          //     const dc = Math.max(0, item.length - 1) - cursorOnItem
          //     cursorOnItem += dc
          //     this.mainArea.selectionStart += dc
          //     this.mainArea.selectionEnd += dc
          //   }
          //   if (item.length === this.colWidth) {
          //     if (item.at(-1) === ' ' && cursorOnItem < item.length && (isEmpty || item[cursorOnItem - 1]?.trim())) {
          //       lines[row] = lines[row].slice(0, startCol + item.length - 1) + lines[row].slice(startCol + item.length)
          //       this.mainArea.value = lines.join('\n')
          //       return
          //     }
          //   }
          // }
        } else {
          if (/[^0-9 \r\n]/.test(e.data)) {
            e.preventDefault()
            this.setMessage(`${e.inputType === 'insertFromPaste' ? 'Pasted' : 'Input'} string has illegal character.`, 'red')
            return
          }
          if (this.mainArea.selectionStart === 0 && this.mainArea.selectionEnd === this.mainArea.value.length) {
            // paste width detection
            // could be better, but i'm lazy
            this.colWidth = Math.max(...this.cols.map(v => v.length), ...e.data.split(/[\s\n]+/g).map(v => `${v}`.length))
            this.write(false)
            this.mainArea.value = ''
          }
        }
      }
      this.mainArea.onkeydown = e => {
        if (e.key === 'Enter') {
          if (occurances(this.mainArea.value, '\n') >= this.rows.length - 1) {
            e.preventDefault()
          }
        }
      }
      this.mainArea.onkeyup = e => {
        try {
          this.read()
          // this.hideMessage()
          this.onChange(this.data, this)
        } catch { }
      }
      this.mainArea.onblur = () => {
        try {
          this.read()
          this.hideMessage()
          this.write()
          this.validator(this.data, this)
          this.onChange(this.data, this)
        } catch (e) {
          this.setMessage(e, 'red')
        }
      }
    }
  }

  /**
   * reads data from textarea's content
   * @throws {SyntaxError}
   */
  read() {
    const lines = this.mainArea.value?.split('\n') ?? []
    /** @type {number[][]} */
    const data = []
    for (const [lineNumber, line] of lines.slice(0, this.rows.length).entries()) {
      const arr = []
      data.push(arr)
      let cursor = 0
      while (cursor < line.length) {
        const separator = line[cursor + this.colWidth]
        if (separator && separator !== ' ' && separator !== ',') {
          throw new SyntaxError(`Illegal separator at ${lineNumber + 1}:${cursor + this.colWidth + 1}`)
        }
        const num = Number(line.slice(cursor, cursor + this.colWidth).trim())
        if (isNaN(num)) {
          throw new SyntaxError(`Not a number at ${lineNumber + 1}:${cursor + 1}`)
        }
        arr.push(num)
        if (arr.length >= this.cols.length) break
        cursor += this.colWidth + 1
      }
    }

    this.data = data
    this.normalizeData()
    if (!this.mainArea.readOnly) {
      localStorage.setItem(`${this.divId}:data`, JSON.stringify(this.data))
    }
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

  /**
   * writes data to textarea
   */
  write(updateColWidth = true) {
    this.normalizeData()
    const rowlabelWidth = Math.max(...this.rows.map(s => s.length))
    this.colWidth = Math.max(updateColWidth ? 1 : this.colWidth, ...this.cols.map(v => v.length), ...this.data.flat().map(v => `${v}`.length))
    const colStr = this.cols.map(v => v.padStart(this.colWidth, ' ')).join(' ')

    this.padder.cols = this.rowlabel.cols = rowlabelWidth + 1
    this.collabel.cols = this.mainArea.cols = colStr.length + 2
    this.collabel.value = colStr
    this.rowlabel.rows = this.mainArea.rows = this.rows.length
    this.rowlabel.value = this.rows.map(r => r.padStart(rowlabelWidth, ' ')).join('\n')

    const valueFormatter = (() => {
      if (this.hideZero) {
        const zero = ' '.repeat(this.colWidth)
        return v => v === 0 ? zero : `${v}`.padStart(this.colWidth, ' ')
      }
      return v => `${v}`.padStart(this.colWidth, ' ')
    })()
    this.mainArea.value = this.data.map(col => col.map(valueFormatter).join(' ').trimEnd()).join('\n')
  }

  setMessage(msg = '', color = 'black') {
    this.message.style.color = color
    if (!msg) {
      this.hideMessage()
      return
    }
    this.message.hidden = false
    this.message.innerText = msg
  }

  hideMessage() {
    this.message.hidden = true
  }

}

/**
 * @param {string} str 
 * @param {string} c 
 */
function occurances(str, c) {
  let res = 0, i = 0
  while (i = str.indexOf(c, i) + 1) res++
  return res
}

/**
 * @param {string} str 
 * @param {string} c 
 * @param {number} n
 */
function nthOccurance(str, c, n) {
  let res = -1, i = 0
  while (n-- > 0 && (i = str.indexOf(c, i) + 1)) res = i - 1
  return res
}
