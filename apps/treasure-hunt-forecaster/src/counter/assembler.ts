// this file can dynamically generate wasm module based on inputs
import { control_flow as cf, i32, i64, flatU8A, ValueType } from "../../../../lib/wasm/opcode.ts";
import { LocalVariables, MemoryAllocator, Variable, WasmBuilder, WasmModule } from "../../../../lib/wasm/tool.ts";
import { requireNonNull } from "../../../../lib/util.ts";
import { addToCounts } from "./board95util.ts";

const num2alphabet = 'ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqponmlkjihgfedcba'

export interface PlacementsAndAmount {
  readonly placements: BigUint64Array;
  readonly lengthHint: number;
  readonly amount: number;
}

interface BuildResult {
  module: WasmModule;
  ctx: BuildContext;
}

const buildCache: { [key: string]: BuildResult } = {}

export async function assemble(
  input: readonly PlacementsAndAmount[],
  progressListener?: (progress: number, total: number) => void,
  debug = false
) {
  // build 
  const { module, ctx } = await buildModule(input, !!progressListener)
  if (debug) {
    console.log(`module size: ${module.getByteLength()} bytes`)
    console.log(`memory size: ${ctx.memories.getSize()} bytes`)
    console.log(ctx.memories.getPurposes())
  }

  let dry = true
  let progressValid = false
  let progressCount = -1
  let progress = 0

  // instantiate
  const worker = await module.instantiateWorker(ctx.withProgressReport ? {
    progress: () => {
      if (dry) {
        progressCount++
      } else if (progressValid) {
        progressListener?.(progress++, progressCount)
      }
    }
  } : undefined)


  let ran: Promise<{ total: bigint, count: BigUint64Array<ArrayBuffer>[] }> | null = null

  const pRev = input.map(v => v.placements.slice()).reverse()

  return {
    terminate: () => worker.terminate(),
    run: () => ran ??= (async () => {
      const memlen = ctx.memories.getSize()

      // insert memory
      const inmem = new Uint8Array(memlen)
      const view = new DataView(inmem.buffer)
      for (let item = 0; item < pRev.length; item++) {
        const arrPtr = ctx.pass!.arrPtrsRev[item]
        const countPtr = ctx.countArrsRev[item]
        const placements = pRev[item]
        for (let i = 0; i < placements.length; i++) {
          view.setBigUint64(arrPtr + i * 12, placements[i], true)
          view.setUint32(arrPtr + i * 12 + i64.size, countPtr + i * 8, true)
        }
        view.setUint32(ctx.initLengthsPtr + item * i32.size, arrPtr + placements.length * 12, true)
      }

      // dry run for progress
      if (ctx.withProgressReport) {
        await worker.setMemory(inmem.slice())
        await worker.invoke('main', 1)
        dry = false
        if (progressCount > 0) {
          progressValid = true
        } else {
          progressListener?.(0, 1)
        }
      }

      // run
      await worker.setMemory(inmem)
      const total = await worker.invoke('main', 0) as bigint

      // extract memory
      const outmem = await worker.getMemory(0, memlen)
      worker.release()
      const outview = new DataView(outmem.buffer)
      const countsRev = []
      for (let item = 0; item < pRev.length; item++) {
        const countPtr = ctx.countArrsRev[item]
        const placements = pRev[item]
        const res = new BigUint64Array(45)
        for (let i = 0; i < placements.length; i++) {
          addToCounts(res, placements[i], outview.getBigUint64(countPtr + i * 8, true))
        }
        countsRev.push(res)
      }

      return { total, count: countsRev.reverse() }
    })().finally(() => worker.release())
  }
}

async function buildModule(input: readonly PlacementsAndAmount[], withProgressReport: boolean): Promise<BuildResult> {
  if (input.length === 1 && input[0].amount === 1) {
    throw new Error('too shallow')
  }

  const ctx = new BuildContext(input, withProgressReport)
  if (!ctx.placements.every((p, i) => p.length >= ctx.items[i].amount)) {
    throw new Error('invalid length')
  }

  const cacheKey = `${ctx.maxedLengths.join(',')}/${input.map(v => v.amount).join(',')}/${+withProgressReport}`

  const cache = buildCache[cacheKey]
  if (cache) {
    return cache
  }

  const builder = new WasmBuilder()
  const mainParams: ValueType[] = []
  let mainidx = 0
  if (ctx.withProgressReport) {
    mainidx = 1
    builder.import('progress', 0, [], null)
    ctx.locals.defineParameter(i32.type, 'dry')
    mainParams.push(i32.type)
  }

  const { code } = ctx.pass = generatePass(
    ctx,
    Uint8Array.from(ctx.itemsRev, v => v.amount),
    Uint8Array.from(ctx.placementsRev, v => v.length),
    0,
    num2alphabet.slice(-ctx.items.length)
  )
  const mainBody = flatU8A([code, cf.end])
  const module = await builder
    .func(
      'main',
      mainidx,
      ctx.locals.getParamTypes(),
      i64.type,
      mainBody,
      ctx.locals.getTypes(),
      ctx.locals.getNames()
    )
    .memory(ctx.memories.getPages())
    .build()
  
  return buildCache[cacheKey] = { module, ctx }
}

