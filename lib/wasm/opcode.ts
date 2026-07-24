// Contains basic wasm opcodes from 0x00 to 0xBF.

// Learn about webassembly here: https://webassembly.github.io/spec/core/intro/introduction.html
// Opcodes: https://wasm-chart.pengowray.com/

// All functions are pure.

// It's recommended to annotate your bytecode chunks with stack changes like [i64 i32] -> [i32 i32 i64],
// and explain the purpose of your bytecode every few lines, because bytecodes are mostly not straightforward.

// Hint: using local functions can make bytecode more readable
// while being able to access variables across functions.

import { flatU8A, DeepU8Arr } from "./deepu8a.ts";
import { leb128 } from "./leb128.ts";

export { flatU8A, type DeepU8Arr };

const textEncoder = new TextEncoder()

export type ExportType = 'func' | 'table' | 'mem' | 'global' | 'tag';

export const exportTypes = {
  func: 0x00,
  table: 0x01,
  mem: 0x02,
  global: 0x03,
  tag: 0x04
} as const satisfies Record<ExportType, number>;

/**
 * Many sections are omitted because dynamically generated algorithm probably don't need them.
 * 
 * The order in module is the same as declared order here, specifically:  
 * header, types, import, func, memory, export, start, code, names.
 */
// https://webassembly.github.io/spec/core/binary/modules.html#binary-module
export namespace section {
  /**
   * The wasm header with magic `00 61 73 6D (\0asm)` and version `01 00 00 00`
   */
  export const header = Uint8Array.of(0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00)
  /**
   * Completes a section from section type and content.
   * 
   * @param type section type
   * @param content bytes
   */
  export const _raw = (type: number, content: Uint8Array): Uint8Array =>
    flatU8A([type, lengthed(content)])

  /**
   * partial implementation: only compType, which is ultimately for functions.
   */
  // https://webassembly.github.io/spec/core/binary/types.html#binary-comptype
  export const types = (types: readonly [params: Uint8Array, result: Uint8Array][]): Uint8Array =>
    _raw(0x01, vec(types, f => [0x60, lengthed(f[0]), lengthed(f[1])]))
  /**
   * partial implementation: only for external functions.
   */
  const import_ = (
    imports: readonly [moduleName: string, name: string, type: number][],
    memory: number | bigint | null = null
  ): Uint8Array => {
    const list = imports.map(f => [encodeStr(f[0]), encodeStr(f[1]), exportTypes.func as number, leb128.u32(f[2])])
    if (memory != null) {
      list.push([encodeStr('js'), encodeStr('mem'), exportTypes.mem, 0x00, leb128.u64(memory)])
    }
    return list.length ? _raw(0x02, vec(list, e => e)) : new Uint8Array(0)
  }
  /**
   * Same amount of code should be provided in the code section.
   * This specifies the param/return types by referencing types declared at `section.types`.
   */
  export const func = (types: readonly number[]): Uint8Array => _raw(0x03, vec(types, v => leb128.u32(v)))
  // /**
  //  * partial implementation: single memory
  //  * @deprecated use import to reduce memory usage
  //  */
  // export const memory = (size: number | bigint): Uint8Array =>
  //   _raw(0x05, flatU8A([leb128.u32(1), 0x00, leb128.u64(size)]))
  const export_ = (exports: { [name: string]: [type: ExportType, idx: number] }): Uint8Array =>
    _raw(0x07, vec(Object.entries(exports), e => [encodeStr(e[0]), exportTypes[e[1][0]], leb128.u32(e[1][1])]))
  export const start = (func: number) => _raw(0x08, leb128.u32(func))
  export const code = (funcs: readonly [locals: Uint8Array, body: Uint8Array][]): Uint8Array => {
    const mappedFuncs = funcs.map(([locals, body]) => {
      if (locals.length === 0) {
        return flatU8A([leb128.u32(1 + body.length), leb128.u32(0), body])
      }

      const loc: (number | Uint8Array)[] = []
      let current = 0
      let count = 0
      for (const type of locals) {
        if (type !== current) {
          if (count) {
            loc.push(leb128.u32(count), current)
          }
          count = 0
          current = type
        }
        count++
      }
      if (count) {
        loc.push(leb128.u32(count), current)
      }
      const locflat = flatU8A(loc)
      const loclen = leb128.u32(locflat.length / 2)
      return flatU8A([leb128.u32(loclen.length + locflat.length + body.length), loclen, locflat, body])
    })
    return _raw(0x0A, flatU8A([leb128.u32(mappedFuncs.length), mappedFuncs]))
  }
  /**
   * partial implementation: only for local names.
   * 
   * https://webassembly.github.io/spec/core/appendix/custom.html#
   */
  export const names = (names: readonly (readonly (string | null)[])[]): Uint8Array =>
    _raw(0x00, flatU8A([encodeStr('name'), 0x02, lengthed(flatU8A([
      leb128.u32(names.reduce((p, v) => v.length ? p + 1 : p, 0)),
      names.map((f, i) => !f.length ? null : [
        leb128.u32(i),
        leb128.u32(f.reduce((p, v) => v ? p + 1 : p, 0)),
        f.map((n, i) => n ? [leb128.u32(i), encodeStr(n)] : [])
      ])
    ]))]))

  //@ts-ignore
  export { import_ as import, export_ as export }
  section.import = import_
  section.export = export_
}

/**
 * suggestion: alias this into `cf`.
 */
