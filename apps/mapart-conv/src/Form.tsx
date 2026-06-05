import { exposeToGlobal } from "../../../lib/util.js";
import paletteImageUrl from "../img/palette.png?url";
import TaskManager from "./TaskManager.ts";
import { Accessor, batch, createEffect, createRoot, createSignal, For, JSX, Setter, Show, untrack } from "solid-js";
import { Portal } from "solid-js/web";
import "./Form.css";
import { TranslationDict, useI18n } from "../i18n.ts";
import { TypedTranslator } from "../../../lib/i18n-base.tsx";

const siteId = 'mapart-conv'

const [formContent, setFormContent] = createSignal<JSX.Element>()
const formActive = () => formContent() !== undefined
const disposeCallbacks: (() => void)[] = []
export let t: TypedTranslator<TranslationDict> = useI18n().t

export const FormLayer = createRoot(dispose => () => {
  const { t: tt } = useI18n()
  t = tt
  createEffect(() => {
    if (formActive()) return
    disposeCallbacks.splice(0, Infinity).forEach(cb => cb())
  })
  return <Portal>
    <Show when={formActive()}>
      <div
        class="form-layer"
        ondragover={e => e.preventDefault()}
        ondrop={e => e.preventDefault()}
        onpaste={e => e.preventDefault()}
      >{formContent()}</div>
    </Show>
  </Portal>
})

exposeToGlobal({ formTest })
function formTest() {
  return Form.send('test', {
    food: {
      type: 'string',
      label: () => 'Fav Food',
      default: 'Apple',
      validator: v => /^apples?$/i.test(v) ? null
        : 'Why is it not apple? long invalid text test test test test test test test...'
    },
    drink: {
      type: 'number',
      storeLast: true,
      label: () => 'Drink Number',
      default: 5
    },
    location: {
      type: 'xy',
      label: () => 'Coordinates',
      default: { x: 2, y: 3 }
    },
    ice: {
      type: 'boolean',
      label: () => 'Ice',
      default: true
    },
    area: {
      type: 'textarea',
      label: () => 'Text Area',
      default: ''
    }
  }, {
    title: () => 'Title',
    description: () => 'The long long long description test test test test test test test test test test test test...',
    // image: 'https://media.misskeyusercontent.jp/io/webpublic-8e1e3bca-9022-42e7-85e0-e9683a4ffc0c.webp',
    image: paletteImageUrl,
    finalValidator: ({ ice }) => ice ? null : 'ice'
  })
}

export default class Form {

  static send<Q extends FormQuery>(
    id: string,
    query: Q,
    { title, description, image, noCancel = false, finalValidator = () => null }: FormOptions<Q> = {}
  ): Promise<FormResult<Q>> {
    if (untrack(formActive)) {
      throw 'Form is already active'
    }
    return (new Promise((res, rej) => {createRoot(dispose => {
      disposeCallbacks.push(dispose)

      const [invalidText, setInvalidText] = createSignal('')
      // todo: setInvalidText('') on input
      const inputs = Object.entries(query).map(([key, item]) => [key, FormItemElement.from(id, item)] as const)

      setFormContent(<div class="form-container">
        {title && <h4>{title()}</h4>}
        {description && <p>{description()}</p>}
        {image && <img src={image}></img>}
        {inputs.map(([, { element: e }]) => e)}
        <div class="form-button-div">
          {inputs.length && <input
            class="form-reset-button"
            type="button"
            value="Reset"
            onclick={() => {
              for (const [, e] of inputs) {
                e.reset()
              }
            }}
          ></input>}
          {!noCancel && <input
            class="form-cancel-button"
            type="button"
            value="Cancel"
            onclick={() => {
              rej(new Error('Form cancelled'))
              close()
            }}
          ></input>}
          <input
            class="form-ok-button"
            type="button"
            value="Ok"
            onclick={() => {
              const passes = inputs.map(([, e]) => e.validate())
              if (passes.some(v => !v)) return
              const obj: FormResult<Q> = Object.fromEntries(inputs.map(([key, e]) => [key, e.get()])) as any
              const err = finalValidator(obj)
              if (err) {
                setInvalidText(err)
              } else {
                setInvalidText('')
                res(obj)
                close()
              }
            }}
          ></input>
        </div>
        <Show when={invalidText()}>
          <div class="form-item-invalid-text">{invalidText()}</div>
        </Show>
      </div>)

      function close() {
        setFormContent()
        TaskManager.taskStart = performance.now()
      }
    })}))
  }

}

