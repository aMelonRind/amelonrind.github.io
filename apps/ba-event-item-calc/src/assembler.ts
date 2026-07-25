// this file can dynamically generate wasm module based on inputs
import { WritableDeepU8Arr } from "../../../lib/wasm/deepu8a.ts";
import { control_flow as cf, i32, flatU8A, DeepU8Arr, f64, f32 } from "../../../lib/wasm/opcode.ts";
import { LocalVariables, Variable, WasmBuilder } from "../../../lib/wasm/tool.ts";
import { CRAFT_VALUES, Level, Tier } from "./solver.ts";

/**
 * assembles a module that contain functions with the same signature:  
 * [funcName](minAp: number, maxAp: number, ...items: number[]): [usedAp: number, ...sweeps: number[], ...items: number[]]  
 * where funcName are:  
 * normal, semiPerfect1, semiPerfect2, semiPerfect3, semiPerfect4, perfect1, perfect2, perfect3, perfect4  
 * negative items means requirement.
 */
export function assemble(
  levels: readonly Level[],
  itemTypes: number,
  voids: Uint16Array,
  transfers: Uint8Array,
) {
  const builder = new WasmBuilder()
  assembleFunc(builder, 'normal', 0, levels, itemTypes, voids, transfers, Tier.NORMAL)
  assembleFunc(builder, 'semiPerfect1', 1, levels, itemTypes, voids, transfers, Tier.SEMI_PERFECT, 1)
  assembleFunc(builder, 'semiPerfect2', 2, levels, itemTypes, voids, transfers, Tier.SEMI_PERFECT, 2)
  assembleFunc(builder, 'semiPerfect3', 3, levels, itemTypes, voids, transfers, Tier.SEMI_PERFECT, 3)
  assembleFunc(builder, 'semiPerfect4', 4, levels, itemTypes, voids, transfers, Tier.SEMI_PERFECT, 4)
  assembleFunc(builder, 'perfect1', 5, levels, itemTypes, voids, transfers, Tier.PERFECT, 1)
  assembleFunc(builder, 'perfect2', 6, levels, itemTypes, voids, transfers, Tier.PERFECT, 2)
  assembleFunc(builder, 'perfect3', 7, levels, itemTypes, voids, transfers, Tier.PERFECT, 3)
  assembleFunc(builder, 'perfect4', 8, levels, itemTypes, voids, transfers, Tier.PERFECT, 4)
  return builder.build()
}

/**
 * assembles a function with signature:
 * [funcName](minAp: number, maxAp: number, ...items: number[]): [usedAp: number, ...sweeps: number[], ...items: number[]]
 * negative items means requirement.
 */
