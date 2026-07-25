// Provide classes to help building wasm modules & instance them in a separate worker.

// Note that the worker reuses old instance if possible, globals might not be initialized to 0.
// Although the opcode.ts haven't included globals yet.
// Memory are made sure to be 0.

import {
  ExportType,
  flatU8A,
  local,
  section,
  typeToDefinition as type2def,
  TypeToName,
  ValueType,
  ValueTypeName
} from "./opcode.ts";
import { MessageType } from "./worker.ts";
import WasmWorkerInternal from "./worker.ts?worker";

interface FuncDefinition {
  name: string;
  expectedIdx: number;
  params: readonly ValueType[];
  returnType: readonly ValueType[];
  typeHash: string;
}

interface ImportDefinition extends FuncDefinition {
  isCallback: boolean;
}

interface FuncWithBodyDefinition extends FuncDefinition {
  locals: readonly ValueType[];
  body: Uint8Array;
  localNames: readonly string[] | null;
}

/**
 * The args are actually only `number | bigint`s. It was set to any for convenience.
 */
export type ImportFunction = (...args: any[]) => number | bigint | Iterable<number | bigint> | void;

export type WasmLibrary = {
  [name: string]: (postMessage: (value: any) => void) => ImportFunction
}

// setting it to (number | bigint)[] makes it unable to accept (arg: number) => void etc.
// needs a way to make it accept any number or bigint combinations, while rejecting any other type.
// namespace _test {
//   type TypeTest = (...args: (number | bigint)[]) => void;
//   //@ts-expect-error
//   const a: TypeTest = (arg: number) => {}
//   //@ts-expect-error
//   const b: TypeTest = (arg: bigint) => {}
//   //@ts-expect-error
//   const c: TypeTest = (arg0: number, arg1: bigint, arg2: number) => {}
//   //@ts-expect-error should reject this
//   const d: TypeTest = (arg: boolean) => {}
// }

interface Ticket<T = any> {
  then?(value: T): void;
  catch?(error: any): void;
  finally?(): void;
}

interface WorkerListeners {
  /**
   * the listener to receive message from `postMessage(...)` in import code.
   */
  onmessage?: (value: any) => void;
  /**
   * Catches the uncaught error of the worker.
   */
  onerror?: (this: AbstractWorker, ev: ErrorEvent) => any;
}

/**
 * default library available without an importsUrl.
 */
const defaultLibrary: WasmLibrary = {
  log: () => (...args: any[]) => console.log(...args), // void
  warn: () => (...args: any[]) => console.warn(...args), // void
  now: () => () => performance.now(), // f64
  date: () => () => BigInt(Date.now()), // i64
  time: () => () => BigInt(Date.now()), // i64
}

export class WasmBuilder {
  private readonly importUrls = new Set<string>()
  private readonly imports: ImportDefinition[] = []
  private readonly functions: FuncWithBodyDefinition[] = []
  private start: string | number | null = null
  private memoryPages: number = 0

  static clearWorkerPool() {
    pool.clear()
  }

  /**
   * Use `export const imports: WasmLibrary = {}` to define a library.
   * 
   * Use `postMessage(serializableValue)` provided from param for sending data to parent.
   * [Available data formats
   * ](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)  
   */
  importUrl(...url: string[]) {
    for (const u of url) {
      this.importUrls.add(u)
    }
  }