interface Pass {
  code: Uint8Array,
  count: Variable<'i64'>,
  board: Variable<'i64'>,
  arrPtrsRev: number[],
  endVarsRev: Variable<'i32'>[]
}

/**
 * Stack: [] -> [i64]
 */
function generatePass(
  ctx: BuildContext,
  leftsRev: Uint8Array,
  lensRev: Uint8Array,
  depth: number,
  itemCharsRev: string
): Pass {
  const curr = leftsRev.length - 1
  let nextLeftsRev = leftsRev.slice()
  nextLeftsRev[curr] -= 1
  if (nextLeftsRev[curr] >= 45) throw 'invalid left count'
  const nextItem = nextLeftsRev[curr] === 0
  if (nextItem) {
    nextLeftsRev = nextLeftsRev.slice(0, -1)
  }
  const nextLensRev = lensRev.subarray(0, nextLeftsRev.length)
    // this is buggy, don't reduce array length for now
    // .map((v, i) => doFilter || i < curr - 1 ? v - containAmount(w, h, ctx.itemsRev[i][0], ctx.itemsRev[i][1]) : v)

  let pass: Pass
  if (nextLeftsRev.length === 1 && nextLeftsRev[0] === 1) {
    pass = generateLast(ctx, nextLensRev[0], depth + 1, itemCharsRev[0])
  } else {
    pass = generatePass(ctx, nextLeftsRev, nextLensRev, depth + 1, itemCharsRev)
  }
  const {
    code: nextCode,
    count: nextCount,
    board: nextBoard,
    arrPtrsRev: nextArrPtrsRevRaw,
    endVarsRev: nextEndVarsRev
  } = pass
  const nextArrPtrsRev = wrapArrPtrArray(nextArrPtrsRevRaw)

  const board = depth ? ctx.locals.get(i64.type, `board${depth}`) : null
  const count = ctx.locals.get(i64.type, `count${depth}`)
  const ptr = nextItem ? ctx.getTPtrVar() : ctx.locals.get(i32.type, `ptr${depth}`)
  const idx = ctx.locals.get(i32.type, `idx${depth}`)
  const endVars: Variable<"i32">[] = depth ? Array.from(leftsRev, (_, i) => !nextItem || i !== curr - 1
    ? ctx.locals.get(i32.type, `${itemCharsRev[i]}end${depth}`)
    : requireNonNull(nextEndVarsRev[i])
  ) : []
  const arrPtrs = Array.from(lensRev, (len, i) => !nextItem || i !== curr - 1
    ? ctx.allocateContextArr(i, depth)
    : nextArrPtrsRev(i)
  )
  if (nextItem) {
    ctx.allocateCountArr(curr)
  }
  if (!depth) {
    ctx.allocateInitLengths()
  }
  // since placements are already filtered, there's no need to use ctx.mainBoard
  const boardGetter = board?.get ?? i64.const(0)
  const nextCurr = nextItem ? curr - 1 : curr

  const code = flatU8A([
    // initialize array lengths
    !depth && Array.from({ length: leftsRev.length - 1 }, (_, item) => [
      i32.const(ctx.initLengthsPtr + item * i32.size),
      i32.load(),
      nextEndVarsRev[item].set
    ]),
    // reset count
    i64.const(0),
    count.set,
    // reset next index
    !nextItem && [
      i32.const(nextArrPtrsRev(curr)),
      nextEndVarsRev[curr].set
    ],
    depth ? endVars[curr]!.get : [i32.const(ctx.initLengthsPtr + curr * i32.size), i32.load()],
    idx.set,
    cf.loop(flatU8A([
      // decrement idx
      idx.get,
      i32.const(i64.size + i32.size),
      i32.sub,
      idx.tee,
      // verify placement
      i64.load(0, i32.size),
      boardGetter,
      i64.and,
      i64.eqz,
      cf.if(flatU8A([
        // progress
        ctx.withProgressReport && depth === 1 && [
          cf.call(0),
          ctx.locals.get(i32.type, 'dry').get,
          cf.br_if(0)
        ],
        // place item on board
        idx.get,
        i64.load(0, i32.size),
        boardGetter,
        i64.or,
        nextBoard.set,
        // this algorithm iterates at reverse order on every layer of the same item.
        // whem a placement is valid for this layer, place it into the next layer's array.
        !nextItem && [
          // move placement
          nextEndVarsRev[curr].get,
          idx.get,
          i64.load(0, i32.size),
          i64.store(),
          // move ptr
          nextEndVarsRev[curr].get,
          idx.get,
          i32.load(i64.size),
          ptr.tee,
          i32.store(i64.size)
        ],
        // condition to inner
        nextEndVarsRev[nextCurr].get,
        nextArrPtrsRev(nextCurr) + (nextLeftsRev[nextCurr] - 1) !== 0 && [
          // todo: try increase this
          // this is the minimal amount if the deeper layer can even form a combination.
          // actually i'm not even sure if this is worth it
          i32.const(nextArrPtrsRev(nextCurr) + (nextLeftsRev[nextCurr] - 1) * (i64.size + i32.size)),
          i32.gt_u,
        ],
        cf.if(flatU8A([
          // filter everything else
          Array.from({ length: leftsRev.length - (nextItem ? 2 : 1) }, (_, item) => filterToArray(
            nextBoard.get,
            ctx.getTIdxVar(),
            arrPtrs[item],
            depth
              ? endVars[item]!.get
              : flatU8A([i32.const(ctx.initLengthsPtr + item * i32.size), i32.load()]),
            nextArrPtrsRev(item),
            nextEndVarsRev[item]
          )).reverse(),
          // inner
          nextCode,
          // add to previous
          count.get,
          i64.add,
          count.set,
          // add count to the memory
          (nextItem ? [
            idx.get,
            i32.load(i64.size),
            ptr.tee,
          ] : ptr.get),
          ptr.get,
          i64.load(),
          nextCount.get,
          i64.add,
          i64.store()
        ])),
        !nextItem && [
          // increment arr end
          nextEndVarsRev[curr].get,
          i32.const(i64.size + i32.size),
          i32.add,
          nextEndVarsRev[curr].set,
        ]
      ])),
      idx.get,
      !!arrPtrs[curr] && [
        i32.const(arrPtrs[curr]),
        i32.gt_u
      ],
      cf.br_if(0)
    ])),
    count.get,
    ctx.withProgressReport && depth === 0 && cf.call(0),
  ])
  return {
    code,
    count,
    //@ts-ignore null only happens on the first layer which doesn't matter
    board,
    arrPtrsRev: arrPtrs,
    endVarsRev: endVars
  }
}