class FormItemElement<T> {
  readonly element: JSX.Element
  private readonly setInvalidText: Setter<string | undefined>
  private readonly key: string
  private readonly store: boolean
  private readonly def: T
  private readonly getter: () => T
  private readonly setter: (value: T) => void
  private readonly validator: Validator<T>

  static from<T extends FormItem>(id: string, definition: T): FormItemElement<TypeFromFormItem<T>> {
    const key = `${siteId}:form.${id}.${definition.label().replaceAll(' ', '_')}`
    const ogVali: Validator<any> = definition.validator ?? (() => null)
    let factory: (props: { [attribute: string]: any }) => JSX.Element
    const [getter, setter] = createSignal<any>()
    let validator: Validator<any>
    /** @alias onchange */
    const onc = <T extends HTMLElement>(fn: (e: T) => any) =>
      (e: { currentTarget: T }) => setter(fn(e.currentTarget))
    const oncValue = onc<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(e => e.value)
    const oncValueAsNum = onc<HTMLInputElement>(e => e.valueAsNumber)
    const oncChecked = onc<HTMLInputElement>(e => e.checked)

    switch (definition.type) {
      case 'string':
        factory = props => <input {...props} type="text" value={getter()} onchange={oncValue}></input>;
        validator = v => typeof v !== 'string' ? 'Not a String' : ogVali(v)
        break
      case 'textarea':
        factory = props =>
          <textarea {...props} rows={definition.rows ?? 3} value={getter()} onchange={oncValue}></textarea>;
        validator = v => typeof v !== 'string' ? '?' : ogVali(v)
        break
      case 'number':
        factory = props => <input {...props} type="number" value={getter()} onchange={oncValueAsNum}></input>;
        validator = v => strictIsNaN(v) ? 'Not a Number' : ogVali(v)
        break
      case 'xy':
        const [x, setX] = createSignal(0)
        const [y, setY] = createSignal(0)
        createEffect(() => setter({ x: x(), y: y() }))
        createEffect(() => {
          const { x, y } = getter()
          batch(() => { setX(x); setY(y) })
        })
        factory = props => <div {...props}>
          <input type="number" value={x()} onchange={e => setX(e.currentTarget.valueAsNumber)}></input>
          {','}
          <input type="number" value={y()} onchange={e => setY(e.currentTarget.valueAsNumber)}></input>
        </div>;
        validator = v => strictIsNaN(v.x) ? 'X is not a number' : strictIsNaN(v.y) ? 'Y is not a number' : ogVali(v)
        break
      case 'wh':
        const [w, setW] = createSignal(0)
        const [h, setH] = createSignal(0)
        createEffect(() => setter({ w: w(), h: h() }))
        createEffect(() => {
          const { w, h } = getter()
          batch(() => { setW(w); setH(h) })
        })
        factory = props => <div {...props}>
          <input type="number" value={w()} onchange={e => setW(e.currentTarget.valueAsNumber)}></input>
          {'x'}
          <input type="number" value={h()} onchange={e => setH(e.currentTarget.valueAsNumber)}></input>
        </div>;
        validator = v => strictIsNaN(v.w) ? 'W is not a number' : strictIsNaN(v.h) ? 'H is not a number' : ogVali(v)
        break
      case 'boolean':
        factory = props =>
          <input {...props} type="checkbox" value={definition.label()} checked={getter()} onchange={oncChecked}></input>;
        validator = v => typeof v !== 'boolean' ? '?' : ogVali(v)
        break
      case 'select':
        const opts = definition.options.slice()
        factory = props => <select {...props} value={getter()} onchange={oncValue}>
          <For each={opts}>{opt => <option value={opt}>{opt}</option>}</For>
        </select>;
        validator = v => typeof v !== 'string' ? 'Select an option' : opts.includes(v) ? ogVali(v) : 'Invalid option'
        break
      default:
        throw new Error(`Unknown form element type ${(definition).type}`)
    }
    return new FormItemElement(factory, definition, key, getter, setter, validator) as any
  }