  /**
   * Defines the function imports of this module.
   * 
   * If you're supplying the import object manually, the moduleName are always "m".
   * @param name Name of the function.
   *  Can be in the default library or in any of the specified importUrls.
   *  Can be any name if isCallback == true.
   * @param expectedIdx The expected funcidx of this function.
   * @param params Params of the function, should be written like `i32.type` if constant.
   * @param returnType Return type of the function, should be written like `i32.type` if constant.
   * @param isCallback If the import is a callback.  
   * If true, it can't have a return value in a worker environment, as promises and postMessage are involved.
   */
  import(
    name: string,
    expectedIdx: number,
    params: readonly ValueType[],
    returnType: null | ValueType | readonly ValueType[],
    isCallback = false
  ): this {
    // // should we do this check..?
    // if (code && typeof window.eval(code) !== 'function') {
    //   throw new Error(`the code provided doesn't produce a function!`)
    // }
    if (this.imports.some(d => d.name === name)) {
      throw new Error(`Duplicate import name "${name}"!`)
    }
    returnType = normalizeReturn(returnType)
    const typeHash = toTypeHash(params, returnType)
    this.imports.push({ name, expectedIdx, params, returnType, typeHash, isCallback })
    return this
  }

  /**
   * @param name name of the function, prefix with `#` to avoid exporting.
   * @param expectedIdx the expected funcidx of this function.
   * @param params params of the function, should be written like `i32.type` if constant.
   * @param returnType return type of the function, should be written like `i32.type` if constant.
   * @param body the main body of the function. utilize `flatU8A`.
   * @param locals the locals used by the body, generated from LocalVariables#getTypes.  
   * Although it looks like it will make more sense to be at front of body,
   * this is actually better because LocalVariables can be used directly in the body,
   * without separating the code and this function call.
   * @param localNames the local names generated from LocalVariables#getNames.
   */
  func(
    name: string,
    expectedIdx: number,
    params: readonly ValueType[],
    returnType: null | ValueType | readonly ValueType[],
    body: Uint8Array,
    locals: readonly ValueType[],
    localNames: readonly string[] | null = null
  ): this {
    if (this.functions.some(d => d.name === name)) {
      throw new Error(`Duplicate function name "${name}"!`)
    }
    returnType = normalizeReturn(returnType)
    const typeHash = toTypeHash(params, returnType)
    this.functions.push({ name, expectedIdx, params, returnType, typeHash, locals, body, localNames })
    return this
  }

  /**
   * specifies the start function of this module.
   * 
   * This is unique: only one declaration is allowed.
   * If multiple are specified, the last one will be applied.
   * @param func string for function name or number for funcidx.
   */
  init(func: string | number): this {
    this.start = func
    return this
  }

  /**
   * defines the memory section. should be called after all func declarations unless the size is determined.
   * 
   * This is unique: only one declaration is allowed.
   * If multiple are specified, the last one will be applied.
   * @param pages the size got from MemoryAllocator#getPages.
   */
  memory(pages: number): this {
    this.memoryPages = pages
    return this
  }