export namespace control_flow {
  /**
   * The byte that represents void.
   */
  const void_ = 0x40
  /**
   * The unreachable instruction causes an unconditional trap.
   * 
   * A trap immediately aborts execution. Traps cannot be handled by WebAssembly code,
   * but are reported to the outside environment, where they typically can be caught.
   * 
   * Note: Any instructions following must be valid.
   * 
   * Stack: [t<span><sup>∗</sup><sub>1</sub></span>] → [t<span><sup>∗</sup><sub>2</sub></span>]
   * 
   * <b>stack-polymorphic</b>: performs an <i>*unconditional control transfer*</i>.
   */
  export const unreachable = 0x00
  /**
   * The nop instruction does nothing.
   * 
   * Stack: [] → []
   */
  export const nop = 0x01
  /**
   * The beginning of a block construct, a sequence of instructions with a label at the end.
   * 
   * Stack: [] → [t<sup>∗</sup>]
   * 
   * The result type of the instructions must match the blocktype.  
   * For example, if the rt is `i32.type`, then the instructions must push only one i32 value to the stack.
   * 
   * The <i>*block*</i>, <i>*loop*</i> and <i>*if*</i> instructions are structured instructions.
   * They bracket nested sequences of instructions, called blocks, terminated with, or
   * separated by, <i>*end*</i> or <i>*else*</i> pseudo-instructions. They must be well-nested.
   * 
   * @param content instructions
   * @param type [blocktype](https://webassembly.github.io/spec/core/syntax/types.html#syntax-blocktype)
   */
  export const block = (content: Uint8Array, type = void_): Uint8Array => flatU8A([0x02, type, content, end])
  /**
   * A block with a label at the beginning which may be used to form loops.
   * 
   * Stack: [] → [t<sup>∗</sup>]
   * 
   * @param content instructions
   * @param type [blocktype](https://webassembly.github.io/spec/core/syntax/types.html#syntax-blocktype)
   */
  export const loop = (content: Uint8Array, type = void_): Uint8Array => flatU8A([0x03, type, content, end])
  /**
   * The beginning of an if construct with an implicit <i>*then*</i> block.
   * 
   * Stack: [i32] → [t<sup>∗</sup>]  
   * i32 <i>*c*</i> → [t<sup>∗</sup>]  
   * if <i>*c*</i> is non-zero, enter block instructions<sub>1</sub>, else enter block instructions<sub>2</sub>
   * 
   * @param then instructions1
   * @param else_ instructions2
   * @param type [blocktype](https://webassembly.github.io/spec/core/syntax/types.html#syntax-blocktype)
   */
  const if_ = (then: Uint8Array, else_: Uint8Array | undefined = undefined, type = void_): Uint8Array =>
    flatU8A([0x04, type, then, (else_ ? [0x05, else_] : []), end])
  /**
   * Marks the end of a <i>*block*</i>, <i>*loop*</i>, <i>*if*</i>, or function.
   *
   * You should only use this on functions, as the control flows are handled automatically.
   */
  export const end = 0x0B
  /**
   * Branch to a given label in an enclosing construct.
   * 
   * Performs an unconditional branch.
   * 
   * Label 0 refers to the innermost structured control instruction enclosing the referring
   * branch instruction, while increasing indices refer to those farther out.
   * 
   * Stack: [t<span><sup>∗</sup><sub>1</sub></span> t<sup>?</sup>] → [t<span><sup>∗</sup><sub>2</sub></span>]
   * 
   * A branch targeting a <i>*block*</i> or <i>*if*</i> behaves like a break statement in most
   * C-like languages, while a branch targeting a <i>*loop*</i> behaves like a continue statement.
   * 
   * <b>stack-polymorphic</b>: performs an <i>*unconditional control transfer*</i>.
   * 
   * @param label [labelidx](https://webassembly.github.io/spec/core/syntax/modules.html#syntax-labelidx)
   */
  export const br = (label: number): Uint8Array => flatU8A([0x0C, leb128.u32(label)])
  /**
   * Performs a conditional branch, branching if i32 <i>*c*</i> is non-zero.
   * 
   * Conditionally branch to a given label in an enclosing construct.
   * 
   * Stack: [t<sup>?</sup> i32] → [t<sup>?</sup>]
   * 
   * @param label [labelidx](https://webassembly.github.io/spec/core/syntax/modules.html#syntax-labelidx)
   */
  export const br_if = (label: number): Uint8Array => flatU8A([0x0D, leb128.u32(label)])
  /**
   * A jump table which jumps to a label in an enclosing construct.
   * 
   * Performs an indirect branch through an operand indexing into the label vector that is an
   * immediate to the instruction, or to a default target if the operand is out of bounds.
   * 
   * Stack: [t<span><sup>∗</sup><sub>1</sub></span> t<sup>?</sup> i32] → [t<span><sup>∗</sup><sub>2</sub></span>]
   * 
   * <b>stack-polymorphic</b>: performs an <i>*unconditional control transfer*</i>.
   * 
   * @param labels [labelidx](https://webassembly.github.io/spec/core/syntax/modules.html#syntax-labelidx) array with at least 1 element, the last one is the default target.
   */
  export const br_table = (labels: readonly number[]): Uint8Array =>
    flatU8A([0x0E, leb128.u32(labels.length - 1), labels.map(v => leb128.u32(v))])
  /**
   * Return zero or more values from this function.
   * 
   * The return instruction is a shortcut for an unconditional branch to the outermost block,
   * which implicitly is the body of the current function.
   * 
   * This is not necessary at the end of the function.
   * 
   * Stack: [t<span><sup>∗</sup><sub>1</sub></span> t<sup>?</sup>] → [t<span><sup>∗</sup><sub>2</sub></span>]
   * 
   * <b>stack-polymorphic</b>: performs an <i>*unconditional control transfer*</i>.
   */
  const return_ = 0x0F
  /**
   * The call instruction invokes another function, consuming the necessary arguments from
   * the stack and returning the result values of the call.
   * 
   * Stack: [t<span><sup>∗</sup><sub>1</sub></span>] → [t<span><sup>∗</sup><sub>2</sub></span>]
   * 
   * @param func [funcidx](https://webassembly.github.io/spec/core/syntax/modules.html#syntax-funcidx)
   */
  export const call = (func: number): Uint8Array => flatU8A([0x10, leb128.u32(func)])
  /**
   * The call_indirect instruction calls a function indirectly through an operand indexing into a table.
   * 
   * Stack: [t<sup>?</sup> i32] → [t<sup>?</sup>]
   * 
   * @param type [typeidx](https://webassembly.github.io/spec/core/syntax/modules.html#syntax-typeidx)
   * @param zeroByte In future versions of WebAssembly, this may be used to index additional tables.
   */
  export const call_indirect = (type: number, zeroByte = 0x00): Uint8Array => flatU8A([0x11, leb128.u32(type), zeroByte])
  /**
   * The drop instruction simply throws away a single operand.
   * 
   * Stack: [t] → [] [(value-polymorphic)](https://webassembly.github.io/spec/core/valid/instructions.html#polymorphism)
   */
  export const drop = 0x1A
  /**
   * The select instruction selects one of its first two operands
   * based on whether its third operand is zero or not.
   * 
   * Stack: [t t i32] → [t] [(value-polymorphic)](https://webassembly.github.io/spec/core/valid/instructions.html#polymorphism)  
   * t <i>*a*</i>, t <i>*b*</i>, i32 <i>*c*</i> → [t]  
   * c ? a : b
   */
  export const select = 0x1B

