import { createContext, useContext, createSignal, createResource, ParentComponent, Accessor, Setter, For } from "solid-js";
import { translator, BaseRecordDict } from "@solid-primitives/i18n";

export const localeNames = {
  en_us: 'English',
  zh_tw: '繁體中文'
} as const;

type Locale = keyof typeof localeNames;

/**
 * Creates I18n context.
 * @param en the initial language dict.
 * @param localeGlob the modules imported from ``import.meta.glob(`../locale/${path}/*.json`)``
 * @param storageKey used for localStorage
 * @default 'lang'
 */
export function createI18n<FullDict extends object>(
  en: FullDict,
  localeGlob: Record<string, () => Promise<any>>,
  storageKey = 'lang'
) {
  const base = flatten(en)

  const locales: Record<string, () => Promise<any>> = {}
  for (let key in localeGlob) {
    const loc = key.match(/.*\/(.+)\.json$/)?.[1] ?? ''
    if (!loc || loc in locales || loc === 'list' || loc === 'en_us') {
      continue
    }
    locales[loc] = localeGlob[key]
  }

  const fetchDictionary = async (locale: Locale) => {
    const clone: any = { ...base }
    const dict = await locales[locale]?.()
    if (dict) {
      const flat: any = flatten({ ...dict, default: null })
      for (const key in flat) {
        if (key in clone) {
          clone[key] = flat[key]
        } else if (!key.startsWith('__')) {
          console.warn(`Encountered extra key in locale ${locale}: ${key}`)
        }
      }
    }
    return clone as BaseRecordDict
  }

  const I18nContext = createContext<{
    locale: Accessor<Locale>,
    setLocale: Setter<Locale>,
    t: TypedTranslator<FullDict>
  }>({
    locale: () => 'en_us' as const,
    setLocale: () => {},
    t: translator(() => base) as any as TypedTranslator<FullDict>
  })

  const I18nProvider: ParentComponent = (props) => {
    const [locale, setLocale] = createSignal<Locale>(localStorage[storageKey] ?? 'en_us')
    const [dict] = createResource(locale, fetchDictionary, { initialValue: {} })

    const t = translator(dict) as TypedTranslator<FullDict>

    return <I18nContext.Provider value={{ locale, setLocale, t }}>{props.children}</I18nContext.Provider>
  }

  const useI18n = () => useContext(I18nContext)

  const getAvailableLocales = () => {
    const keys = Object.keys(locales)
    keys.push('en_us')
    return keys.sort()
  }
  const hasLocale = (locale: Locale) => locale=== 'en_us' || (locale in locales)

  const createLangSelect = (onChange?: (locale: Locale) => void) => {
    const { locale, setLocale } = useI18n()
    return <select
      name="Lang"
      id="lang-select"
      style={{
        margin: '16px',
        'margin-bottom': '0px',
        padding: '8px'
      }}
      onchange={e => {
        const v = e.currentTarget.value as any
        if (hasLocale(v) && locale() !== v) {
          localStorage[storageKey] = v
          setLocale(v)
          onChange?.(v)
        }
      }}
    >
      <For each={getAvailableLocales()}>
        {l => <option value={l} selected={locale() === l}>{(localeNames as any)[l] ?? l}</option>}
      </For>
    </select>
  }

  return { I18nProvider, useI18n, hasLocale, getAvailableLocales, createLangSelect }
}

/**
 * Don't like the provided one, so I wrote one myself.  
 * this flatten function produces a new object that only contains path -> string dict.  
 * non-string values are discarded.  
 * input would not be mutated.  
 */
function flatten<T>(input: T, target: { [key: string]: string } = {}, path = ''): Flatten<T> {
  if (typeof input === 'string') {
    target[path] = input
  } else if (typeof input === 'object') {
    const base = path ? path + '.' : ''
    if (Array.isArray(input)) {
      for (let i = 0; i < input.length; i++) {
        flatten(input[i], target, base + i)
      }
    } else {
      for (const key in input) {
        flatten(input[key], target, base + key)
      }
    }
  }
  return target as Flatten<T>
}

type TypedTranslator<Dict, Flat = Flatten<Dict>> =
  <K extends keyof Flat>(key: K, ...args: GetTranslateArgs<Flat[K]>) => string
;


// type Test = TrimString<"   asd   ">;
// type Test2 = ExtractTemplates<"hello {{ name }}, {{name2}}!">;
// type Test3 = GetTranslateArgs<"hello {{ name }}, {{name2}}!">;
type GetTranslateArgs<S> = IsStrictAny<S> extends true ? [args?: any] :
  (S extends string ? { [K in ExtractTemplates<S>]: any } : {}
  ) extends infer U ? [keyof U] extends [never] ? [] : [args: U] : []
;

type ExtractTemplates<S extends string> =
  IsStrictAny<S> extends true ? any :
  S extends `${string}{{${infer A}` ?
  A extends `${infer B}}}${infer C}` ?
    TrimString<B> | ExtractTemplates<C> : never : never;
type TrimString<S> = S extends ` ${infer R}` ? TrimString<R> : S extends `${infer R} ` ? TrimString<R> : S;

// flatten({
//   a: {
//     foo: "foo",
//     b: { bar: "zzz" },
//     n: ['z', 'x', 'c'],
//     discard: [],
//     discard2: 2,
//     discard3: 5n
//   }
// } as const)

// type Test = Flatten<{
//   readonly a: {
//     readonly foo: "foo",
//     readonly b: { readonly bar: "zzz" },
//     readonly n: readonly ['z', 'x', 'c'],
//     readonly discard: readonly string[],
//     readonly discard2: 2,
//     readonly discard3: 5n
//   }
// }>;

type IsStrictAny<T> = 0 | 1 extends (T extends never ? 1 : 0) ? true : false;
type UnionToIntersection<U> = ((U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never
  ) extends infer R ? { [K in keyof R]: R[K] } : never;

export type Flatten<T> = UnionToIntersection<FlattenRecursive<T>>;

type FlattenRecursive<T, P extends string = ''> =
  IsStrictAny<T> extends true ? never : // assert not any
  object extends T ? never : // asset not generic object
  T extends string ? { [K in P]: T } : // emit result
  T extends readonly any[] ? // array
    number extends T['length'] ? never : // assert tuple
    { [K in keyof T] : K extends `${number}` ? K : never }[keyof T] extends infer I ? // extract index
    I extends `${number}` ? // verify index
    { [K in I]: K extends keyof T ?
      FlattenRecursive<T[K], P extends '' ? `${K}` : `${P}.${K}`> // recursive array
      : never
    }[I] : never : never :
  T extends object ? // object
    { [K in keyof T]: K extends string | number
      ? FlattenRecursive<T[K], P extends '' ? `${K}` : `${P}.${K}`> // recursive object
      : never
    }[keyof T]
    : never
;