/**
 * basically an innermost unrolled loop
 * 
 * Stack: [] -> [i64]
 */
function generateLast(ctx: BuildContext, len: number, depth: number, itemChar: string): Pass {
  const board = ctx.locals.get(i64.type, `board${depth}`)
  const end = ctx.locals.get(i32.type, `${itemChar}end${depth}`)
  const ptr = ctx.getTPtrVar()
  const count = ctx.locals.get(i64.type, `count${depth}`)
  const arr = ctx.allocateContextArr(0, depth)
  ctx.allocateCountArr(0)

  let block = cf.block(flatU8A([
    // get the address, divide by 12, branch to the block at that depth.
    i32.const(0),
    end.get,
    // this should be always zero, but just in case something unexpected happens and make sure it'll work anyway
    arr > 0 && [
      i32.const(arr),
      i32.sub,
    ],
    i32.const(2),
    i32.shr_u,
    i32.div3,
    cf.br_table(Array.from({ length: len + 1 }, (_, i) => len - i))
  ]), i32.type)

  // continue if item doesn't match
  // [i32] -> []
  const checkPlacement = flatU8A([
    i64.load(arr, i32.size),
    board.get,
    i64.and,
    i64.eqz,
    i32.eqz,
    cf.br_if(0),
  ])
  // add 1 to memory count and stack count
  // [i32 i32] -> [i32]
  const incrementCount = flatU8A([
    i32.load(arr + i64.size), // loads the pointer
    ptr.tee,
    ptr.get,
    i64.load(),
    i64.const(1),
    i64.add,
    i64.store(),
    i32.const(1),
    i32.add // to stack
  ])
  for (let i = len - 1; i >= 0; i--) {
    const arrayAddr = i32.const(i * (i64.size + 4))
    block = cf.block(flatU8A([
      block, // [] -> [i32]
      arrayAddr, // [] -> [i32]
      checkPlacement, // [i32] -> [] (br_if)
      arrayAddr, // [] -> [i32]
      incrementCount // [i32 i32] -> [i32]
    ]), i32.type)
  }
  const code = flatU8A([
    block,
    i64.extend_i32_u,
    count.tee,
  ])
  return {
    code,
    count,
    board,
    arrPtrsRev: [arr],
    endVarsRev: [end]
  }
}