  //@ts-ignore
  export { void_ as void, if_ as if, return_ as return }
  control_flow.void = void_
  control_flow.if = if_
  control_flow.return = return_
}

export namespace local {
  /**
   * This instruction gets the value of a variable.
   * 
   * Stack: [] → [t]
   * 
   * The index space for locals is only accessible inside a function and includes
   * the parameters of that function, which precede the local variables.
   * 
   * The <i>*locals*</i> context refers to the list of locals declared in the
   * current function (including parameters), represented by their value type.
   * 
   * @param idx [localidx](https://webassembly.github.io/spec/core/syntax/modules.html#syntax-localidx)
   */
  export const get = (idx: number): Uint8Array => flatU8A([0x20, leb128.u32(idx)])
  /**
   * This instruction sets the value of a variable.
   * 
   * Stack: [t] → []
   * 
   * The index space for locals is only accessible inside a function and includes
   * the parameters of that function, which precede the local variables.
   * 
   * @param idx [localidx](https://webassembly.github.io/spec/core/syntax/modules.html#syntax-localidx)
   */
  export const set = (idx: number): Uint8Array => flatU8A([0x21, leb128.u32(idx)])
  /**
   * The local.tee instruction is like local.set but also returns its argument.
   * 
   * Stack: [t] → [t]
   * 
   * The index space for locals is only accessible inside a function and includes
   * the parameters of that function, which precede the local variables.
   * 
   * @param idx [localidx](https://webassembly.github.io/spec/core/syntax/modules.html#syntax-localidx)
   */
  export const tee = (idx: number): Uint8Array => flatU8A([0x22, leb128.u32(idx)])
}

export namespace global {
  /**
   * This instruction gets the value of a variable.
   * 
   * Stack: [] → [t]
   * 
   * The <i>*globals*</i> context is the list of globals declared in the current
   * module, represented by their global type.
   * 
   * @param idx [globalidx](https://webassembly.github.io/spec/core/syntax/modules.html#syntax-globalidx)
   */
  export const get = (idx: number): Uint8Array => flatU8A([0x23, leb128.u32(idx)])
  /**
   * This instruction sets the value of a variable.
   * 
   * Stack: [t] → []
   * 
   * The <i>*globals*</i> context is the list of globals declared in the current
   * module, represented by their global type.
   * 
   * @param idx [globalidx](https://webassembly.github.io/spec/core/syntax/modules.html#syntax-globalidx)
   */
  export const set = (idx: number): Uint8Array => flatU8A([0x24, leb128.u32(idx)])
}

