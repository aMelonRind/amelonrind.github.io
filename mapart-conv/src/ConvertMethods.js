import BlockImage from "./BlockImage.js"
import Form from "./Form.js"
import MainContext from "./MainContext.js"
import { ITask } from "./TaskManager.js"

export default class ConvertMethod {
  /** @readonly @type {Map<string, ConvertMethod>} */
  static methods = new Map()
  /** @readonly */ name
  /** @readonly */ canRun
  /** @readonly */ action

  static getList(ctx = MainContext.getCurrent()) {
    const res = []
    for (const m of this.methods.values()) {
      if (m.canRun(ctx)) {
        res.push(m)
      }
    }
    return res.sort()
  }

  /**
   * @param {string} name 
   */
  static has(name) {
    return this.methods.has(name)
  }

  /**
   * @param {string} name 
   * @param {ITask} [task] 
   * @param {MainContext?} [ctx] 
   */
  static async run(name, task = ITask.DUMMY, ctx = MainContext.getCurrent()) {
    const m = this.methods.get(name)
    if (!m || !m.canRun(ctx)) {
      throw new Error(`Convert method ${name} doesn't exist.`)
    }
    return await m.action(task, ctx)
  }

  /**
   * @param {{
   *  name: string;
   *  canRun?: (this: ConvertMethod, ctx: MainContext?) => any;
   *  action: (this: ConvertMethod, task: ITask, ctx: MainContext?) => Promise<any>
   * }} def 
   */
  constructor ({ name, canRun = ctx => ctx != null, action }) {
    if (ConvertMethod.methods.has(name)) {
      throw new Error(`Convert method ${JSON.stringify(name)} already exists.`)
    }
    canRun = canRun.bind(this)
    action = action.bind(this)
    this.name = name
    this.canRun = canRun
    this.action = action
    ConvertMethod.methods.set(name, this)
  }
  
  /**
   * @param {number} r 0..255
   * @param {number} g 0..255
   * @param {number} b 0..255
   * @param {number} a 0..255
   */
  getNearest(r, g, b, a) {
    return BlockImage.colorProfile.rmean_near(r, g, b, a)
    // if (a < 128) return 0
    // let nearest = 1
    // let dist = Infinity
    // for (let i = 4 * 3; i < 61 * 4 * 3; i += 3) {
    //   const dg = BlockImage.colors[i + 1] - g
    //   let d = 4 * dg * dg
    //   if (d >= dist) continue
    //   const rmean = (BlockImage.colors[i] + r) / 2
    //   const dr = BlockImage.colors[i] - r
    //   const wr = 2 + rmean / 256
    //   d += wr * dr * dr
    //   if (d >= dist) continue
    //   const db = BlockImage.colors[i + 2] - b
    //   const wb = 2 + (255 - rmean) / 256
    //   d += wb * db * db
    //   if (d < dist) {
    //     dist = d
    //     nearest = i / 3
    //   }
    // }
    // return nearest
  }

  toString() {
    return `ConvertMethod: { name: ${this.name} }`
  }

}

new ConvertMethod({
  name: 'nearest',
  canRun: ctx => ctx && !ctx.base.isBlock(),
  async action(task, ctx) {
    if (!ctx) return
    await Form.send('nearest', {}, {
      title: 'Convert Method: Nearest',
      description: 'Convert each pixel to their nearest color in mapart palette using rmean.'
    })
    const img = ctx.getImageData()
    await task.swap('Converting pixels')
    const abgrArr = new Int32Array(img.data.buffer, img.data.byteOffset, img.width * img.height)
    const bytes = BlockImage.colorProfile.convert_nearest(abgrArr)
    ctx.base = new BlockImage(img.width, img.height, bytes).inheritFrom(ctx.base)
  }
})