  // header, types, imports, func, memory, export, start, code, names
  // header is static.
  // types can be inferred from func.
  // export can be inferred from func if name are given.
  // code is basically body of func.
  // so user should at least provide functions with code,
  // and optionally imports, start, and variable names for debug.
  // memory is size 0 by default.
  /**
   * builds the wasm module bytecode with the informations provided.
   * 
   * exports all functions with name that doesn't start with `#` and memory 0 as `memory`.
   */
  async build(): Promise<WasmModule> {
    this.imports.sort((a, b) => a.expectedIdx - b.expectedIdx)
    this.functions.sort((a, b) => a.expectedIdx - b.expectedIdx)
    const concat = (this.imports as FuncDefinition[]).concat(this.functions)

    // check funcidx mismatch
    const mismatches = concat.filter((d, i) => d.expectedIdx !== i)
    if (mismatches.length) {
      let msg = ''
      let index = 0
      if (this.imports.length) {
        msg += '\nImports:'
        for (const { name, expectedIdx: idx } of this.imports) {
          msg += `\n  ${index} ${index === idx ? '==' : '!='} ${idx} ${name}`
          index++
        }
      }
      if (this.functions.length) {
        msg += '\nFunctions:'
        for (const { name, expectedIdx: idx } of this.functions) {
          msg += `\n  ${index} ${index === idx ? '==' : '!='} ${idx} ${name}`
          index++
        }
      }
      throw new Error(`Unexpected funcidx of ${mismatches.map(d => d.name).join(', ')}:\n${msg.trim()}`)
    }

    // collect types
    const hashToType: { [hash: string]: [params: readonly ValueType[], result: readonly ValueType[]] } = {}
    for (const { typeHash, params, returnType } of concat) {
      hashToType[typeHash] = [params, returnType]
    }
    const types = Object.keys(hashToType).sort()

    // collect exports
    const exports: { [name: string]: [type: ExportType, idx: number] } = {}
    // exports.memory = ['mem', 0]
    for (const d of this.functions) {
      if (d.name[0] === '#') continue
      exports[d.name] = ['func', d.expectedIdx]
    }

    // find init function
    let start = this.start
    if (typeof start === 'string') {
      start = concat.findIndex(d => d.name === start)
      if (start === -1) {
        throw new Error(`Cannot find the init function "${this.start}"`)
      }
    }

    const bytes = flatU8A([
      section.header,
      section.types(types.map(h => hashToType[h]).map(([p, r]) => [Uint8Array.from(p), Uint8Array.from(r)])),
      this.imports.length || this.memoryPages
        ? section.import(this.imports.map(d => ['m', d.name, types.indexOf(d.typeHash)]), this.memoryPages || null)
        : null,
      section.func(this.functions.map(d => types.indexOf(d.typeHash))),
      section.export(exports),
      start != null ? section.start(start) : null,
      section.code(this.functions.map(d => [Uint8Array.from(d.locals), d.body])),
      this.functions.some(d => d.localNames?.length)
        ? section.names(this.functions.map(d => d.localNames ?? []))
        : null
    ])

    const module = await WebAssembly.compile(bytes)

    return new WasmModule(
      bytes,
      module,
      this.memoryPages,
      this.importUrls.values().toArray(),
      this.imports.filter(d => !d.isCallback).map(d => d.name),
      this.imports.filter(d => d.isCallback).map(d => d.name)
    )
  }
}

let currentModuleId = 0

class WasmModule {
  private readonly bytes: Uint8Array<ArrayBuffer>
  readonly module: WebAssembly.Module
  readonly moduleId: number = ++currentModuleId
  private readonly requiredPages: number
  private readonly importUrls: string[]
  private readonly constantImportNames: string[]
  private readonly requiredImportNames: string[]

  constructor(
    bytes: Uint8Array<ArrayBuffer>,
    module: WebAssembly.Module,
    requiredPages: number,
    importUrls: string[],
    constantImportNames: string[],
    requiredImportNames: string[]
  ) {
    this.bytes = bytes
    this.module = module
    this.requiredPages = requiredPages
    this.importUrls = importUrls
    this.constantImportNames = constantImportNames
    this.requiredImportNames = requiredImportNames
  }

  /**
   * Instantiate the wasm module.
   * @param imports Provides necessary import functions. Will override constant imports with the same name.
   */
  async instantiate(
    imports: { [name: string]: ImportFunction } = {},
    memory?: WebAssembly.Memory,
    onmessage: WorkerListeners['onmessage'] = () => {}
  ): Promise<WebAssembly.Instance> {
    if (this.requiredImportNames.some(n => !(n in imports))) {
      const names = this.requiredImportNames.filter(n => !(n in imports))
      throw new Error(`Required imports not provided: ${names.join(', ')}`)
    }

    const fullImport = Object.assign({}, imports)
    const libraries: WasmLibrary[] = await Promise.all(
      this.importUrls.map(url => import(/* @vite-ignore */ url).then(e => e.imports))
    )
    for (const name of this.constantImportNames) {
      if (name in fullImport) continue
      const lib = libraries.find(l => l[name]) ?? defaultLibrary
      if (!lib?.[name]) {
        throw new Error(`Missing import for ${name}.`)
      }
      fullImport[name] = lib[name](onmessage)
    }

    const mem = memory ?? new WebAssembly.Memory({ initial: this.requiredPages })

    return WebAssembly.instantiate(this.module, { m: fullImport, js: { mem } })
  }