export namespace i32 {
  export const name = 'i32'
  /**
   * The byte that represents i32.
   */
  export const type = 0x7F
  /**
   * The size of i32.
   */
  export const size = 4
  /**
   * Load 4 bytes as i32.
   * 
   * Stack: [i32] → [i32]  
   * i : address-operand → c : result
   * 
   * Memory is accessed with load and store instructions for the different value types.
   * They all take a memory immediate <i>*memarg*</i> that contains an address offset
   * and the expected alignment.
   * 
   * The immediate value memarg.align is an alignment hint about the effective-address.
   * It is a power-of 2 encoded as log2(memarg.align).
   * In practice, its value may be: 0 (8-bit), 1 (16-bit), 2 (32-bit), or 3 (64-bit; used only with wasm64).
   * 
   * <code>`effective-address = address-operand + memarg.offset`</code>
   * 
   * If memarg.align is incorrect it is considered "misaligned". Misaligned access
   * still has the same behavior as aligned access, only possibly much slower.
   */
  export const load = memoryOp(0x28, i32.size)
  /**
   * Load 1 byte and sign-extend i8 to i32.
   * 
   * Stack: [i32] → [i32]
   * 
   * Integer loads and stores can optionally specify a storage size that is
   * smaller than the bit width of the respective value type.
   * In the case of loads, a sign extension mode sx (s|u) is then required to
   * select appropriate behavior.
   */
  export const load8_s = memoryOp(0x2C, 1)
  /**
   * Load 1 byte and zero-extend i8 to i32.
   * 
   * Stack: [i32] → [i32]
   */
  export const load8_u = memoryOp(0x2D, 1)
  /**
   * Load 2 bytes and sign-extend i16 to i32.
   * 
   * Stack: [i32] → [i32]
   */
  export const load16_s = memoryOp(0x2E, 2)
  /**
   * Load 2 bytes and zero-extend i16 to i32.
   * 
   * Stack: [i32] → [i32]
   */
  export const load16_u = memoryOp(0x2F, 2)
  /**
   * Store 4 bytes (no conversion).
   * 
   * Stack: [i32 i32] → []
   */
  export const store = memoryOp(0x36, i32.size)
  /**
   * Wrap i32 to i8 and store 1 byte.
   * 
   * Stack: [i32 i32] → []
   */
  export const store8 = memoryOp(0x3A, 1)
  /**
   * Wrap i32 to i16 and store 2 bytes.
   * 
   * Stack: [i32 i32] → []
   */
  export const store16 = memoryOp(0x3B, 2)
  /**
   * Push a 32-bit integer value to the stack.
   * 
   * Stack: [] → [i32]
   */
  const const_ = (n: number = 0) => flatU8A([0x41, leb128.s32(n)])
  /**
   * Compare equal to zero.
   * 
   * Return 1 if operand is zero, 0 otherwise.
   * 
   * Stack: [i32] → [i32]
   */
  export const eqz = 0x45
  /**
   * ## ==
   * 
   * sign-agnostic compare equal
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const eq = 0x46
  /**
   * ## ≠
   * 
   * sign-agnostic compare unequal
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const ne = 0x47
  /**
   * ## <
   * 
   * signed less than
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const lt_s = 0x48
  /**
   * ## <
   * 
   * unsigned less than
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const lt_u = 0x49
  /**
   * ## >
   * 
   * signed greater than
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const gt_s = 0x4A
  /**
   * ## >
   * 
   * unsigned greater than
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const gt_u = 0x4B
  /**
   * ## ≤
   * 
   * signed less than or equal
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const le_s = 0x4C
  /**
   * ## ≤
   * 
   * unsigned less than or equal
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const le_u = 0x4D
  /**
   * ## ≥
   * 
   * signed greater than or equal
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const ge_s = 0x4E
  /**
   * ## ≥
   * 
   * unsigned greater than or equal
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const ge_u = 0x4F
  /**
   * sign-agnostic count leading zero bits
   * 
   * Return the count of leading zero bits in i.
   * All zero bits are considered leading if the value is zero.
   * 
   * Stack: [i32] → [i32]
   */
  export const clz = 0x67
  /**
   * sign-agnostic count trailing zero bits
   * 
   * Return the count of trailing zero bits in i.
   * All zero bits are considered trailing if the value is zero.
   * 
   * Stack: [i32] → [i32]
   */
  export const ctz = 0x68
  /**
   * sign-agnostic count number of one bits
   * 
   * Return the count of non-zero bits in i.
   * 
   * Stack: [i32] → [i32]
   */
  export const popcnt = 0x69
  /**
   * sign-agnostic addition
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const add = 0x6A
  /**
   * sign-agnostic subtraction
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const sub = 0x6B
  /**
   * sign-agnostic multiplication, modulo 2**<sup>32</sup>
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const mul = 0x6C
  /**
   * signed division (result is truncated toward zero)
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const div_s = 0x6D
  /**
   * unsigned division (result is floored)
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const div_u = 0x6E
  /**
   * signed remainder (result has the sign of the dividend)
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const rem_s = 0x6F
  /**
   * unsigned remainder
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const rem_u = 0x70
  /**
   * sign-agnostic bitwise <i>*and*</i>.
   * 
   * Return the bitwise conjunction of 𝑖1 and 𝑖2.
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const and = 0x71
  /**
   * sign-agnostic bitwise <i>*inclusive or*</i>.
   * 
   * Return the bitwise disjunction of 𝑖1 and 𝑖2.
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const or = 0x72
  /**
   * sign-agnostic bitwise <i>*exclusive or*</i>.
   * 
   * Return the bitwise exclusive disjunction of 𝑖1 and 𝑖2.
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const xor = 0x73
  /**
   * sign-agnostic shift left
   * 
   * Return the result of shifting i1 left by k bits, modulo 2**<sup>32</sup>
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const shl = 0x74
  /**
   * sign-replicating (arithmetic) shift right
   * 
   * Return the result of shifting i1 right by k bits,
   * extended with the most significant bit of the original value.
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const shr_s = 0x75
  /**
   * zero-replicating (logical) shift right
   * 
   * Return the result of shifting i1 right by k bits, extended with 0 bits.
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const shr_u = 0x76
  /**
   * sign-agnostic rotate left
   * 
   * Return the result of rotating i1 left by k bits.
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const rotl = 0x77
  /**
   * sign-agnostic rotate right
   * 
   * Return the result of rotating i1 right by k bits.
   * 
   * Stack: [i32 i32] → [i32]
   */
  export const rotr = 0x78
  /**
   * Wrap a 64-bit integer to a 32-bit integer.
   * 
   * Return i modulo 2**<sup>32</sup>.
   * 
   * Stack: [i64] → [i32]
   */
  export const wrap_i64 = 0xA7
  /**
   * Truncate a 32-bit float to a signed 32-bit integer.
   * 
   * Stack: [f32] → [i32]
   */
  export const trunc_f32_s = 0xA8
  /**
   * Truncate a 32-bit float to an unsigned 32-bit integer.
   * 
   * Stack: [f32] → [i32]
   */
  export const trunc_f32_u = 0xA9
  /**
   * Truncate a 64-bit float to a signed 32-bit integer.
   * 
   * Stack: [f64] → [i32]
   */
  export const trunc_f64_s = 0xAA
  /**
   * Truncate a 64-bit float to an unsigned 32-bit integer.
   * 
   * Stack: [f64] → [i32]
   */
  export const trunc_f64_u = 0xAB
  /**
   * Reinterpret the bits of a 32-bit float as a 32-bit integer.
   * 
   * Stack: [f32] → [i32]
   */
  export const reinterpret_f32 = 0xBC