// new ConvertMethod({
//   name: '[dev] rebane 2d palette hash gen',
//   canRun: ctx => ctx?.isTrueColor() && Number.isInteger(ctx.base.getWidth() / 32) && Number.isInteger(ctx.base.getHeight() / 32),
//   async action(task, ctx) {
//     if (!ctx) return
//     const img = ctx.getImageData()
//     // accepts something like ../img/rebaneBlocks.png
//     const w = img.width / 32
//     const h = img.height / 32
//     if (!Number.isInteger(w) || !Number.isInteger(h)) {
//       Form.send('devRebaneHashGen', {}, {
//         title: 'Not a multiply of 32',
//         description: `${img.width}x${img.height} (${w.toFixed(2)}x${h.toFixed(2)})`,
//         noCancel: true
//       })
//       return
//     }
//     const rctx = requireNonNull(new OffscreenCanvas(img.width, img.height).getContext('2d'))
//     {
//       const orig = new OffscreenCanvas(img.width, img.height)
//       orig.getContext('2d')?.putImageData(img, 0, 0)
//       rctx.fillStyle = '#000000'
//       rctx.fillRect(0, 0, img.width, img.height)
//       rctx.drawImage(orig, 0, 0)
//     }
//     const opaqueData = rctx.getImageData(0, 0, img.width, img.height).data
//     const w32 = w * 32
//     const row = w32 * 32
//     const abgrArr = new Uint32Array(opaqueData.buffer, opaqueData.byteOffset, row * h)
//     const hashSampleIndexes = Uint32Array.of(
//       // y should be ranged between 8..19 to avoid shadow and text.
//        8 * w32 + 20, // grass variants
//       16 * w32, // logs and stripped logs
//       16 * w32 + 15, // universal
//       16 * w32 + 16, // cobweb and candle
//     )
//     /** @type {Uint32Array[]} */
//     const hashSamples = new Array(h + 1)
//     { // full black hash
//       let hash = 5
//       for (const _ of hashSampleIndexes) {
//         hash = ((hash << 5) - hash + 0xFF000000) | 0
//       }
//       hashSamples[0] = Uint32Array.of(hash)
//       console.log(`Empty hash: ${hashSamples[0][0].toString(16)}`)
//     }
//     for (let y = 0; y < h; y++) {
//       const ly = y * row
//       /** @type {Set<number>} */
//       const set = new Set()
//       let count = 0
//       for (let x = 0; x < w; x++) {
//         const f = ly + x * 32
//         let hash = 5
//         let empty = true
//         for (const j of hashSampleIndexes) {
//           const abgr = abgrArr[f + j]
//           if (abgr == null) throw 'wtf'
//           empty &&= abgr === 0xFF000000
//           hash = ((hash << 5) - hash + abgr) | 0
//         }
//         if (empty) continue
//         set.add(hash)
//         count++
//       }
//       if (set.size !== count) {
//         // should avoid by hashing more sample, duplicate images can be ignored like leaves.
//         // more precisely, top right and bottom right corner should be the same for shadow detection
//         const s = `y${y}: (${count - set.size} / ${count})`
//         if (![
//           'y6: (5 / 8)', // 1:1
//           'y41: (1 / 3)', // 1:1
//           'y42: (1 / 4)', // 1:1
//           'y8: (1 / 10)', // corners
//         ].includes(s)) {
//           console.log(`There was some conflicting hash for ${s}`)
//         }
//       }
//       hashSamples[y + 1] = Uint32Array.from(set).sort((a, b) => a - b)
//     }
//     const sizeSum = hashSamples.map(v => v.length).reduce((p, v) => p + v)
//     const tempSet = new Set()
//     for (const a of hashSamples) {
//       for (const v of a) {
//         if (tempSet.has(v)) {
//           console.log(v.toString(16))
//         } else {
//           tempSet.add(v)
//         }
//       }
//     }
//     console.log(`Unique Hashes: (${tempSet.size} / ${sizeSum})`)
//     if (tempSet.size < sizeSum) {
//       console.log('Please resolve duplicate hash.')
//       return
//     }
//     tempSet.clear()
//     const sorted = hashSamples
//       .flatMap((arr, y) => Array.from(arr, /** @returns {[hash: number, y: number]} */ hash => [hash, y]))
//       .sort((a, b) => a[0] - b[0])
//     const hashes = Uint32Array.from(sorted.map(([hash]) => hash))
//     const indexes = Uint8Array.from(sorted.map(([, y]) => y))
//     const topSample = new Uint32Array(hashes.length)
//     const bottomSample = new Uint32Array(hashes.length)
//     const topSIndex = 32 - 1
//     const bottomSIndex = w32 * 31 + 32 - 1
//     let dirty = false
//     for (const [i, hash] of hashes.entries()) {
//       const ly = (indexes[i] - 1) * row
//       if (ly < 0) {
//         topSample[i] = 0xFF000000
//         bottomSample[i] = 0xFF000000
//         continue
//       }
//       /** @type {number?} */
//       let found = null
//       for (let x = 0; x < w; x++) {
//         const f = ly + x * 32
//         let subhash = 5
//         for (const j of hashSampleIndexes) {
//           const abgr = abgrArr[f + j]
//           if (abgr == null) throw 'wtf'
//           subhash = ((subhash << 5) - subhash + abgr) | 0
//         }
//         if ((subhash >>> 0) === hash) {
//           if (found == null) {
//             topSample[i] = abgrArr[f + topSIndex]
//             bottomSample[i] = abgrArr[f + bottomSIndex]
//             found = x
//           } else if (topSample[i] !== abgrArr[f + topSIndex] || bottomSample[i] !== abgrArr[f + bottomSIndex]) {
//             console.log(`Corner sample doesn't match! y: ${indexes[i] - 1}, hash: ${hash.toString(16)}, x1: ${found}, x2:${x}`)
//             console.log(`${[topSample[i], abgrArr[f + topSIndex], bottomSample[i], abgrArr[f + bottomSIndex]].map(v => v.toString(16)).join(', ')}`)
//             dirty = true
//           }
//         }
//       }
//     }
//     if (dirty) {
//       console.log('Please resolve unmatched corners.')
//       return
//     }
//     if (topSample.some(v => v === 0) || bottomSample.some(v => v === 0)) {
//       console.log('There are some missing corner samples!')
//     }
//     if (topSample.some(v => v === 0xFF000020) || bottomSample.some(v => v === 0xFF000020)) {
//       console.log('There are some corner sample overlaps with shadow color!')
//     }
//     for (let i = 0; i < indexes.length; i++) {
//       const v = indexes[i]
//       indexes[i] = BlockPalette._unusualIndexDict[v - 1] ?? v
//     }
//     let hash = 0
//     for (const v of [...indexes, ...hashes, ...topSample, ...bottomSample, hashes.length]) {
//       hash = ((hash << 5) - hash + v) | 0
//     }
//     hash = Uint32Array.of(hash)[0]
//     console.log(`Hash sum: ${hash.toString(16)}`) // d61a2259
//     // result {hashes, indexes, topSample, bottomSample}
//     downloadBlob('rebane2dHashes.json', new TextEncoder().encode(`{
//       "hashes":[${hashes.join(',')}],
//       "indexes":[${indexes.join(',')}],
//       "topSample":[${topSample.map(v => v & 0xFFFFFF).join(',')}],
//       "bottomSample":[${bottomSample.map(v => v & 0xFFFFFF).join(',')}]
//     }`.replace(/\n\s+/g, '')))
//   }
// })

