
function calculateStats() {
  const resultGrid = document.getElementById('resultGrid')
  resultGrid.innerHTML = ''
  // Example function to calculate and display some results
  // const damageType = document.getElementById('damageType').value
  // const bootIndex = document.getElementById('boots').value
  const basePhysicalElement = document.getElementById('basePhysical')
  // const baseMagicElement = document.getElementById('baseMagic')
  const baseCritChanceElement = document.getElementById('baseCritChance')
  const baseCritDmgElement = document.getElementById('baseCritDmg')
  const gemSlotsElement = document.getElementById('gemSlots')
  const gemQualityElement = document.getElementById('gemQuality')
  let basePhysical = parseFloat(basePhysicalElement.value) || 0
  // let baseMagic = parseFloat(baseMagicElement.value) || 0
  let baseCritChance = parseFloat(baseCritChanceElement.value) || 0
  let baseCritDmg = parseFloat(baseCritDmgElement.value) || 0
  let gemSlots = Math.floor(parseFloat(gemSlotsElement.value) || 0)
  let gemQuality = parseFloat(gemQualityElement.value)
  if (gemQuality !== 0) gemQuality ||= 99.5
  basePhysicalElement.value = basePhysical
  // baseMagicElement.value = baseMagic
  baseCritChanceElement.value = baseCritChance
  baseCritDmgElement.value = baseCritDmg
  gemSlotsElement.value = gemSlots
  gemQualityElement.value = gemQuality
  const critOnly = document.getElementById('critOnly').checked
  window.localStorage.setItem('inputCache', JSON.stringify({ basePhysical, baseCritChance, baseCritDmg, gemSlots, gemQuality, critOnly }))

  // const equipments = [engraves, talisman, rings, rings]
  // if (bootIndex === 'any') {
  //   equipments.push(boots)
  // } else {
  //   const boot = boots[bootIndex]
  //   if (boot) {
  //     basePhysical += boot.physical
  //     // baseMagic += boot.magic
  //     baseCritChance += boot.critChance
  //     baseCritDmg += boot.critDmg
  //     gemSlots += boot.gemSlots
  //   }
  // }

  const res = calcStats(undefined, basePhysical, baseCritChance, baseCritDmg, gemSlots, gemQuality / 100, critOnly, 60).map(v => v.name())

  if (!res.length) {
    resultGrid.innerHTML = 'no results'
    return
  }

  resultGrid.innerHTML = ''

  res.forEach((result, i) => {
    const li = document.createElement('li')
    li.className = 'grid-item'
    li.textContent = result
    if (!i) li.style.backgroundColor = '#7F3F00'
    resultGrid.appendChild(li)
  })
}