  //@ts-ignore
  export { const_ as const }
  i32.const = const_

  /**
   * Divides by 3 with mul op. The input must be a multiply of 3 or else it'll be undefined behavior.
   * 
   * Stack: [i32] → [i32]
   */
  export const div3 = flatU8A([i32.const(0xAAAAAAAB >> 0), i32.mul])
}

export namespace i64 {
  export const name = 'i64'
  /**
   * The byte that represents i64.
   */
  export const type = 0x7E
  /**
   * The size of i64.
   */
  export const size = 8
  /**
   * Load 8 bytes as i64.
   * 
   * Stack: [i32] → [i64]
   * 
   * The static address offset is added to the dynamic address operand, yielding a 33 bit
   * effective address that is the zero-based index at which the memory is accessed.
   * All values are read and written in little endian byte order. A trap results if any of the
   * accessed memory bytes lies outside the address range implied by the memory's current size.
   */
  export const load = memoryOp(0x29, i64.size)
  /**
   * Load 1 byte and sign-extend i8 to i64.
   * 
   * Stack: [i32] → [i64]
   */
  export const load8_s = memoryOp(0x30, 1)
  /**
   * Load 1 byte and zero-extend i8 to i64.
   * 
   * Stack: [i32] → [i64]
   */
  export const load8_u = memoryOp(0x31, 1)
  /**
   * Load 2 bytes and sign-extend i16 to i64.
   * 
   * Stack: [i32] → [i64]
   */
  export const load16_s = memoryOp(0x32, 2)
  /**
   * Load 2 bytes and zero-extend i16 to i64.
   * 
   * Stack: [i32] → [i64]
   */
  export const load16_u = memoryOp(0x33, 2)
  /**
   * Load 4 bytes and sign-extend i16 to i64.
   * 
   * Stack: [i32] → [i64]
   */
  export const load32_s = memoryOp(0x34, 4)
  /**
   * Load 4 bytes and zero-extend i16 to i64.
   * 
   * Stack: [i32] → [i64]
   */
  export const load32_u = memoryOp(0x35, 4)
  /**
   * Store 8 bytes (no conversion).
   * 
   * Stack: [i32 i64] → []
   */
  export const store = memoryOp(0x37, i64.size)
  /**
   * Wrap i64 to i8 and store 1 byte.
   * 
   * Stack: [i32 i64] → []
   */
  export const store8 = memoryOp(0x3C, 1)
  /**
   * Wrap i64 to i16 and store 2 bytes.
   * 
   * Stack: [i32 i64] → []
   */
  export const store16 = memoryOp(0x3D, 2)
  /**
   * Wrap i64 to i32 and store 4 bytes.
   * 
   * Stack: [i32 i64] → []
   */
  export const store32 = memoryOp(0x3E, 4)
  /**
   * Push a 64-bit integer value to the stack.
   * 
   * Stack: [] → [i64]
   */
  const const_ = (n: number | bigint = 0n) => flatU8A([0x42, leb128.s64(n)])
  /**
   * Compare equal to zero.
   * 
   * Return 1 if operand is zero, 0 otherwise.
   * 
   * Stack: [i64] → [i32]
   */
  export const eqz = 0x50
  /**
   * ## ==
   * 
   * sign-agnostic compare equal
   * 
   * Stack: [i64 i64] → [i32]
   */
  export const eq = 0x51
  /**
   * ## ≠
   * 
   * sign-agnostic compare unequal
   * 
   * Stack: [i64 i64] → [i32]
   */
  export const ne = 0x52
  /**
   * ## <
   * 
   * signed less than
   * 
   * Stack: [i64 i64] → [i32]
   */
  export const lt_s = 0x53
  /**
   * ## <
   * 
   * unsigned less than
   * 
   * Stack: [i64 i64] → [i32]
   */
  export const lt_u = 0x54
  /**
   * ## >
   * 
   * signed greater than
   * 
   * Stack: [i64 i64] → [i32]
   */
  export const gt_s = 0x55
  /**
   * ## >
   * 
   * unsigned greater than
   * 
   * Stack: [i64 i64] → [i32]
   */
  export const gt_u = 0x56
  /**
   * ## ≤
   * 
   * signed less than or equal
   * 
   * Stack: [i64 i64] → [i32]
   */
  export const le_s = 0x57
  /**
   * ## ≤
   * 
   * unsigned less than or equal
   * 
   * Stack: [i64 i64] → [i32]
   */
  export const le_u = 0x58
  /**
   * ## ≥
   * 
   * signed greater than or equal
   * 
   * Stack: [i64 i64] → [i32]
   */
  export const ge_s = 0x59
  /**
   * ## ≥
   * 
   * unsigned greater than or equal
   * 
   * Stack: [i64 i64] → [i32]
   */
  export const ge_u = 0x5A
  /**
   * sign-agnostic count leading zero bits
   * 
   * Return the count of leading zero bits in i.
   * All zero bits are considered leading if the value is zero.
   * 
   * Stack: [i64] → [i64]
   */
  export const clz = 0x79
  /**
   * sign-agnostic count trailing zero bits
   * 
   * Return the count of trailing zero bits in i.
   * All zero bits are considered trailing if the value is zero.
   * 
   * Stack: [i64] → [i64]
   */
  export const ctz = 0x7A
  /**
   * sign-agnostic count number of one bits
   * 
   * Return the count of non-zero bits in i.
   * 
   * Stack: [i64] → [i64]
   */
  export const popcnt = 0x7B
  /**
   * sign-agnostic addition
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const add = 0x7C
  /**
   * sign-agnostic subtraction
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const sub = 0x7D
  /**
   * sign-agnostic multiplication, modulo 2**<sup>64</sup>
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const mul = 0x7E
  /**
   * signed division (result is truncated toward zero)
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const div_s = 0x7F
  /**
   * unsigned division (result is floored)
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const div_u = 0x80
  /**
   * signed remainder (result has the sign of the dividend)
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const rem_s = 0x81
  /**
   * unsigned remainder
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const rem_u = 0x82
  /**
   * sign-agnostic bitwise <i>*and*</i>.
   * 
   * Return the bitwise conjunction of 𝑖1 and 𝑖2.
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const and = 0x83
  /**
   * sign-agnostic bitwise <i>*inclusive or*</i>.
   * 
   * Return the bitwise disjunction of 𝑖1 and 𝑖2.
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const or = 0x84
  /**
   * sign-agnostic bitwise <i>*exclusive or*</i>.
   * 
   * Return the bitwise exclusive disjunction of 𝑖1 and 𝑖2.
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const xor = 0x85
  /**
   * sign-agnostic shift left
   * 
   * Return the result of shifting i1 left by k bits, modulo 2**<sup>64</sup>
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const shl = 0x86
  /**
   * sign-replicating (arithmetic) shift right
   * 
   * Return the result of shifting i1 right by k bits,
   * extended with the most significant bit of the original value.
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const shr_s = 0x87
  /**
   * zero-replicating (logical) shift right
   * 
   * Return the result of shifting i1 right by k bits, extended with 0 bits.
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const shr_u = 0x88
  /**
   * sign-agnostic rotate left
   * 
   * Return the result of rotating i1 left by k bits.
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const rotl = 0x89
  /**
   * sign-agnostic rotate right
   * 
   * Return the result of rotating i1 right by k bits.
   * 
   * Stack: [i64 i64] → [i64]
   */
  export const rotr = 0x8A
  /**
   * Extend a signed 32-bit integer to a 64-bit integer.
   * 
   * Stack: [i32] → [i64]
   */
  export const extend_i32_s = 0xAC
  /**
   * Extend an unsigned 32-bit integer to a 64-bit integer.
   * 
   * Stack: [i32] → [i64]
   */
  export const extend_i32_u = 0xAD
  /**
   * Truncate a 32-bit float to a signed 64-bit integer.
   * 
   * Stack: [f32] → [i64]
   */
  export const trunc_f32_s = 0xAE
  /**
   * Truncate a 32-bit float to an unsigned 64-bit integer.
   * 
   * Stack: [f32] → [i64]
   */
  export const trunc_f32_u = 0xAF
  /**
   * Truncate a 64-bit float to a signed 64-bit integer.
   * 
   * Stack: [f64] → [i64]
   */
  export const trunc_f64_s = 0xB0
  /**
   * Truncate a 64-bit float to an unsigned 64-bit integer.
   * 
   * Stack: [f64] → [i64]
   */
  export const trunc_f64_u = 0xB1
  /**
   * Reinterpret the bits of a 64-bit float as a 64-bit integer.
   * 
   * Stack: [f64] → [i64]
   */
  export const reinterpret_f64 = 0xBD