/**
 * Stack: [] -> []
 * @param boardGetter [] -> [i64] board getter
 * @param tIdx temp variable for index
 * @param sourceArr the source array address
 * @param sourceEndGetter [] -> [i32] the source array's end address, not just length.
 * @param targetArr the target array address
 * @param targetEnd the variable for the target array's end address
 */
function filterToArray(
  boardGetter: Uint8Array,
  tIdx: Variable<'i32'>,
  sourceArr: number,
  sourceEndGetter: Uint8Array,
  targetArr: number,
  targetEnd: Variable<'i32'>
): Uint8Array<ArrayBuffer> {
  return flatU8A([
    // init iteration
    i32.const(targetArr),
    targetEnd.set,
    sourceEndGetter,
    tIdx.set,
    cf.loop(flatU8A([
      // decrement idx
      tIdx.get,
      i32.const(i64.size + i32.size),
      i32.sub,
      tIdx.tee,
      // verify placement
      i64.load(0, i32.size),
      boardGetter,
      i64.and,
      i64.eqz,
      cf.if(flatU8A([
        // move placement
        targetEnd.get,
        tIdx.get,
        i64.load(0, i32.size),
        i64.store(0, i32.size),
        // move ptr
        targetEnd.get,
        tIdx.get,
        i32.load(i64.size),
        i32.store(i64.size),
        // increment arr end
        targetEnd.get,
        i32.const(i64.size + i32.size),
        i32.add,
        targetEnd.set
      ])),
      // continue
      tIdx.get,
      i32.const(sourceArr),
      i32.gt_u,
      cf.br_if(0)
    ]))
  ])
}

function wrapArrPtrArray(arr: number[]): (index: number) => number {
  return index => {
    const ptr = arr[index]
    if ((ptr ?? -1) === -1) {
      throw new Error(`Invalid array pointer`)
    }
    return ptr
  }
}

class BuildContext {
  // readonly origBoard: bigint
  // readonly mainBoard: bigint
  readonly memories: MemoryAllocator
  readonly locals: LocalVariables
  /**
   * the memory pointers of each item placement's counts allocated by inner hotspot.
   */
  readonly countArrsRev: Int32Array
  pass: Pass | null = null
  readonly items: readonly PlacementsAndAmount[]
  readonly itemsRev: readonly PlacementsAndAmount[]
  readonly maxedLengths: number[]
  readonly placements: BigUint64Array[]
  readonly placementsRev: BigUint64Array[]
  readonly withProgressReport: boolean
  initLengthsPtr = -1
  tempIdx: Variable<'i32'> | null = null
  tempPtr: Variable<'i32'> | null = null

  constructor(input: readonly PlacementsAndAmount[], withProgressReport: boolean) {
    // this.origBoard = origBoard
    this.memories = new MemoryAllocator()
    this.locals = new LocalVariables()
    this.countArrsRev = new Int32Array(input.length).fill(-1)
    this.items = input
    this.itemsRev = input.slice().reverse()
    this.maxedLengths = input.map(v => Math.max(v.placements.length, v.lengthHint)).reverse()
    this.placements = input.map(paa => paa.placements)
    this.placementsRev = this.placements.slice().reverse()
    this.withProgressReport = withProgressReport
    // this.mainBoard = ((1n << 45n) - 1n) ^ this.placements.map(a => a.reduce((p, v) => p | v)).reduce((p, v) => p | v)
  }

  allocateContextArr(itemIndexRev: number, depth: number) {
    return this.memories.allocate(
      this.maxedLengths[itemIndexRev] * (i64.size + i32.size),
      i64.size,
      `The filtered context array for itemRev ${itemIndexRev} at depth ${depth}`
    )
  }

  allocateCountArr(itemIndexRev: number) {
    const v = this.countArrsRev[itemIndexRev]
    if (v === undefined) throw 'index out of bounds'
    if (v !== -1) throw 'already allocated'
    this.countArrsRev[itemIndexRev] = this.memories.allocate(
      this.maxedLengths[itemIndexRev] * i64.size,
      i64.size,
      `The count storage for itemRev ${itemIndexRev}`
    )
  }

  allocateInitLengths() {
    if (this.initLengthsPtr !== -1) {
      throw new Error(`init lengths arr is already allocated`)
    }
    this.initLengthsPtr = this.memories.allocate(
      this.items.length * i32.size,
      i32.size,
      'The init count for each starting array'
    )
  }

  getTIdxVar() {
    this.tempIdx ??= this.locals.get(i32.type, `tempIdx`)
    return this.tempIdx
  }

  getTPtrVar() {
    this.tempPtr ??= this.locals.get(i32.type, `tempPtr`)
    return this.tempPtr
  }
}
