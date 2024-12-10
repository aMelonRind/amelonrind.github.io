//@ts-check
/// <reference path = "../index.d.ts"/>

const formLayer = document.createElement('div')
formLayer.classList.add('formLayer')
formLayer.style.display = 'none'
if (document.body) {
  document.body.append(formLayer)
} else {
  document.addEventListener('DOMContentLoaded', () => {
    document.body.append(formLayer)
  })
}

function formTest() {
  return Form.ask('test', {
    food: {
      type: 'string',
      label: 'Fav Food',
      default: 'Apple',
      validator: v => v.toLowerCase() === 'apple' ? null : 'Why is it not apple? long invalid text test test test test test test test...'
    },
    drink: {
      type: 'number',
      storeLast: true,
      label: 'Drink Number',
      default: 5
    },
    location: {
      type: 'xy',
      label: 'Coordinates',
      default: { x: 2, y: 3 }
    },
    ice: {
      type: 'boolean',
      label: 'Ice',
      default: true
    },
    area: {
      type: 'textarea',
      label: 'Text Area',
      default: ''
    }
  }, {
    title: 'Title',
    description: 'The long long long description test test test test test test test test test test test test...',
    image: 'https://media.misskeyusercontent.jp/io/webpublic-8e1e3bca-9022-42e7-85e0-e9683a4ffc0c.webp'
  })
}

class Form {

  /**
   * @template {FormQuery} Q
   * @param {string} id 
   * @param {Q} query 
   * @param {{ title?: string, description?: string, image?: string }} [desc] 
   * @returns {Promise<FormResult<Q>>}
   */
  static ask(id, query, { title, description, image } = {}) {
    return new Promise((res, rej) => {
      const elements = Object.entries(query).map(
        /** @type {(ent: [key: string, item: FormItem]) => [key: string, element: FormItemElement<>]} */
        ([key, item]) => [key, FormItemElement.from(id, item)]
      )
      const div = document.createElement('div')
      div.classList.add('formContainer')
      if (title) {
        const h4 = document.createElement('h4')
        h4.innerText = title
        div.append(h4)
      }
      if (description) {
        const p = document.createElement('p')
        p.innerText = description
        div.append(p)
      }
      if (image) {
        const img = document.createElement('img')
        img.src = image
        div.append(img)
      }
      for (const [, { container, invalidText }] of elements) {
        div.append(container, invalidText)
      }
      /**
       * @param {string} name 
       */
      function btn(name) {
        const b = document.createElement('input')
        b.classList.add(`form${name}Button`)
        b.type = 'button'
        b.value = name
        return b
      }
      const resetBtn = btn('Reset')
      const cancelBtn = btn('Cancel')
      const okBtn = btn('Ok')
      resetBtn.onclick = () => {
        for (const [, e] of elements) {
          e.reset()
        }
      }
      cancelBtn.onclick = () => {
        rej(new Error('Form cancelled'))
        close()
      }
      okBtn.onclick = () => {
        const passes = elements.map(([, e]) => e.validate())
        if (passes.some(v => !v)) return
        //@ts-ignore
        res(Object.fromEntries(elements.map(([key, e]) => [key, e.get()])))
        close()
      }
      const formButtonDiv = document.createElement('div')
      formButtonDiv.classList.add('formButtonDiv')
      formButtonDiv.append(resetBtn, cancelBtn, okBtn)
      div.append(formButtonDiv)
      formLayer.innerHTML = ''
      formLayer.append(div)
      formLayer.style.display = ''

      function close() {
        formLayer.innerHTML = ''
        formLayer.style.display = 'none'
      }
    })
  }

}

/**
 * @template T 
 */
class FormItemElement {
  /** @readonly @type {HTMLDivElement} */ container
  /** @readonly @type {HTMLDivElement} */ invalidText
  /** @readonly @type {string} */ #key
  /** @readonly @type {boolean} */ #store
  /** @readonly @type {T} */ #def
  /** @readonly @type {() => T} */ #getter
  /** @readonly @type {(value: T) => void} */ #setter
  /** @readonly @type {Validator<T>} */ #validator