  //@ts-ignore
  export { const_ as const }
  i64.const = const_
}

export namespace f32 {
  export const name = 'f32'
  /**
   * The byte that represents f32.
   */
  export const type = 0x7D
  /**
   * The size of f32.
   */
  export const size = 4
  const buf = new Float32Array(1)
  const bufu8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  function toBytes(num: number) {
    buf[0] = num
    return bufu8.slice()
  }

  /**
   * Load 4 bytes as f32.
   * 
   * Stack: [i32] → [f32]
   * 
   * Note: When a number is stored into memory, it is converted into a sequence
   * of bytes in little endian byte order.
   */
  export const load = memoryOp(0x2A, f32.size)
  /**
   * Store 4 bytes (no conversion).
   * 
   * Stack: [i32 f32] → []
   */
  export const store = memoryOp(0x38, f32.size)
  /**
   * Push a 32-bit float value to the stack.
   * 
   * Stack: [] → [f32]
   */
  const const_ = (z: number = 0) => flatU8A([0x43, toBytes(z)])
  /**
   * ## ==
   * 
   * compare equal
   * 
   * Stack: [f32 f32] → [i32]
   */
  export const eq = 0x5B
  /**
   * ## ≠
   * 
   * compare unordered or unequal
   * 
   * Stack: [f32 f32] → [i32]
   */
  export const ne = 0x5C
  /**
   * ## <
   * 
   * less than
   * 
   * Stack: [f32 f32] → [i32]
   */
  export const lt = 0x5D
  /**
   * ## >
   * 
   * greater than
   * 
   * Stack: [f32 f32] → [i32]
   */
  export const gt = 0x5E
  /**
   * ## ≤
   * 
   * less than or equal
   * 
   * Stack: [f32 f32] → [i32]
   */
  export const le = 0x5F
  /**
   * ## ≥
   * 
   * greater than or equal
   * 
   * Stack: [f32 f32] → [i32]
   */
  export const ge = 0x60
  /**
   * absolute value
   * 
   * Stack: [f32] → [f32]
   */
  export const abs = 0x8B
  /**
   * negation
   * 
   * Stack: [f32] → [f32]
   */
  export const neg = 0x8C
  /**
   * ceiling operator
   * 
   * Stack: [f32] → [f32]
   */
  export const ceil = 0x8D
  /**
   * floor operator
   * 
   * Stack: [f32] → [f32]
   */
  export const floor = 0x8E
  /**
   * round to nearest integer towards zero
   * 
   * Stack: [f32] → [f32]
   */
  export const trunc = 0x8F
  /**
   * round to nearest integer, ties to even
   * 
   * Stack: [f32] → [f32]
   */
  export const nearest = 0x90
  /**
   * square root
   * 
   * Stack: [f32] → [f32]
   */
  export const sqrt = 0x91
  /**
   * addition
   * 
   * Stack: [f32 f32] → [f32]
   */
  export const add = 0x92
  /**
   * subtraction
   * 
   * Stack: [f32 f32] → [f32]
   */
  export const sub = 0x93
  /**
   * multiplication
   * 
   * Stack: [f32 f32] → [f32]
   */
  export const mul = 0x94
  /**
   * division
   * 
   * partial function: division by 0 is undefined
   * 
   * Stack: [f32 f32] → [f32]
   */
  export const div = 0x95
  /**
   * minimum (binary operator); if either operand is NaN, returns NaN
   * 
   * Stack: [f32 f32] → [f32]
   */
  export const min = 0x96
  /**
   * maximum (binary operator); if either operand is NaN, returns NaN
   * 
   * Stack: [f32 f32] → [f32]
   */
  export const max = 0x97
  /**
   * If z1 and z2 have the same sign, then return z1. Else return z1 with negated sign.
   * 
   * Stack: [f32 f32] → [f32]
   */
  export const copysign = 0x98
  /**
   * Convert a signed 32-bit integer to a 32-bit float.
   * 
   * Stack: [i32] → [f32]
   */
  export const convert_i32_s = 0xB2
  /**
   * Convert an unsigned 32-bit integer to a 32-bit float.
   * 
   * Stack: [i32] → [f32]
   */
  export const convert_i32_u = 0xB3
  /**
   * Convert a signed 64-bit integer to a 32-bit float.
   * 
   * Stack: [i64] → [f32]
   */
  export const convert_i64_s = 0xB4
  /**
   * Convert an unsigned 64-bit integer to a 32-bit float.
   * 
   * Stack: [i64] → [f32]
   */
  export const convert_i64_u = 0xB5
  /**
   * Demote a 64-bit float to a 32-bit float.
   * 
   * Stack: [f64] → [f32]
   */
  export const demote_f64 = 0xB6
  /**
   * Reinterpret the bits of a 32-bit integer as a 32-bit float.
   * 
   * Stack: [i32] → [f32]
   */
  export const reinterpret_i32 = 0xBE