export function assembleFunc(
  builder: WasmBuilder,
  funcName: string,
  funcIdx: number,
  levels: readonly Level[],
  itemTypes: number,
  voids: Uint16Array,
  transfers: Uint8Array,
  tier: Tier,
  perfectExplore = 1
) {
  const locals = new LocalVariables()
  const minAp = locals.defineParameter(i32.type, 'minAp')
  const maxAp = locals.defineParameter(i32.type, 'maxAp')
  const itemVars = Array.from({ length: itemTypes }, (_, i) => locals.defineParameter(i32.type, `item${i}`))
  const tmp32 = locals.get(i32.type, 'tmp32')
  const tmp64 = locals.get(f64.type, 'tmp64')
  const usedAp = locals.get(i32.type, 'usedAp')
  const bestAp = locals.get(i32.type, 'bestAp')
  const levelsSweeped = Array.from(levels, (_, i) => locals.get(i32.type, `level${i}`))
  const levelsBest = Array.from(levels, (_, i) => locals.get(i32.type, `best${i}`))
  const itemsBest = Array.from(itemVars, (_, i) => locals.get(i32.type, `bestI${i}`))

  // /**
  //  * [] -> []
  //  */
  // const incrementTest32 = flatU8A([
  //   test32.get,
  //   i32.const(1),
  //   i32.add,
  //   test32.set,
  // ])

  let code: DeepU8Arr = [
    // innermost validator & collector
    cf.block(flatU8A([
      // compare ap
      usedAp.get,
      maxAp.get,
      i32.gt_u,
      cf.br_if(0),
      // identify validness
      assembleIdentifier(voids, transfers, itemVars, tmp32, tier),
      cf.br_if(0),
      cf.block(flatU8A([
        // compare if same ap
        usedAp.get,
        maxAp.get,
        i32.lt_u,
        cf.br_if(0),
        // compare craft value
        levels.length === 12 && [
          Array.from({ length: 3 }, (_, i) => [
            Array.from({ length: 4 }, (_, j) => [
              levelsSweeped[i * 4 + j].get,
              j > 0 && i32.add,
              levelsBest[i * 4 + j].get,
              i32.sub
            ]),
            f64.convert_i32_s,
            f64.const(CRAFT_VALUES[i]),
            f64.mul,
            i > 0 && f64.add
          ]),
          tmp64.tee,
          f64.const(0),
          f64.lt,
          cf.br_if(1),
          tmp64.get,
          f64.const(0),
          f64.gt,
          cf.br_if(0)
        ],
        // compare misc value
        levelsSweeped.map((v, i) => [
          v.get,
          i > 0 && i32.add
        ]),
        levelsBest.map(v => [
          v.get,
          i32.sub
        ]),
        tmp32.tee,
        i32.const(0),
        i32.lt_s,
        cf.br_if(1),
        tmp32.get,
        i32.const(0),
        i32.gt_s,
        cf.br_if(0),
        // compare one by one
        levelsSweeped.map((v, i) => [
          v.get,
          levelsBest[i].get,
          i32.sub,
          tmp32.tee,
          i32.const(0),
          i32.lt_s,
          cf.br_if(1),
          tmp32.get,
          i32.const(0),
          i32.gt_s,
          cf.br_if(0),
        ])
        // it's impossible to get here, but it's valid anyways
      ])),
      // apply
      usedAp.get,
      bestAp.tee,
      maxAp.set,
      levelsSweeped.map((v, i) => [
        v.get,
        levelsBest[i].set
      ]),
      itemVars.map((v, i) => [
        v.get,
        itemsBest[i].set
      ])
    ]))
  ]

  for (const [li, level] of levels.entries().toArray().reverse()) {
    code = [
      // calculate max
      f32.const(0),
      itemVars.map((v, i) => level.items[i] > 0 && [
        v.get,
        f32.convert_i32_s,
        f32.const(level.items[i]),
        f32.div,
        f32.min
      ]),
      f32.neg,
      f32.ceil,
      i32.trunc_f32_u,
      (tier === Tier.SEMI_PERFECT || tier === Tier.PERFECT) && [
        i32.const(perfectExplore),
        i32.add
      ],
      levelsSweeped[li].tee,
      maxAp.get,
      usedAp.get,
      i32.sub,
      i32.const(level.ap),
      i32.div_u,
      tmp32.tee,
      levelsSweeped[li].get,
      tmp32.get,
      i32.lt_u,
      cf.select,
      levelsSweeped[li].tee,
      // apply max
      cf.if(flatU8A([
        // apply ap
        usedAp.get,
        levelsSweeped[li].get,
        i32.mul_const(level.ap),
        i32.add,
        usedAp.set,
        // apply items
        itemVars.map((v, i) => level.items[i] > 0 && [
          v.get,
          levelsSweeped[li].get,
          i32.mul_const(level.items[i]),
          i32.add,
          v.set
        ]),
      ])),
      cf.loop(flatU8A([
        // inner
        code,
        // check if should continue
        levelsSweeped[li].get,
        cf.if(flatU8A((() => {
          const decrement = flatU8A([
            usedAp.get,
            i32.const(level.ap),
            i32.sub,
            usedAp.set,
            itemVars.map((v, i) => level.items[i] > 0 && [
              v.get,
              i32.const(level.items[i]),
              i32.sub,
              v.set
            ]),
            levelsSweeped[li].get,
            i32.const(1),
            i32.sub,
            levelsSweeped[li].set
          ])

          return li + 1 === levels.length ? [ // only last level is eligible of using minAP skip
            usedAp.get,
            i32.const(level.ap),
            i32.sub,
            minAp.get,
            i32.lt_u,
            cf.if(flatU8A([ // if smaller than minAP
              // clear
              usedAp.get,
              levelsSweeped[li].get,
              i32.mul_const(level.ap),
              i32.sub,
              usedAp.set,
              itemVars.map((v, i) => level.items[i] > 0 && [
                v.get,
                levelsSweeped[li].get,
                i32.mul_const(level.items[i]),
                i32.sub,
                v.set
              ]),
              // i32.const(0),
              // levelsSweeped[li].set
            ]), flatU8A([ // else continue loop
              decrement,
              cf.br(2) // continue loop
            ]))
          ] : [
            decrement,
            cf.br(1) // continue loop
          ]
        })()))
      ]))
    ]
  }

  code = [
    // init values
    i32.const(2147483647),
    bestAp.set,
    // run
    code,
    // result
    bestAp.get,
    levelsBest.map(v => v.get),
    itemsBest.map(v => v.get),
    cf.end
  ]

  builder.func(
    funcName, funcIdx,
    locals.getParamTypes(),
    new Array(1 + levelsBest.length + itemsBest.length).fill(i32.type),
    flatU8A(code),
    locals.getTypes(),
    locals.getNames()
  )
}

