//@ts-check
/// <reference path = "./ClickableMatrix.js"/>
/// <reference path = "./Matrix.js"/>

const defaultBaseCost = [
  [ 15 ],
  [  0, 20 ],
  [ 10,  0, 30 ],
  [ 15, 20,  0, 35 ],
  [  0,  5, 15,  0, 40 ],
  [  0,  0,  5, 15,  0, 40 ],
  [  0,  0,  0,  5, 15,  0, 40 ],
  [  0,  0,  0,  0, 10, 15,  0, 50 ]
]
const equipments = [ '帽', '手', '靴', '背', '徽', '髮', '護', '錶', '鍊' ]
const half = 6
const defaultMaxTier = 9

const maxTierInput = checkType(document.getElementById('maxTier'), HTMLInputElement, "Can't find maxTier input element")
const halfRelBox = checkType(document.getElementById('halfReleased'), HTMLInputElement, "Can't find halfReleased checkbox element")

const tiers = new Array((Math.max(parseInt(maxTierInput.value), defaultMaxTier) || defaultMaxTier) - 1).fill(0).map(((_, i) => `T${i + 2}`))
const baseCostMatrix = new Matrix('baseCost', 'target\\material', false, true, tiers, tiers, undefined, (data, m) => {
  for (const [r, line] of data.entries()) {
    for (const [c, v] of line.entries()) {
      if (v % 5) {
        m.setMessage(`Not divisible by 5 at ${r + 1}:${c + 1}`, 'yellow')
        return
      }
    }
  }
}, defaultBaseCost)
const stackedCostMatrix = new Matrix('stackedCost', 'target\\material', true, true, tiers, tiers)
const countsMatrix = new ClickableMatrix('counts', "input students' equipment counts here\nuse mouse left and right button, press shift for 10x\n\ntype\\count", ['T1', ...tiers], equipments)
const requiredBlueprintsMatrix = new Matrix('requiredBlueprints', 'type\\tier', true, true, tiers, equipments)
const currentBlueprintsMatrix = new Matrix('currentBlueprints', 'type\\tier', false, true, tiers, equipments)
const requiredMinusCurrentMatrix = new Matrix('requiredMinusCurrent', 'type\\tier', true, true, tiers, equipments)
maxTierInput.onblur = calculateStats
halfRelBox.onchange = calculateStats
baseCostMatrix.onChange = calculateStats
countsMatrix.onChange = calculateStats
currentBlueprintsMatrix.onChange = calculateStats
calculateStats()

function calculateStats() {
  const maxTier = Math.max(parseInt(maxTierInput.value), defaultMaxTier) || defaultMaxTier
  maxTierInput.valueAsNumber = maxTier
  if (maxTier !== tiers.length + 1) {
    tiers.length = maxTier - 1
    for (let i = 0; i < maxTier - 1; i++) {
      tiers[i] = `T${i + 2}`
    }
    countsMatrix.cols = ['T1', ...tiers]
    baseCostMatrix.write()
    countsMatrix.write()
    currentBlueprintsMatrix.write()
  }

  const baseCost = baseCostMatrix.data
  /** @type {number[][]} */
  const stackedCost = []
  stackedCost[tiers.length - 1] = baseCost[tiers.length - 1].slice()
  for (let i = tiers.length - 2; i >= 0; i--) {
    stackedCost[i] = stackedCost[i + 1].map((v, j) => v + (baseCost[i][j] || 0))
  }
  const stackedCostHalf = !halfRelBox.checked ? stackedCost : (() => {
    const res = []
    res[tiers.length - 2] = baseCost[tiers.length - 2].slice()
    for (let i = tiers.length - 3; i >= 0; i--) {
      res[i] = res[i + 1].map((v, j) => v + (baseCost[i][j] || 0))
    }
    return res
  })()
  stackedCostMatrix.data = stackedCost
  stackedCostMatrix.write()

  const counts = countsMatrix.data
  if (halfRelBox.checked) {
    for (let i = half; i < counts.length; i++) {
      counts[i][maxTier - 1] = 0
    }
  }
  const requiredBlueprints = counts.map((eq, i) => {
    const costs = i < half ? stackedCost : stackedCostHalf
    const res = new Array(maxTier - 1).fill(0)
    for (const [tier, count] of eq.entries()) {
      if (tier > maxTier - 1) break
      costs[tier]?.forEach((v, i) => {
        res[i] += v * count
      })
    }
    return res
  })
  requiredBlueprintsMatrix.data = requiredBlueprints
  requiredBlueprintsMatrix.write()

  const currentBlueprints = currentBlueprintsMatrix.data
  const requiredMinusCurrent = requiredBlueprints.map((eq, i) => eq.map((v, j) => Math.max(0, v - (currentBlueprints[i][j] ?? 0))))
  requiredMinusCurrentMatrix.data = requiredMinusCurrent
  requiredMinusCurrentMatrix.write()
}

/**
 * @template T
 * @param {any} obj 
 * @param {new () => T} type 
 * @param {string} msg 
 * @returns {T}
 */
function checkType(obj, type, msg) {
  if (obj instanceof type) return obj
  throw new TypeError(msg)
}