  //@ts-ignore
  export { const_ as const }
  f32.const = const_
}

export namespace f64 {
  export const name = 'f64'
  /**
   * The byte that represents f64.
   */
  export const type = 0x7C
  /**
   * The size of f64.
   */
  export const size = 8
  const buf = new Float64Array(1)
  const bufu8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  function toBytes(num: number) {
    buf[0] = num
    return bufu8.slice()
  }

  /**
   * Load 8 bytes as f64.
   * 
   * Stack: [i32] → [f64]
   */
  export const load = memoryOp(0x2B, f64.size)
  /**
   * Store 8 bytes (no conversion).
   * 
   * Stack: [i32 f64] → []
   */
  export const store = memoryOp(0x39, f64.size)
  /**
   * Push a 64-bit float value to the stack.
   * 
   * Stack: [] → [f64]
   */
  const const_ = (z: number = 0) => flatU8A([0x44, toBytes(z)])
  /**
   * ## ==
   * 
   * compare equal
   * 
   * Stack: [f64 f64] → [i32]
   */
  export const eq = 0x61
  /**
   * ## ≠
   * 
   * compare unordered or unequal
   * 
   * Stack: [f64 f64] → [i32]
   */
  export const ne = 0x62
  /**
   * ## <
   * 
   * less than
   * 
   * Stack: [f64 f64] → [i32]
   */
  export const lt = 0x63
  /**
   * ## >
   * 
   * greater than
   * 
   * Stack: [f64 f64] → [i32]
   */
  export const gt = 0x64
  /**
   * ## ≤
   * 
   * less than or equal
   * 
   * Stack: [f64 f64] → [i32]
   */
  export const le = 0x65
  /**
   * ## ≥
   * 
   * greater than or equal
   * 
   * Stack: [f64 f64] → [i32]
   */
  export const ge = 0x66
  /**
   * absolute value
   * 
   * Stack: [f64] → [f64]
   */
  export const abs = 0x99
  /**
   * negation
   * 
   * Stack: [f64] → [f64]
   */
  export const neg = 0x9A
  /**
   * ceiling operator
   * 
   * Stack: [f64] → [f64]
   */
  export const ceil = 0x9B
  /**
   * floor operator
   * 
   * Stack: [f64] → [f64]
   */
  export const floor = 0x9C
  /**
   * round to nearest integer towards zero
   * 
   * Stack: [f64] → [f64]
   */
  export const trunc = 0x9D
  /**
   * round to nearest integer, ties to even
   * 
   * Stack: [f64] → [f64]
   */
  export const nearest = 0x9E
  /**
   * square root
   * 
   * Stack: [f64] → [f64]
   */
  export const sqrt = 0x9F
  /**
   * addition
   * 
   * Stack: [f64 f64] → [f64]
   */
  export const add = 0xA0
  /**
   * subtraction
   * 
   * Stack: [f64 f64] → [f64]
   */
  export const sub = 0xA1
  /**
   * multiplication
   * 
   * Stack: [f64 f64] → [f64]
   */
  export const mul = 0xA2
  /**
   * division
   * 
   * partial function: division by 0 is undefined
   * 
   * Stack: [f64 f64] → [f64]
   */
  export const div = 0xA3
  /**
   * minimum (binary operator); if either operand is NaN, returns NaN
   * 
   * Stack: [f64 f64] → [f64]
   */
  export const min = 0xA4
  /**
   * maximum (binary operator); if either operand is NaN, returns NaN
   * 
   * Stack: [f64 f64] → [f64]
   */
  export const max = 0xA5
  /**
   * If z1 and z2 have the same sign, then return z1. Else return z1 with negated sign.
   * 
   * Stack: [f64 f64] → [f64]
   */
  export const copysign = 0xA6
  /**
   * Convert a signed 32-bit integer to a 64-bit float.
   * 
   * Stack: [i32] → [f64]
   */
  export const convert_i32_s = 0xB7
  /**
   * Convert an unsigned 32-bit integer to a 64-bit float.
   * 
   * Stack: [i32] → [f64]
   */
  export const convert_i32_u = 0xB8
  /**
   * Convert a signed 64-bit integer to a 64-bit float.
   * 
   * Stack: [i64] → [f64]
   */
  export const convert_i64_s = 0xB9
  /**
   * Convert an unsigned 64-bit integer to a 64-bit float.
   * 
   * Stack: [i64] → [f64]
   */
  export const convert_i64_u = 0xBA
  /**
   * Promote a 32-bit float to a 64-bit float.
   * 
   * Stack: [f32] → [f64]
   */
  export const promote_f32 = 0xBB
  /**
   * Reinterpret the bits of a 64-bit integer as a 64-bit float.
   * 
   * Stack: [i64] → [f64]
   */
  export const reinterpret_i64 = 0xBF