{
  const loader = import("./data/rebane2dHashes.json", { with: { type: "json" } }).then(({default: json}) => ({
    hashes: Uint32Array.from(json.hashes),
    indexes: Uint8Array.from(json.indexes).map(v => v * 4),
    topSample: Uint32Array.from(json.topSample),
    bottomSample: Uint32Array.from(json.bottomSample),
  }))
  new ConvertMethod({
    name: 'restore from rebane 2d view',
    canRun: ctx => ctx?.isTrueColor() && Number.isInteger(ctx.base.getWidth() / 33) && Number.isInteger(ctx.base.getHeight() / 33),
    async action(task, ctx) {
      if (!ctx) return
      await Form.send('rebane2dRestore', {}, {
        title: 'Convert Method: Restore from rebane 2d view',
        description: 'Restores the mapart from rebane 2d view image.\nExample:',
        image: './img/rebane2dViewExample.png'
      })
      const { hashes, indexes, topSample, bottomSample } = await loader
      const img = ctx.getImageData()
      const w = img.width / 33
      const h = img.height / 33
      if (!Number.isInteger(w) || !Number.isInteger(h)) {
        Form.send('rebane2dRestore.33', {}, {
          title: 'Not a multiply of 33',
          description: `${img.width}x${img.height} (${w.toFixed(2)}x${h.toFixed(2)})`,
          noCancel: true
        })
        return
      }
      const w33 = w * 33
      const row = w33 * 33
      const abgrArr = new Uint32Array(img.data.buffer, img.data.byteOffset, row * h)
      const hashSampleIndexes = Uint32Array.of(
        // copied from above
         8 * w33 + 20, // grass variants
        16 * w33, // logs and stripped logs
        16 * w33 + 15, // universal
        16 * w33 + 16, // cobweb and candle
      )
      const topSIndex = 32 - 1
      const bottomSIndex = w33 * 31 + 32 - 1
      const bytes = new Uint8Array(w * h)
      const u32 = new Uint32Array(1)
      let unk = 0
      for (let x = 0, xi = 0; x < w; x++, xi += 33) {
        let upShadow = false
        for (let i = x, ii = xi; i < bytes.length; i += w, ii += row) {
          let hash = 5
          for (const j of hashSampleIndexes) {
            const abgr = abgrArr[ii + j]
            hash = ((hash << 5) - hash + abgr) | 0
          }
          u32[0] = hash
          const hi = hashes.indexOf(u32[0])
          if (hi === -1) {
            unk++
            upShadow = false
            continue
          }
          bytes[i] = indexes[hi]
          if ((abgrArr[ii + topSIndex] & 0xFFFFFF) === topSample[hi]) {
            bytes[i] += upShadow ? 2 : 1
          }
          upShadow = (abgrArr[ii + bottomSIndex] & 0xFFFFFF) !== bottomSample[hi]
        }
      }
      if (Number.isInteger(w / 128) && Number.isInteger((h - 1) / 128)) {
        ctx.base = new BlockImage(w, h - 1, bytes.subarray(w)).inheritFrom(ctx.base)
      } else {
        ctx.base = new BlockImage(w, h, bytes).inheritFrom(ctx.base)
      }
      if (unk) {
        Form.send('rebane2dRestore.nfr', {}, {
          title: 'Not Fully Restored',
          description: `The converter was unable to restore some pixels. They're left with transparent. `
          + `The pixels below them are probably affected too. (${unk}/${w * h}) (${(unk / (w * h)).toFixed(2)}%)`,
          noCancel: true
        })
      }
    }
  })
}