  /**
   * Instantiate the wasm module in a worker to offload from render thread.
   * @param imports Provides necessary import functions. Will override constant imports with the same name.
   * Returned value has no effect due to wasm in worker.
   */
  async instantiateWorker(
    imports: { [name: string]: ImportFunction } = {},
    listeners: WorkerListeners = {}
  ): Promise<WasmWorker> {
    if (this.requiredImportNames.some(n => !(n in imports))) {
      const names = this.requiredImportNames.filter(n => !(n in imports))
      throw new Error(`Required imports not provided: ${names.join(', ')}`)
    }

    return await WasmWorker.instantiate(
      this.module,
      this.moduleId,
      this.requiredPages,
      this.importUrls,
      this.constantImportNames,
      imports,
      listeners
    )
  }

  getByteLength() {
    return this.bytes.length
  }

  getBytesCopy() {
    return this.bytes.slice()
  }
}

class ResourcePool {
  private readonly pool = new Set<WorkerResource>()

  acquire(): WorkerHandle {
    for (const res of this.pool) {
      if (res.isIdle()) {
        return res.acquire()
      }
    }
    const res = new WorkerResource(this)
    this.pool.add(res)
    return res.acquire()
  }

  remove(resource: WorkerResource) {
    this.pool.delete(resource)
  }

  clear() {
    for (const resource of [...this.pool]) {
      resource._terminate()
    }
  }
}

let resourceId = 0

class WorkerResource {
  private readonly pool: ResourcePool
  private readonly worker = new WasmWorkerInternal({ name: `Wasm-Worker#${++resourceId}` })
  private busy = false
  private sentCleanupRequest = false
  private cleanupId = 0n
  private currentHandle: WeakRef<WorkerHandle> | null = null

  constructor(pool: ResourcePool) {
    this.pool = pool
    this.worker.onmessage = ({data}) => {
      switch (data.type) {
        case MessageType.CLEANUP:
          this.cleanupId++
          this.busy = false
          this.sentCleanupRequest = false
          break
        case MessageType.MESSAGE:
          this.currentHandle?.deref()?.onmessage?.(data.msg)
          break
      }
    }
    this.worker.onerror = e => this.currentHandle?.deref()?.onerror?.bind(this.worker)(e)
    this.worker.onmessageerror = e => this.currentHandle?.deref()?.onmessageerror?.bind(this.worker)(e)
  }

  isIdle(): boolean {
    if (this.currentHandle?.deref()) return false
    if (this.busy) {
      this.cleanup()
      return false
    } else {
      return true
    }
  }

  acquire(): WorkerHandle {
    if (!this.isIdle()) {
      throw new Error(`Attempting to create handle while occupied`)
    }
    const handle = new WorkerHandle(this)
    this.currentHandle = new WeakRef(handle)
    this.busy = true
    this.sentCleanupRequest = false
    return handle
  }

  private checkHandle(handle: WorkerHandle) {
    if (!this.checkHandleSilent(handle)) {
      throw new Error('handle expired')
    }
  }

  private checkHandleSilent(handle: WorkerHandle) {
    return handle === this.currentHandle?.deref()
  }

  postMessage(handle: WorkerHandle, msg: any) {
    this.checkHandle(handle)
    this.worker.postMessage({ type: MessageType.MESSAGE, msg })
  }

  release(handle: WorkerHandle) {
    if (this.checkHandleSilent(handle)) {
      this.cleanup()
    }
  }

  private cleanup() {
    this.currentHandle = null
    if (!this.sentCleanupRequest) {
      this.worker.postMessage({ type: MessageType.CLEANUP })
      this.sentCleanupRequest = true

      const id = this.cleanupId
      setTimeout(() => {
        if (this.cleanupId === id) {
          this._terminate()
        }
      }, 5000)
    }
  }