  //@ts-ignore
  export { const_ as const }
  f64.const = const_
}

export namespace memory {
  /**
   * The <b>memory.size</b> instruction returns the current size of a memory.
   * 
   * Operates in units of page size. Each page is 65,536 bytes (64KB).
   * 
   * Stack: [] → [i32]
   */
  export const size = 0x3F
  /**
   * The memory.grow instruction grows memory by a given delta and returns the
   * previous size, or -1 if enough memory cannot be allocated.
   * 
   * Operates in units of page size. Each page is 65,536 bytes (64KB).
   * 
   * Stack: [i32] → [i32]
   */
  export const grow = 0x40
}

export const typeToDefinition = {
  [i32.type]: i32,
  [i64.type]: i64,
  [f32.type]: f32,
  [f64.type]: f64,
}

export type ValueType = typeof i32.type | typeof i64.type | typeof f32.type | typeof f64.type;
export type TypeToName<T extends ValueType> =
  T extends typeof i32.type ? 'i32' :
  T extends typeof i64.type ? 'i64' :
  T extends typeof f32.type ? 'f32' :
  T extends typeof f64.type ? 'f64' :
  never
;
export type ValueTypeName = TypeToName<ValueType>;

function memoryOp(opcode: number, defaultAlign: number) {
  return (offset: number | bigint = 0, align = defaultAlign) => {
    if (align <= 0 || (align & (align - 1)) !== 0) {
      throw new Error(`Alignment must be a power of two (${align})`)
    }
    if (align > defaultAlign) {
      throw new Error(`Alignment cannot be larger than the byte width of the value (${align} > ${defaultAlign})`)
    }
    return flatU8A([opcode, leb128.u32(Math.log2(align)), leb128.u64(offset)])
  }
}

function encodeStr(str: string) {
  return lengthed(textEncoder.encode(str))
}

function lengthed(arr: Uint8Array): [Uint8Array, Uint8Array] {
  return [leb128.u32(arr.length), arr]
}

function vec<T>(source: readonly T[], mapper: (element: T, index: number) => DeepU8Arr | Uint8Array): Uint8Array {
  return flatU8A([leb128.u32(source.length), source.map(mapper)])
}
