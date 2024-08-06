
const stats = [
  'PHYSICAL_DAMAGE',
  'MAGIC_DAMAGE',
  'CRITICAL_STRIKE_CHANCE',
  'CRITICAL_STRIKE_POWER',
]
const res = [0, 0, 0, 200]

const p = Player.getPlayer()
if (p) {
  const eqs = [
    p.getHeadArmor(),
    p.getChestArmor(),
    p.getLegArmor(),
    p.getFootArmor(),
    p.getOffHand(),
    p.getMainHand(),
  ]

  for (const eq of eqs) {
    const nbt = eq.getNBT()?.get('minecraft:custom_data')?.asCompoundHelper()
    if (!nbt) continue
    for (const [i, id] of stats.entries()) {
      const hstry = nbt.get(`HSTRY_${id}`)?.asString()
      const n = hstry
      ? JSON.parse(hstry)?.OGStory?.[0]?.[`MMOITEMS_${id}_ñdbl`]
      : nbt.get(`MMOITEMS_${id}`)?.asNumberHelper().asDouble()
      if (n) res[i] += n
    }
  }
  Utils.copyToClipboard(res.join('\n'))
}