/**
 * assumes item variables present, returns 0 if valid.
 * [] -> [i32]
 */
function assembleIdentifier(
  voids: Uint16Array,
  transfers: Uint8Array,
  items: Variable<'i32'>[],
  tmp32: Variable<'i32'>,
  tier: Tier
): Uint8Array {
  if (transfers.length !== voids.length || !voids.length || transfers.at(-1)) {
    throw `TierIdentifier assemble assertion error`
  }

  const checkPerfect = tier === Tier.SEMI_PERFECT || tier === Tier.PERFECT

  const notAffectedByTransfer = Array.from(voids, (_, i) => i).filter(i => !transfers[i - 1])
  const notRelatedByTransfer = notAffectedByTransfer.filter(i => !transfers[i])
  // will later be wrapped into i32 block
  const code: WritableDeepU8Arr = [ // [] -> [i32]
    i32.const(1), // invalid
    // check if items not affected by transfer is not enough
    // there should be at least 2, but check empty anyway
    notAffectedByTransfer.length > 0 && [
      notAffectedByTransfer.map((item, i) => [
        // accumulate sign
        items[item].get,
        i > 0 && i32.or
      ]),
      i32.const(0),
      i32.lt_s,
      cf.br_if(0)
    ],
    // check the perfectiness of values that's not related by transfer, except the first
    checkPerfect && (() => {
      const list = notRelatedByTransfer.filter(i => i && voids[i] !== 1)
      return list.length > 0 && list.map((item, i) => [
        items[item].get,
        voids[item] && [
          i32.const(voids[item]),
          i32.rem_s
        ],
        cf.br_if(0)
      ])
    })(),
  ]

  if (transfers.some(v => v)) {
    // check the transferable groups
    let holding = false
    for (let i = 0; i < transfers.length; i++) {
      if (transfers[i]) {
        const getter = holding ? tmp32.get : items[i].get
        code.push([ // [i32] -> [i32]
          checkPerfect && [
            getter,
            i32.const(transfers[i]),
            i32.rem_u,
            cf.br_if(0)
          ],
          getter,
          i32.const(transfers[i]),
          i32.div_u,
          items[i + 1].get,
          i32.add,
          tmp32.tee,
          i32.const(0),
          i32.lt_s,
          cf.br_if(0)
        ])
        holding = true
      } else if (holding) {
        holding = false
        if (voids[i] !== 1) {
          code.push([ // [i32] -> [i32]
            tmp32.get,
            voids[i] > 0 && [
              i32.const(voids[i]),
              i32.rem_u
            ],
            cf.br_if(0)
          ])
        }
      }
    }
  }
  // at this point the input is considered valid.
  code.push(cf.drop)
  if (tier === Tier.PERFECT && voids[0] !== 1) {
    code.push([
      items[0].get,
      voids[0] > 0 && [
        i32.const(voids[0]),
        i32.rem_u
      ]
    ])
  } else {
    code.push(i32.const(0))
  }

  return cf.block(flatU8A(code), i32.type)
}