  private constructor(
    ElementFactory: (props: { [attribute: string]: any }) => JSX.Element,
    definition: IFormItem<any>,
    key: string,
    getter: () => T,
    setter: (value: T) => void,
    validator: Validator<T>
  ) {
    if (validator(definition.default)) {
      throw new Error(`${key}'s default value is invalid!`)
    }
    this.key = key
    this.store = definition.storeLast ?? false
    this.def = definition.default
    this.getter = getter
    this.setter = setter
    this.validator = validator

    const [isComplex, setComplex] = createSignal(false)
    const [invalidText, setInvalidText] = createSignal<string>()
    this.setInvalidText = setInvalidText
    this.element = (<>
      <div class="form-item-container">
        <label class="form-item-label" for={key}>{`${definition.label()}:`}</label>
        <ElementFactory
          title={definition.tooltip?.()}
          classList={{
            "form-item-input": true,
            "form-input-complex": isComplex()
          }}
          ref={(e: HTMLElement) => setComplex(e instanceof HTMLDivElement)}
          placeholder={definition.placeholder?.()}
          id={key}
          onblur={() => this.validate()}
        ></ElementFactory>
      </div>
      <Show when={invalidText()}><div class="form-item-invalid-text">{invalidText()}</div></Show>
    </>)
    batch(() => {
      setter(definition.default)
      if (this.store) {
        const last = safeGetLocalStorage<T>(key)
        if (last != null && !validator(last)) {
          setter(last)
        }
      }
    })
  }

  validate() {
    const res = this.validator(this.getter())
    this.setInvalidText(res || undefined)
    return !res
  }

  get() {
    const value = this.getter()
    if (this.validator(value)) {
      throw new Error(`invaid value in ${this.key}. please check the \`validate\` method before calling \`get\`.`)
    }
    if (this.store) {
      localStorage[this.key] = JSON.stringify(value)
    }
    return value
  }

  reset() {
    this.setter(this.def)
    this.validate()
  }

}

function safeGetLocalStorage<T = unknown>(key: string): T | null | undefined {
  try {
    const raw = localStorage[key]
    return raw ? JSON.parse(raw) : undefined
  } catch {}
  return null
}

function strictIsNaN(n: any): boolean {
  return typeof n !== 'number' || isNaN(n)
}

export type FormOptions<Q extends FormQuery> = {
  title?: Accessor<string>
  description?: Accessor<string>
  image?: string
  noCancel?: boolean
  finalValidator?: Validator<FormResult<Q>>
};
export type FormQuery = Record<string, FormItem>;
export type FormResult<T extends FormQuery> = { [K in keyof T]: TypeFromFormItem<T[K]> };
/** return string as a reason of invalid */
export type Validator<T> = (value: T) => string | null | undefined;
type TypeFromFormItem<T extends FormItem> = T extends IFormItem<infer R> ? FormItemTypes[R] : never;

type FormItem =
| IFormItem<'string'>
| IFormItemTextarea
| IFormItem<'number'>
| IFormItem<'xy'>
| IFormItem<'wh'>
| IFormItem<'boolean'>
| IFormItemSelect;

type FormItemTypes = {
  string: string,
  textarea: string,
  number: number,
  xy: { x: number, y: number },
  wh: { w: number, h: number },
  boolean: boolean,
  select: string
};

interface IFormItem<T extends keyof FormItemTypes> {
  type: T;
  storeLast?: boolean;
  default: FormItemTypes[T];
  label: Accessor<string>;
  tooltip?: Accessor<string>;
  placeholder?: Accessor<string>;
  validator?: Validator<FormItemTypes[T]>;
}

interface IFormItemSelect extends IFormItem<'select'> {
  options: string[];
}

interface IFormItemTextarea extends IFormItem<'textarea'> {
  rows?: number
}