  terminate(handle: WorkerHandle) {
    this.checkHandle(handle)
    this._terminate()
  }

  _terminate() {
    this.pool.remove(this)
    this.worker.terminate()
  }
}

class WorkerHandle {
  private readonly resource: WorkerResource
  onmessage: ((msg: any) => void) | null = null
  onerror: ((this: AbstractWorker, ev: ErrorEvent) => any) | null = null
  onmessageerror: ((this: Worker, ev: MessageEvent<any>) => any) | null = null

  constructor(resource: WorkerResource) {
    this.resource = resource
  }

  postMessage(msg: any) {
    this.resource.postMessage(this, msg)
  }

  release() {
    this.resource.release(this)
  }

  terminate() {
    this.resource.terminate(this)
  }
}

const pool = new ResourcePool()

let instantiateLagWarned = false

class WasmWorker {
  private readonly worker: WorkerHandle
  private readonly tickets: Tickets
  private stopped = false

  static async instantiate(
    module: WebAssembly.Module,
    moduleId: number,
    requiredPages: number,
    importsUrls: string[],
    imports: string[],
    proxiedImports: { [name: string]: ImportFunction },
    listeners: WorkerListeners = {}
  ): Promise<WasmWorker> {
    const importIndex = Object.entries(proxiedImports)
    const worker = pool.acquire()
    const tickets = new Tickets()

    worker.onmessage = data => {
      switch (data.type) {
        case MessageType.POST_MESSAGE:
          listeners.onmessage?.(data.value)
          break
        case MessageType.INVOKE_IMPORT:
          //@ts-ignore
          importIndex[data.index][1](...data.args)
          break
        case MessageType.RESOLVE_TICKET:
          tickets.resolve(data.ticket, data.value)
          break
        case MessageType.REJECT_TICKET:
          tickets.reject(data.ticket, data.err)
          break
      }
    }
    worker.onerror = listeners.onerror ?? null

    const start = performance.now()
    let done = false
    return new Promise(res => {
      tickets.drawPromise(ticket => worker.postMessage({
        type: MessageType.INIT,
        ticket,
        module,
        moduleId,
        requiredPages,
        importsUrls,
        imports,
        proxiedImports: importIndex.map(([k]) => k)
      })).then(() => {
        if (done) return
        done = true

        let instantiateTime: number
        if (!instantiateLagWarned && (instantiateTime = performance.now() - start) > 500) {
          console.warn(`Worker instantiate time has exceeded 500ms. (${instantiateTime.toFixed(1)}ms)`)
          instantiateLagWarned = true
        }
    
        res(new WasmWorker(worker, tickets))
      }).catch(e => {
        done = true
        throw e
      })

      setTimeout(() => {
        if (done) return
        done = true

        console.warn('Worker instantiate time has exceeded 5000ms. Retrying...')
        worker.terminate()
        WasmWorker.instantiate(
          module,
          moduleId,
          requiredPages,
          importsUrls,
          imports,
          proxiedImports,
          listeners
        ).then(ww => res(ww))
      }, 5000)
    })
  }

  constructor(worker: WorkerHandle, tickets: Tickets) {
    this.worker = worker
    this.tickets = tickets
  }

  getMemoryLength(): Promise<number> {
    return this.tickets.drawPromise(
      ticket => this.worker.postMessage({ type: MessageType.GET_MEMORY_LENGTH, ticket })
    )
  }

  /**
   * Gets a section of the wasm memory.
   */
  getMemory(start: number, length: number): Promise<Uint8Array> {
    start = Math.floor(start)
    length = Math.floor(length)
    if (start < 0) {
      throw new Error(`Range out of bounds. (start(${start}) < 0)`)
    }
    if (length < 1) {
      if (length === 0) {
        return Promise.resolve(new Uint8Array(0))
      }
      throw new Error(`Range out of bounds. (length(${length}) < 0)`)
    }
    return this.tickets.drawPromise(
      ticket => this.worker.postMessage({ type: MessageType.GET_MEMORY, ticket, start, length })
    ).then(v => Uint8Array.from(v))
  }

