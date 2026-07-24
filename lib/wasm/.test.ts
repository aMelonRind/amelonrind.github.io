import { control_flow as cf, flatU8A, i32, i64, local } from "./opcode.ts";
import { LocalVariables, WasmBuilder } from "./tool.ts";

async function test(doHotloop: boolean) {
  const locals = new LocalVariables()
  const a = locals.defineParameter(i32.type, 'a')
  const b = locals.defineParameter(i32.type, 'b')
  const module = await new WasmBuilder()
    .func('add', 0, locals.getParamTypes(), i32.type, flatU8A([
      a.get,
      b.get,
      i32.add,
      cf.end
    ]), locals.getTypes())
    .build()

  console.log(module.getByteLength())
  const wasm = await module.instantiate()
  const worker = await module.instantiateWorker()

  console.log((wasm.exports as any).add(5, 13))
  console.log(await worker.invoke('add', 5, 13))

  const module2 = await new WasmBuilder()
    .import('date', 0, [], i64.type)
    .import('notifyNoReturn', 1, [i32.type], [], true)
    // .import('two', 2, [], [i32.type, i64.type])
    .func('main', 2, [], i64.type, flatU8A([
      i32.const(123),
      cf.call(1), // notify
      cf.call(0), // date
      i64.const(1000),
      i64.add,
      cf.end
    ]), [])
    .func('hotloop', 3, [], i32.type, flatU8A([
      // defines target to 2 seconds in the future
      cf.call(0), // now
      i64.const(2000),
      i64.add,
      local.set(0),
      // loop until time's up
      cf.loop(flatU8A([
        cf.call(0), // now
        local.get(0),
        i64.sub,
        i64.const(0),
        i64.lt_s,
        cf.br_if(0)
      ])),
      // return a random value, idk
      i32.const(123),
      cf.end
    ]), [i64.type], ['targettime'])
    .func('test', 4, [], [i32.type, i64.type], flatU8A([
      i32.const(123),
      i64.const(456),
      cf.end
    ]), [])
    .build()

  console.log(module2.getByteLength())
  const imports = {
    notifyNoReturn: (n: number) => console.log(`Message from wasm: ${n}`)
  }
  const wasm2 = await module2.instantiate(imports)
  const worker2 = await module2.instantiateWorker(imports)

  console.log((wasm2.exports as any).main() - BigInt(Date.now()))
  console.log((await worker2.invoke('main') as bigint) - BigInt(Date.now()))
  console.log('test:', await worker2.invoke('test'))

  if (!doHotloop) return
  const step = 250
  const max = Math.ceil(2000 / step + 1)
  const waitp2 = new Promise(res => setTimeout(res, (max + 2) * step))

  console.log(`: local hotloop start`)
  let start = setHotloopTimeouts('local')
  ;(wasm2.exports as any).hotloop()
  console.log(`: local hotloop end ${Date.now() - start}`)

  await waitp2

  console.log(`: worker hotloop start`)
  start = setHotloopTimeouts('worker')
  await worker2.invoke('hotloop')
  console.log(`: worker hotloop end ${Date.now() - start}`)

  function setHotloopTimeouts(name: string) {
    const start = Date.now()
    for (let i = 1; i <= max; i++) {
      const num = i * step
      const expected = start + num
      setTimeout(() => console.log(`${name} hotloop ${i}  ${Date.now() - expected}`), num)
    }
    return start
  }
}

test(false)

// console output:
// testwasm.ts:15 Uint8Array(55) [0, 97, 115, 109, 1, 0, 0, 0, 1, 7, 1, 96, 2, 127, 127, 1, 127, 3, 2, 1, 0, 5, 3, 1, 0, 0, 7, 16, 2, 6, 109, 101, 109, 111, 114, 121, 2, 0, 3, 97, 100, 100, 0, 0, 10, 9, 1, 7, 0, 32, 0, 32, 1, 106, 11, buffer: ArrayBuffer(55), byteLength: 55, byteOffset: 0, length: 55, Symbol(Symbol.toStringTag): 'Uint8Array']
// testwasm.ts:19 18
// testwasm.ts:20 18
// testwasm.ts:51 Uint8Array(162) [0, 97, 115, 109, 1, 0, 0, 0, 1, 13, 3, 96, 0, 1, 126, 96, 0, 1, 127, 96, 1, 127, 0, 2, 28, 2, 1, 109, 3, 110, 111, 119, 0, 0, 1, 109, 14, 110, 111, 116, 105, 102, 121, 78, 111, 82, 101, 116, 117, 114, 110, 0, 2, 3, 3, 2, 0, 1, 5, 3, 1, 0, 0, 7, 27, 3, 6, 109, 101, 109, 111, 114, 121, 2, 0, 4, 109, 97, 105, 110, 0, 2, 7, 104, 111, 116, 108, 111, 111, 112, 0, 3, 10, 44, 2, 13, 0, 65, 251, 0, …]
// testwasm.ts:53 Message from wasm: 123
// testwasm.ts:58 1000n
// testwasm.ts:53 Message from wasm: 123
// testwasm.ts:59 1000n
// testwasm.ts:65 : local hotloop start
// testwasm.ts:68 : local hotloop end 2001
// testwasm.ts:82 local hotloop 1  1751
// testwasm.ts:82 local hotloop 2  1501
// testwasm.ts:82 local hotloop 3  1252
// testwasm.ts:82 local hotloop 4  1002
// testwasm.ts:82 local hotloop 5  752
// testwasm.ts:82 local hotloop 6  502
// testwasm.ts:82 local hotloop 7  252
// testwasm.ts:82 local hotloop 8  2
// testwasm.ts:82 local hotloop 9  2
// testwasm.ts:72 : worker hotloop start
// testwasm.ts:82 worker hotloop 1  1
// testwasm.ts:82 worker hotloop 2  2
// testwasm.ts:82 worker hotloop 3  2
// testwasm.ts:82 worker hotloop 4  2
// testwasm.ts:82 worker hotloop 5  2
// testwasm.ts:82 worker hotloop 6  2
// testwasm.ts:82 worker hotloop 7  2
// testwasm.ts:75 : worker hotloop end 2001
// testwasm.ts:82 worker hotloop 8  2
// testwasm.ts:82 worker hotloop 9  2
