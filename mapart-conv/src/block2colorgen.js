
function jsmBlocks2ColorGen() {
  Chat.log('dumping map colors...')
  /** @type {Record<string, number | { if: string, is: string, then: number, else: number }>} */
  const res = {}
  /** @type {JavaMap<BlockStateHelper, number>} */
  const tempMap = JavaUtils.createHashMap()
  /** @type {JavaSet<number>} */
  const tempSet = JavaUtils.createHashSet()
  for (const block of Client.getRegisteredBlocks()) {
    const id = block.getId()
    if (!id.startsWith('minecraft:')) continue
    tempMap.clear()
    for (const state of block.getStates()) {
      tempMap.put(state, state.getRaw().method_26205(null, null).field_16021)
    }
    tempSet.clear()
    tempSet.addAll(tempMap.values())
    if (tempSet.size() === 1) {
      res[id.slice(10)] = tempSet.iterator().next()
    } else if (!tempSet.isEmpty()) {
      const pred = {
        if: '',
        is: '',
        then: 0,
        else: 0
      }
      if (tempSet.size() === 2) {
        let notFound = false
        if (id.endsWith('_bed')) {
          pred.if = 'part'
          pred.is = 'foot'
          ;[pred.then, pred.else] = find(u => u.getBedPart() === 'foot')
        } else if (id.endsWith('_log') || id === 'minecraft:bamboo_block') {
          pred.if = 'axis'
          pred.is = 'y'
          ;[pred.then, pred.else] = find(u => u.getAxis() === 'y')
        } else if (id === 'minecraft:barrier' || id === 'minecraft:light') {
          pred.if = 'waterlogged'
          pred.is = 'true'
          ;[pred.then, pred.else] = find(u => u.isWaterlogged())
        } else {
          notFound = true
        }
        if (!notFound) {
          res[id.slice(10)] = pred
          continue
        }
        /**
         * @param {(states: UniversalBlockStateHelper) => boolean} predicate 
         * @returns {[number, number]}
         */
        function find(predicate) {
          /** @type {[number, number]} */
          const res = [NaN, NaN]
          for (const [state, color] of tempMap.entries()) {
            if (predicate(state.getUniversal())) {
              res[0] = color
              if (!isNaN(res[1])) return res
            } else {
              res[1] = color
              if (!isNaN(res[0])) return res
            }
          }
          notFound = true
          return res
        }
      }
      Chat.log(`Can't dump multi color for ${id}.`)
    }
  }
  Utils.copyToClipboard(JSON.stringify(Object.fromEntries(Object.entries(res).sort()), undefined, '  '))
  Chat.log('copied.')
}
jsmBlocks2ColorGen()