  /**
   * Sets a section of the wasm memory with provided array.
   * @param content the content of the memory. will be transferred, use `.slice()` to prevent detach.
   * @param start the starting address for the write.
   * @returns nothing on success, reject on error.
   */
  setMemory(content: Uint8Array, offset: number = 0): Promise<void> {
    const start = Math.floor(offset)
    if (start < 0) {
      throw new Error(`Range out of bounds. (start(${start}) < 0)`)
    }
    return this.tickets.drawPromise(
      ticket => this.worker.postMessage({ type: MessageType.SET_MEMORY, ticket, start, content })
    )
  }

  /**
   * Invokes a function exported by the wasm module.
   */
  invoke(func: string, ...args: (number | bigint)[]): Promise<number | bigint | (number | bigint)[] | void> {
    return this.tickets.drawPromise(
      ticket => this.worker.postMessage({ type: MessageType.INVOKE, ticket, func, args })
    )
  }

  /**
   * Checks if there's no currently running task.
   */
  isTicketsEmpty() {
    return this.tickets.isEmpty()
  }

  release() {
    this.worker.release()
    this.stopped = true
    this.tickets.rejectAll(() => new Error('Worker released'))
  }

  terminate() {
    this.worker.terminate()
    this.stopped = true
    this.tickets.rejectAll(() => new Error('Worker terminated'))
  }

  isStopped() {
    return this.stopped
  }
}

class Tickets<T = any> {
  private serial = 0
  private readonly tickets: { [ticket: number]: Ticket<T> } = {}

  /**
   * @returns serial number
   */
  draw(ticket: Ticket): number {
    this.tickets[this.serial] = ticket
    return this.serial++
  }

  drawPromise<T = any>(
    action: (ticket: number) => void,
    valueMapper?: (value: any) => T,
    errorMapper?: (err: any) => any,
    finalizer?: () => void
  ): Promise<T> {
    return new Promise((res, rej) => {
      const ticket = this.draw({
        then: value => res(valueMapper ? valueMapper(value) : value),
        catch: err => rej(errorMapper ? errorMapper(err) : err),
        finally: finalizer
      })
      action(ticket)
    })
  }

  resolve(serial: number, value: T) {
    const ticket = this.tickets[serial]
    delete this.tickets[serial]
    if (!ticket) return
    ticket.then?.(value)
    ticket.finally?.()
  }

  reject(serial: number, error: any) {
    const ticket = this.tickets[serial]
    delete this.tickets[serial]
    if (!ticket) return
    ticket.catch?.(error)
    ticket.finally?.()
  }

  rejectAll(lazyErrorFactory: () => any) {
    let error = null
    for (const serial of Object.keys(this.tickets)) {
      this.reject(Number(serial), error ??= lazyErrorFactory())
    }
  }

  isEmpty() {
    for (const key in this.tickets) {
      return false
    }
    return true
  }
}

export class MemoryAllocator {
  private size: number = 0
  private readonly purposes: string[] = []

  /**
   * @param size size of the required memory in bytes
   * @param align alignment of the pointer, should be the bytewidth of the elements.
   * @param purpose the purpose of this range for debug.
   * @return ptr
   */
  allocate(size: number, align: number, purpose = ''): number {
    const ptr = Math.ceil(this.size / align) * align
    this.size = ptr + size
    this.purposes.push(`(${toHex32(ptr)} .. ${toHex32(ptr + size - 1)}): ${purpose || 'unspecified'}`)
    return ptr
  }

  getSize() {
    return this.size
  }

  getPages() {
    return Math.ceil(this.size / 65536) || 1
  }