  /**
   * @template {FormItem} T 
   * @param {string} id 
   * @param {T} definition 
   * @returns {FormItemElement<TypeFromFormItem<T>>}
   */
  static from(id, definition) {
    const key = `form.${id}.${definition.label.replaceAll(' ', '_')}`
    /** @type {Validator<*>} */
    const ogVali = definition.validator ?? (() => null)
    switch (definition.type) {
      case 'string':
        const strInput = document.createElement('input')
        strInput.type = 'text'
        //@ts-ignore
        return new FormItemElement(
          strInput, definition, key,
          () => strInput.value,
          v => strInput.value = v,
          v => typeof v !== 'string' ? 'Not a String' : ogVali(v)
        )
      case 'textarea':
        const taInput = document.createElement('textarea')
        taInput.rows = definition.rows ?? 3
        //@ts-ignore
        return new FormItemElement(
          taInput, definition, key,
          () => taInput.value,
          v => taInput.value = v,
          v => typeof v !== 'string' ? '?' : ogVali(v)
        )
      case 'number':
        const numInput = document.createElement('input')
        numInput.type = 'number'
        //@ts-ignore
        return new FormItemElement(
          numInput, definition, key,
          () => numInput.valueAsNumber,
          v => numInput.valueAsNumber = v,
          v => strictIsNaN(v) ? 'Not a number' : ogVali(v)
        )
      case 'xy':
        const xyDiv = document.createElement('div')
        const xInput = document.createElement('input')
        const yInput = document.createElement('input')
        xInput.type = 'number'
        yInput.type = 'number'
        xyDiv.append(xInput, ',', yInput)
        //@ts-ignore
        return new FormItemElement(
          xyDiv, definition, key,
          () => ({ x: xInput.valueAsNumber, y: yInput.valueAsNumber }),
          v => {
            xInput.valueAsNumber = v.x
            yInput.valueAsNumber = v.y
          },
          v => strictIsNaN(v.x) ? 'X is not a number' : strictIsNaN(v.y) ? 'Y is not a number' : ogVali(v)
        )
      case 'wh':
        const whDiv = document.createElement('div')
        const wInput = document.createElement('input')
        const hInput = document.createElement('input')
        wInput.type = 'number'
        hInput.type = 'number'
        whDiv.append(wInput, 'x', hInput)
        //@ts-ignore
        return new FormItemElement(
          whDiv, definition, key,
          () => ({ w: wInput.valueAsNumber, h: hInput.valueAsNumber }),
          v => {
            wInput.valueAsNumber = v.w
            hInput.valueAsNumber = v.h
          },
          v => strictIsNaN(v.w) ? 'W is not a number' : strictIsNaN(v.h) ? 'H is not a number' : ogVali(v)
        )
      case 'boolean':
        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.value = definition.label
        //@ts-ignore
        return new FormItemElement(
          checkbox, definition, key,
          () => checkbox.checked,
          v => checkbox.checked = v,
          v => typeof v !== 'boolean' ? '?' : ogVali(v)
        )
      case 'select':
        const select = document.createElement('select')
        const opts = definition.options.slice()
        for (const opt of opts) {
          const res = document.createElement('option')
          res.value = opt
          res.innerText = opt
          select.options.add(res)
        }
        //@ts-ignore
        return new FormItemElement(
          select, definition, key,
          () => select.value,
          v => select.value = v,
          v => typeof v !== 'string' ? 'Select an option' : opts.includes(v) ? ogVali(v) : 'Invalid option'
        )
    }
  }

  /**
   * @param {HTMLElement} inputElement 
   * @param {IFormItem<any>} definition 
   * @param {string} key 
   * @param {() => T} getter 
   * @param {(value: T) => void} setter 
   * @param {Validator<T>} validator 
   */
  constructor(inputElement, definition, key, getter, setter, validator) {
    if (validator(definition.default) != null) {
      throw new Error(`${key}'s default value is invalid!`)
    }
    this.#key = key
    this.#store = definition.storeLast ?? false
    this.#def = definition.default
    this.#getter = getter
    this.#setter = setter
    this.#validator = validator
    const div = document.createElement('div')
    this.container = div
    div.classList.add('formItemContainer')
    const label = document.createElement('label')
    label.classList.add('formItemLabel')
    label.htmlFor = key
    label.innerText = `${definition.label}:`
    if (definition.title != null) {
      inputElement.title = definition.title
    }
    inputElement.classList.add('formItemInput')
    inputElement.id = key
    const invalidText = document.createElement('div')
    this.invalidText = invalidText
    invalidText.classList.add('formItemInvalidText')
    div.append(label, inputElement)

    if (definition.placeholder && ('placeholder' in inputElement) && typeof inputElement.placeholder === 'string') {
      inputElement.placeholder = definition.placeholder
    }
    if (inputElement instanceof HTMLDivElement) {
      inputElement.classList.add('formInputComplex')
    }
    inputElement.onblur = () => {
      this.validate()
    }
    setter(definition.default)
    if (this.#store) {
      const last = safeGetLocalStorage(key)
      if (last != null && validator(last) == null) {
        setter(last)
      }
    }
  }

  validate() {
    const res = this.#validator(this.#getter())
    if (!res) {
      this.invalidText.innerText = ''
      return true
    } else {
      this.invalidText.innerText = res
      return false
    }
  }

  get() {
    const value = this.#getter()
    if (this.#validator(value)) {
      throw new Error(`invaid value in ${this.#key}. please check the \`validate\` method before calling \`get\`.`)
    }
    if (this.#store) {
      localStorage.setItem(this.#key, JSON.stringify(value))
    }
    return value
  }

  reset() {
    this.#setter(this.#def)
  }

}

/**
 * @param {string} key 
 * @returns {any}
 */
function safeGetLocalStorage(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : undefined
  } catch {}
  return null
}

/**
 * @param {*} n 
 * @returns {boolean}
 */
function strictIsNaN(n) {
  return typeof n !== 'number' || isNaN(n)
}