  /**
   * Get memory purposes for debug.
   */
  getPurposes() {
    return this.purposes.join('\n')
  }
}

function toHex32(n: number) {
  const raw = n.toString(16).toUpperCase()
  return `0x${raw.padStart(Math.max(raw.length + (raw.length & 1), 8), '0')}`
}

export class LocalVariables {
  private readonly paramTypes: ValueType[] = []
  private readonly types: ValueType[] = []
  private readonly names: string[] = []
  private readonly existing: Record<string, Variable<any>> = {}

  /**
   * @param type the type of the variable, should be written like `i32.type` if constant.
   * @param name the name of the variable. can be used to reference existing variable.
   *  empty name or names starts with `#` will not be referenced and will create new one on each call.
   */
  get<T extends ValueType>(type: T, name: string = ''): Variable<TypeToName<T>> {
    const ref = this.existing[name]
    if (ref) {
      if (ref.type !== type) {
        throw new Error(`Attempt to get ${type2def[ref.type].name} ${name} as type ${type2def[type].name}.`)
      }
      return ref
    }
    const v = new Variable(this.names.length, type, name)
    this.types.push(type)
    this.names.push(name)
    if (name && name[0] !== '#') {
      this.existing[name] = v
    }
    return v
  }

  /**
   * @param type the type of the parameter, should be written like `i32.type` if constant.
   * @param name the name of the parameter. cannot duplicate existing name.
   */
  defineParameter<T extends ValueType>(type: T, name: string = ''): Variable<TypeToName<T>> {
    if (this.types.length) {
      throw new Error(`Parameters should be defined before any local declarations.`)
    }
    if (this.existing[name]) {
      throw new Error(`Duplicate parameter name "${name}".`)
    }
    const v = new Variable(this.names.length, type, name)
    this.paramTypes.push(type)
    this.names.push(name)
    if (name && name[0] !== '#') {
      this.existing[name] = v
    }
    return v
  }

  /**
   * @returns a params array for `builder.func`.
   */
  getParamTypes() {
    return this.paramTypes.slice()
  }

  /**
   * @returns a locals array for `builder.func`.
   */
  getTypes() {
    return this.types.slice()
  }

  /**
   * @returns a names array for `section.names`.
   */
  getNames(): readonly string[] {
    return this.names
  }

  /**
   * Construct the current names as `section.names`.
   * Only applicable when there's only one function.
   */
  toNamesSection() {
    return section.names([this.names])
  }
}

export class Variable<T extends ValueTypeName> {
  /**
   * The [localidx](https://webassembly.github.io/spec/core/syntax/modules.html#syntax-localidx)
   * this variable holds.
   */
  readonly idx: number
  readonly type: ValueType
  readonly name: string
  /**
   * This instruction gets the value of this variable.
   * 
   * Stack: [] → [T]
   * @see local.get
   */
  readonly get: Uint8Array
  /**
   * This instruction sets the value of this variable.
   * 
   * Stack: [T] → []
   * @see local.set
   */
  readonly set: Uint8Array
  /**
   * The local.tee instruction is like local.set but also returns its argument.
   * 
   * Stack: [T] → [T]
   * @see local.tee
   */
  readonly tee: Uint8Array

  constructor(idx: number, type: ValueType, name: string) {
    this.idx = idx
    this.type = type
    this.name = name
    this.get = local.get(idx)
    this.set = local.set(idx)
    this.tee = local.tee(idx)
  }
}

function normalizeReturn(returnType: null | ValueType | readonly ValueType[]): readonly ValueType[] {
  if (returnType == null) {
    return []
  } else if (typeof returnType === 'number') {
    return [returnType]
  } else {
    return returnType
  }
}

function toTypeHash(params: readonly ValueType[], returnType: readonly ValueType[]): string {
  return String.fromCharCode(...params, 0, ...returnType)
}

export type { WasmModule, WasmWorker }
